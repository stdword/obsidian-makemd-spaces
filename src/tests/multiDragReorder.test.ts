import { dragSelectionForStart, getMultiProjection, getProjection, selectionIdsAfterMove } from "core/utils/dnd/dragPath";
import { isSelfDropNoOp } from "core/react/components/Navigator/SpaceTree/SpaceTreeView";
import { dropPathsInTree } from "core/utils/dnd/dropPath";

const shelf = "Shelf";
const names = ["Amber", "Basalt", "Coral", "Dune", "Ember"];
const paths = names.map((name) => `${shelf}/${name}.md`);
const [amber, basalt, coral, dune, ember] = paths;

const buildTree = (sortable = true) => {
    const parent: any = { id: shelf, parentId: null, depth: 0, type: "space", path: shelf, item: { path: shelf, type: "space" }, collapsed: false, childrenCount: paths.length, sortable: true };
    const nodes = paths.map((path, rank): any => ({ id: `${shelf}/${path}`, parentId: shelf, depth: 1, type: "file", path, item: { path, parent: shelf, type: "file" }, rank, sortable }));
    return [parent, ...nodes];
};

describe("multi-selection drag projection inside a folder", () => {
    it("projects a line above the hovered row of a custom-sorted folder", () => {
        const tree = buildTree();
        expect(getMultiProjection(tree, [basalt, dune], 5, 0, "move")).toEqual(expect.objectContaining({
            overId: tree[5].id,
            parentId: shelf,
            sortable: true,
            insert: false,
            reorder: true,
            linePosition: "top",
        }));
    });

    it("projects a line below the hovered row of a custom-sorted folder", () => {
        const tree = buildTree();
        expect(getMultiProjection(tree, [basalt, dune], 5, 28, "move")).toEqual(expect.objectContaining({
            overId: tree[5].id,
            parentId: shelf,
            sortable: true,
            linePosition: "bottom",
        }));
    });

    it("keeps the whole-folder drop when the folder is not custom-sorted", () => {
        const tree = buildTree(false);
        expect(getMultiProjection(tree, [basalt, dune], 5, 0, "move")).toEqual(expect.objectContaining({ parentId: shelf, sortable: false }));
    });
});

describe("multi-selection drop line placement", () => {
    const tree = buildTree();
    const indexOf = (path: string) => tree.findIndex((node) => node.item.path == path);
    const above = (selection: string[], path: string) => getMultiProjection(tree, selection, indexOf(path), 0, "move");
    const below = (selection: string[], path: string) => getMultiProjection(tree, selection, indexOf(path), 28, "move");

    it("shows the same single line for the gap between two rows", () => {
        const underCoral = below([amber, ember], coral);
        expect(underCoral).toEqual(expect.objectContaining({ overId: tree[indexOf(dune)].id, linePosition: "top" }));
        expect(underCoral).toEqual(above([amber, ember], dune));
    });

    it("offers no line around or inside a selection of adjacent rows", () => {
        const selection = [basalt, coral];
        expect(below(selection, amber)).toBeNull();
        expect(above(selection, basalt)).toBeNull();
        expect(below(selection, basalt)).toBeNull();
        expect(above(selection, coral)).toBeNull();
        expect(below(selection, coral)).toBeNull();
        expect(above(selection, dune)).toBeNull();
    });

    it("still offers lines away from a selection of adjacent rows", () => {
        const selection = [basalt, coral];
        expect(above(selection, amber)).toEqual(expect.objectContaining({ sortable: true }));
        expect(below(selection, dune)).toEqual(expect.objectContaining({ sortable: true }));
    });

    it("offers lines around and inside a scattered selection", () => {
        const selection = [basalt, dune];
        expect(above(selection, basalt)).toEqual(expect.objectContaining({ sortable: true }));
        expect(below(selection, basalt)).toEqual(expect.objectContaining({ sortable: true }));
        expect(below(selection, coral)).toEqual(expect.objectContaining({ sortable: true }));
        expect(below(selection, dune)).toEqual(expect.objectContaining({ sortable: true }));
    });
});

describe("selection after moving rows into another folder", () => {
    it("points at the rows in their new folder", () => {
        const container: any = { id: "Library/Archive", item: { path: "Archive", type: "space" } };
        expect(selectionIdsAfterMove(["Inbox/Quartz.md", "Inbox/Slate.md"], container)).toEqual(["Library/Archive/Archive/Quartz.md", "Library/Archive/Archive/Slate.md"]);
    });
});

describe("dropping a multi-selection at a position inside its folder", () => {
    const runDrop = async (selection: string[], targetPath: string, linePosition: "top" | "bottom") => {
        const space: any = { path: shelf, type: "folder", metadata: { sort: { field: "rank", asc: true }, "rank-order": [...paths] } };
        const pathStates = new Map(paths.map((path) => [path, { path, parent: shelf, type: "file" }]));
        const superstate = {
            settings: {},
            pathsIndex: pathStates,
            pathStateForPath: (path: string) => pathStates.get(path),
            spacesIndex: new Map([[shelf, space]]),
            getSpaceItems: () => paths.map((path, rank) => ({ ...pathStates.get(path), rank })),
            spaceManager: {
                pathExists: jest.fn(() => Promise.resolve(true)),
                saveSpace: jest.fn((_path: string, update: (metadata: any) => any) => {
                    space.metadata = update(space.metadata);
                    return Promise.resolve();
                }),
            },
            updateSpaceMetadata: jest.fn((_path: string, metadata: any) => {
                space.metadata = metadata;
                return Promise.resolve();
            }),
            ui: { notify: jest.fn() },
        } as any;
        const tree = buildTree();
        const overIndex = tree.findIndex((node) => node.item.path == targetPath);
        const projection = getMultiProjection(tree, selection, overIndex, linePosition == "top" ? 0 : 28, "move");
        await dropPathsInTree(superstate, selection, tree.find((node) => node.item.path == selection[0]).id, projection.overId, projection, tree, [], "move");
        return { order: space.metadata["rank-order"], superstate };
    };

    it("moves the selection below the last row, keeping its relative order", async () => {
        const { order, superstate } = await runDrop([dune, basalt], ember, "bottom");
        expect(order).toEqual([amber, coral, ember, basalt, dune]);
        expect(superstate.ui.notify).not.toHaveBeenCalled();
    });

    it("moves the selection above the first row", async () => {
        const { order } = await runDrop([basalt, dune], amber, "top");
        expect(order).toEqual([basalt, dune, amber, coral, ember]);
    });

    it("lines a scattered selection up under its first row when dropped above it", async () => {
        const { order } = await runDrop([basalt, dune], basalt, "top");
        expect(order).toEqual([amber, basalt, dune, coral, ember]);
    });

    it("lines a scattered selection up over its last row when dropped below it", async () => {
        const { order } = await runDrop([basalt, dune], dune, "bottom");
        expect(order).toEqual([amber, coral, basalt, dune, ember]);
    });

    it("gathers a scattered selection next to one of its own rows", async () => {
        const { order } = await runDrop([amber, dune], dune, "bottom");
        expect(order).toEqual([basalt, coral, amber, dune, ember]);
    });
});

describe("dropping after a separator that ends a folder", () => {
    const separatorPath = "spaces://$separator";
    const order = [...paths, separatorPath];
    const tree = buildTree();
    const separator: any = { id: `${shelf}/separator-5`, parentId: shelf, depth: 1, type: "separator", path: separatorPath, rank: 5, sortable: false };
    const withSeparator = [...tree, separator];
    const separatorRowHeight = 10;

    it("projects a line under the separator for a multi-selection", () => {
        expect(getMultiProjection(withSeparator, [amber, basalt], 6, separatorRowHeight, "move")).toEqual(expect.objectContaining({
            overId: separator.id,
            parentId: shelf,
            sortable: true,
            linePosition: "bottom",
        }));
    });

    it("projects a line under the separator for a single row", () => {
        expect(getProjection(withSeparator[1], withSeparator, [amber], 6, 1, separatorRowHeight, true, "move", shelf)).toEqual(expect.objectContaining({
            overId: separator.id,
            parentId: shelf,
            sortable: true,
            linePosition: "bottom",
        }));
    });

    it("moves a multi-selection behind the separator", async () => {
        const space: any = { path: shelf, type: "folder", metadata: { sort: { field: "rank", asc: true }, "rank-order": [...order] } };
        const superstate = {
            settings: {},
            pathsIndex: new Map(),
            spacesIndex: new Map([[shelf, space]]),
            getSpaceItems: () => paths.map((path, rank) => ({ path, rank })),
            spaceManager: { saveSpace: jest.fn(() => Promise.resolve()) },
            updateSpaceMetadata: jest.fn((_path: string, metadata: any) => {
                space.metadata = metadata;
                return Promise.resolve();
            }),
        } as any;
        const projection = getMultiProjection(withSeparator, [amber, basalt], 6, separatorRowHeight, "move");
        await dropPathsInTree(superstate, [amber, basalt], withSeparator[1].id, projection.overId, projection, withSeparator, [], "move");
        expect(space.metadata["rank-order"]).toEqual([coral, dune, ember, separatorPath, amber, basalt]);
    });
});

describe("releasing a drag over the dragged row", () => {
    const active: any = { id: "Shelf/Shelf/Amber.md" };

    it("is a no-op when nothing is projected there", () => {
        expect(isSelfDropNoOp(active, active.id, null)).toBe(true);
    });

    it("drops when the row carries a drop line of a multi-selection", () => {
        const tree = buildTree();
        const projection = getMultiProjection(tree, [amber, coral], 1, 0, "move");
        expect(projection).not.toBeNull();
        expect(isSelfDropNoOp(tree[1], tree[1].id, projection)).toBe(false);
    });
});

describe("what a drag carries when it starts", () => {
    const tree = buildTree();
    const [, amberNode, basaltNode, coralNode] = tree;
    const separator: any = { id: `${shelf}/separator-5`, parentId: shelf, depth: 1, type: "separator", path: "spaces://$separator", rank: 5 };

    it("carries the whole selection when dragged by one of its rows", () => {
        expect(dragSelectionForStart(basaltNode, [amberNode, basaltNode])).toEqual({ paths: [amber, basalt], selection: [amberNode, basaltNode] });
    });

    it("carries only the dragged row and selects it when several other rows are selected", () => {
        expect(dragSelectionForStart(coralNode, [amberNode, basaltNode])).toEqual({ paths: [coral], selection: [coralNode] });
    });

    it("moves a single selection onto the dragged row", () => {
        expect(dragSelectionForStart(coralNode, [amberNode])).toEqual({ paths: [coral], selection: [coralNode] });
    });

    it("clears the selection when a separator is dragged", () => {
        expect(dragSelectionForStart(separator, [amberNode, basaltNode])).toEqual({ paths: [separator.path], selection: [] });
    });
});

describe("dragging a selection that contains folders", () => {
    const folder = (name: string, extra: any = {}): any => ({ id: `${shelf}/${shelf}/${name}`, parentId: shelf, depth: 1, type: "space", path: `${shelf}/${name}`, item: { path: `${shelf}/${name}`, type: "space" }, collapsed: true, childrenCount: 0, sortable: true, ...extra });
    const root: any = { id: shelf, parentId: null, depth: 0, type: "space", path: shelf, item: { path: shelf, type: "space" }, collapsed: false, childrenCount: 3, sortable: true };
    const north = folder("North");
    const south = folder("South", { collapsed: false, childrenCount: 1 });
    const inner: any = { id: `${south.id}/${shelf}/South/Pebble.md`, parentId: south.id, depth: 2, type: "file", path: `${shelf}/South/Pebble.md`, item: { path: `${shelf}/South/Pebble.md`, type: "file" }, sortable: true };
    const west = folder("West");
    const tree = [root, north, south, inner, west];
    const selection = [north.path, south.path];

    it("does not drop the selection into one of its own collapsed folders", () => {
        expect(getMultiProjection(tree, selection, 1, 13, "move")).toBeNull();
    });

    it("does not drop the selection into one of its own expanded folders", () => {
        expect(getMultiProjection(tree, selection, 2, 13, "move")).toBeNull();
        expect(getMultiProjection(tree, selection, 2, 28, "move")).toBeNull();
        expect(getMultiProjection(tree, selection, 3, 0, "move")).toBeNull();
    });

    it("still drops the selection into a folder outside of it", () => {
        expect(getMultiProjection(tree, selection, 4, 13, "move")).toEqual(expect.objectContaining({ parentId: west.id, insert: true }));
    });
});
