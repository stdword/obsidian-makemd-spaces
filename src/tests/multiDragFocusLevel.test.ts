import { getMultiProjection, getProjection, verticalInsertionDepth } from "core/utils/dnd/dragPath";
import { dropPathInTree, dropPathsInTree } from "core/utils/dnd/dropPath";

const { currentFocus } = jest.requireActual("core/utils/superstate/focusMode");
const { makeFocusSuperstate } = jest.requireActual("./focusModeStub");

const separatorPath = "spaces://$separator";
const section = (name: string, extra: any = {}): any => ({ id: name, parentId: null, depth: 0, type: "group", path: name, item: { path: name, type: "space" }, collapsed: true, childrenCount: 0, sortable: true, ...extra });
const note = (parent: any, name: string): any => {
    const path = `${parent.path}/${name}.md`;
    return { id: `${parent.id}/${path}`, parentId: parent.id, depth: 1, type: "file", path, item: { path, parent: parent.path, type: "file" }, sortable: true };
};
const placeholder: any = { id: "placeholder", parentId: null, depth: 0, type: "new", path: null };

const north = section("North");
const south = section("South");
const east = section("East");
const west = section("West");
const tree = [north, south, east, west, placeholder];
const indexOf = (rows: any[], node: any) => rows.indexOf(node);
const above = (selection: any[], node: any, rows = tree) => getMultiProjection(rows, selection.map((item) => item.path), indexOf(rows, node), 0, "move");
const below = (selection: any[], node: any, rows = tree) => getMultiProjection(rows, selection.map((item) => item.path), indexOf(rows, node), 28, "move");

describe("multi-selection drop lines between focus sections", () => {
    it("projects a reorder line above a section", () => {
        expect(above([south, west], north)).toEqual(expect.objectContaining({ overId: north.id, parentId: null, sortable: true, reorder: true, linePosition: "top" }));
    });

    it("shows the same single line for the gap between two sections", () => {
        expect(below([north, west], south)).toEqual(expect.objectContaining({ overId: east.id, linePosition: "top" }));
        expect(below([north, west], south)).toEqual(above([north, west], east));
    });

    it("offers no line around or inside a selection of adjacent sections", () => {
        expect(above([north, south], north)).toBeNull();
        expect(below([north, south], north)).toBeNull();
        expect(below([north, south], south)).toBeNull();
        expect(above([north, south], east)).toBeNull();
        expect(below([north, south], east)).toEqual(expect.objectContaining({ parentId: null, sortable: true }));
    });

    it("projects a line under a separator that ends the focus", () => {
        const separator: any = { id: `focus/${separatorPath}/4`, parentId: null, depth: 0, type: "separator", path: separatorPath, rank: 4, sortable: true };
        const rows = [north, south, east, west, separator, placeholder];
        expect(getMultiProjection(rows, [north.path, south.path], 4, 10, "move")).toEqual(expect.objectContaining({ overId: separator.id, parentId: null, linePosition: "bottom" }));
    });

    it("keeps a selection of sections on the focus level", () => {
        const open = section("Open", { collapsed: false, childrenCount: 1 });
        const inner = note(open, "Pebble");
        const rows = [north, east, south, open, inner, placeholder];
        expect(getMultiProjection(rows, [north.path, south.path], 4, 0, "move")).toBeNull();
        expect(getMultiProjection(rows, [north.path, south.path], 3, 28, "move")).toEqual(expect.objectContaining({ overId: open.id, parentId: null, linePosition: "bottom" }));
        expect(getMultiProjection(rows, [north.path, south.path], 1, 13, "move")).toEqual(expect.objectContaining({ overId: east.id, parentId: null, linePosition: "top" }));
    });

    it("lets rows from inside a section be added between sections", () => {
        const open = section("Open", { collapsed: false, childrenCount: 2 });
        const first = note(open, "Pebble");
        const second = note(open, "Quartz");
        const rows = [open, first, second, north, placeholder];
        expect(getMultiProjection(rows, [first.path, second.path], 3, 28, "move")).toEqual(expect.objectContaining({ overId: north.id, parentId: null, sortable: true, reorder: false, linePosition: "bottom" }));
    });
});

describe("dropping a multi-selection between focus sections", () => {
    const run = async (focusPaths: string[], rows: any[], selection: any[], target: any, yOffset: number) => {
        const s = makeFocusSuperstate();
        s.focuses[0].paths = [...focusPaths];
        const paths = selection.map((item) => item.path);
        const projection = getMultiProjection(rows, paths, rows.indexOf(target), yOffset, "move");
        await dropPathsInTree(s, paths, selection[0].id, projection.overId, projection, rows, [], "move");
        return currentFocus(s).paths;
    };

    it("moves scattered sections in front of the first one", async () => {
        expect(await run(["North", "South", "East", "West"], tree, [west, south], north, 0)).toEqual(["South", "West", "North", "East"]);
    });

    it("moves sections behind a separator that ends the focus", async () => {
        const separator: any = { id: `focus/${separatorPath}/3`, parentId: null, depth: 0, type: "separator", path: separatorPath, rank: 3, sortable: true };
        const rows = [north, south, east, separator, placeholder];
        expect(await run(["North", "South", "East", separatorPath], rows, [north, south], separator, 10)).toEqual(["East", separatorPath, "North", "South"]);
    });

    it("adds rows from inside a section at the dropped position", async () => {
        const open = section("Open", { collapsed: false, childrenCount: 2 });
        const first = note(open, "Pebble");
        const second = note(open, "Quartz");
        const rows = [open, first, second, north, placeholder];
        expect(await run(["Open", "North"], rows, [first, second], north, 0)).toEqual(["Open", first.path, second.path, "North"]);
    });
});

describe("dropping onto the Open row below an expanded section that ends the focus", () => {
    const open = section("Open", { collapsed: false, childrenCount: 3 });
    const first = note(open, "Pebble");
    const second = note(open, "Quartz");
    const third = note(open, "Slate");
    const rows = [north, open, first, second, third, placeholder];
    const openRow = rows.indexOf(placeholder);
    const rowHeight = 24;
    const endOfFocus = { overId: placeholder.id, parentId: null as string | null, depth: 0, sortable: true, droppable: true, linePosition: "top" };

    it("keeps the bottom of the last row inside its folder", () => {
        expect(verticalInsertionDepth(23.9, rowHeight, 1, 0)).toBe(1);
        expect(getProjection(first, rows, [first.path], 4, 1, rowHeight, true, "move", open.path)).toEqual(expect.objectContaining({ parentId: open.id }));
        expect(getMultiProjection(rows, [first.path, second.path], 4, rowHeight, "move")).toEqual(expect.objectContaining({ parentId: open.id }));
    });

    it("projects a single row onto the end of the focus", () => {
        expect(getProjection(first, rows, [first.path], openRow, 0, 10, true, "move", open.path)).toEqual(expect.objectContaining({ ...endOfFocus, reorder: false }));
    });

    it("projects a multi-selection onto the end of the focus", () => {
        expect(getMultiProjection(rows, [first.path, second.path], openRow, 10, "move")).toEqual(expect.objectContaining({ ...endOfFocus, reorder: false }));
    });

    it("reuses the line under the last section when that section is collapsed", () => {
        const openRowOfTree = tree.indexOf(placeholder);
        const underWest = { overId: west.id, parentId: null as string | null, linePosition: "bottom" };
        expect(getProjection(north, tree, [north.path], openRowOfTree, 0, 10, true, "move", null)).toEqual(expect.objectContaining(underWest));
        expect(getMultiProjection(tree, [north.path, east.path], openRowOfTree, 10, "move")).toEqual(below([north, east], west));
        expect(below([north, east], west)).toEqual(expect.objectContaining(underWest));
    });

    it("offers nothing there for sections that already end the focus", () => {
        expect(getProjection(open, rows, [open.path], openRow, 0, 10, true, "move", null)).toBeNull();
        expect(getMultiProjection(rows, [north.path, open.path], openRow, 10, "move")).toBeNull();
    });

    it("moves a section from the middle to the end of the focus", async () => {
        const s = makeFocusSuperstate();
        s.focuses[0].paths = ["North", "Open"];
        s.pathsIndex = new Map([["North", { path: "North" }]]);
        const projection = getProjection(north, rows, [north.path], openRow, 0, 10, true, "move", null);
        await dropPathInTree(s, north.path, north.id, projection.overId, projection, rows, [{ path: "North" }, { path: "Open" }] as any, "move");
        expect(currentFocus(s).paths).toEqual(["Open", "North"]);
    });

    it("adds a single row to the end of the focus", async () => {
        const s = makeFocusSuperstate();
        s.focuses[0].paths = ["North", "Open"];
        s.pathsIndex = new Map([[first.path, { path: first.path }]]);
        const projection = getProjection(first, rows, [first.path], openRow, 0, 10, true, "move", open.path);
        await dropPathInTree(s, first.path, first.id, projection.overId, projection, rows, [{ path: "North" }, { path: "Open" }] as any, "link");
        expect(currentFocus(s).paths).toEqual(["North", "Open", first.path]);
    });

    it("adds a multi-selection to the end of the focus", async () => {
        const s = makeFocusSuperstate();
        s.focuses[0].paths = ["North", "Open"];
        const paths = [first.path, second.path];
        const projection = getMultiProjection(rows, paths, openRow, 10, "move");
        await dropPathsInTree(s, paths, first.id, projection.overId, projection, rows, [], "link");
        expect(currentFocus(s).paths).toEqual(["North", "Open", first.path, second.path]);
    });
});
