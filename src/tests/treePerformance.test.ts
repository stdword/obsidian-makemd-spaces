import { treeLinesForTree, visibleTreeLines } from "core/react/components/Navigator/SpaceTree/SpaceTreeVirtualized";
import { excludedPathsForFocus } from "core/utils/superstate/focus";

const node = (id: string, depth: number, type: string, collapsed = false) => ({ id, depth, type, collapsed }) as any;

describe("treeLinesForTree", () => {
    // section (depth 0) > A (1) > A/x (2), A/y (2) > A/y/z (3); B (1) collapsed; C (1) empty
    const tree = [node("S", 0, "group"), node("A", 1, "space"), node("A/x", 2, "file"), node("A/y", 2, "space"), node("A/y/z", 3, "file"), node("B", 1, "space", true), node("C", 1, "space")];
    const heights = tree.map(() => 20);
    const offsets = heights.map((_, index) => index * 20);
    const spacing = (n: any) => n.depth * 10;

    it("draws one line per expanded container that has children, spanning its whole subtree", () => {
        const lines = treeLinesForTree(tree, heights, offsets, spacing);
        expect(lines.map((line) => line.id)).toEqual(["A", "A/y"]);
        // A: starts below its own row (index 1) and ends at the bottom of A/y/z (index 4).
        expect(lines[0]).toMatchObject({ top: 40, height: 100 - 40 - 4, left: 6 + 10 + 10 - 1 });
        expect(lines[1]).toMatchObject({ top: 80, height: 100 - 80 - 4 });
    });

    it("skips sections, collapsed containers and containers without children", () => {
        const ids = treeLinesForTree(tree, heights, offsets, spacing).map((line) => line.id);
        expect(ids).not.toContain("S");
        expect(ids).not.toContain("B");
        expect(ids).not.toContain("C");
    });

    it("handles a trailing open container whose subtree runs to the end", () => {
        const tail = [node("S", 0, "group"), node("D", 1, "space"), node("D/a", 2, "file"), node("D/b", 2, "file")];
        const lines = treeLinesForTree(tail, [20, 20, 20, 20], [0, 20, 40, 60], spacing);
        expect(lines).toEqual([{ id: "D", left: 25, top: 40, height: 80 - 40 - 4 }]);
    });
});

describe("visibleTreeLines", () => {
    it("keeps only lines intersecting the rendered scroll window", () => {
        const lines = [
            { id: "above", left: 0, top: 0, height: 50 },
            { id: "crossing", left: 0, top: 90, height: 50 },
            { id: "inside", left: 0, top: 120, height: 10 },
            { id: "below", left: 0, top: 300, height: 50 },
        ];
        expect(visibleTreeLines(lines, 100, 200).map((line) => line.id)).toEqual(["crossing", "inside"]);
    });
});

describe("excludedPathsForFocus", () => {
    it("returns the same empty array for focuses without exclusions", () => {
        const first = excludedPathsForFocus({ name: "a", sticker: "", paths: [] } as any);
        const second = excludedPathsForFocus(undefined);
        expect(first).toBe(second);
        expect(first).toEqual([]);
        expect(excludedPathsForFocus({ name: "b", sticker: "", paths: [], "excluded-paths": ["Hidden"] } as any)).toEqual(["Hidden"]);
    });
});
