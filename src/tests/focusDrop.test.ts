import { readFileSync } from "fs";
import { addPathsToFocus } from "core/utils/superstate/focus";

describe("addPathsToFocus", () => {
    const focuses = [
        { name: "Work", sticker: "", paths: ["Work/Plan.md"] },
        { name: "Home", sticker: "", paths: ["Home"] },
    ] as any[];

    it("appends new paths to the target focus only, skipping ones it already has", () => {
        const result = addPathsToFocus(focuses, 1, ["Home", "Recipes"]);

        expect(result[1].paths).toEqual(["Home", "Recipes"]);
        expect(result[0]).toBe(focuses[0]);
        expect(focuses[1].paths).toEqual(["Home"]);
    });

    it("returns the focuses unchanged for an index that does not exist", () => {
        expect(addPathsToFocus(focuses, 5, ["Recipes"])).toEqual(focuses);
    });
});

describe("focus tab drop targets", () => {
    it("no longer looks a focus index up in spacesIndex", () => {
        const source = readFileSync("src/core/react/components/Navigator/Focuses/FocusSelector.tsx", "utf8");
        expect(source).not.toContain("spacesIndex.get(overId)");
        expect(source).toContain("addPathsToFocus(focuses, overId, dragPaths)");
    });

    it("shares the drop helper with the pointer drag in the tree", () => {
        const source = readFileSync("src/core/react/components/Navigator/SpaceTree/SpaceTreeView.tsx", "utf8");
        expect(source).toContain("addPathsToFocus(handlers.focuses, focusIndex, droppedPaths)");
    });
});
