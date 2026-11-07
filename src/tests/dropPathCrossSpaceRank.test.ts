jest.mock("core/utils/superstate/spaces", () => ({
    ...jest.requireActual("core/utils/superstate/spaces"),
    movePathToNewSpaceAtIndex: jest.fn(() => Promise.resolve()),
    removePathsFromSpace: jest.fn(() => Promise.resolve()),
}));

import { dropPathInTree } from "core/utils/dnd/dropPath";
import { movePathToNewSpaceAtIndex } from "core/utils/superstate/spaces";

// Moving an item OUT of a folder by dropping it around the folder's own row
// must translate the target rank through the space's stored rank-order, which
// can contain entries hidden from the tree (folder notes, hidden separators).
// The visible row rank is one short per hidden entry.
describe("cross-space drop rank with entries hidden from the tree", () => {
    const rootPath = "Root";
    const folderNote = "Root/Root.md"; // in rank-order, never rendered as a row
    const alphaFolder = "Root/Alpha";
    const betaFolder = "Root/Beta";
    const item = "Root/Beta/Item.md";
    const storedOrder = [folderNote, alphaFolder, betaFolder];

    const buildSuperstate = () => {
        const pathStates = new Map<string, any>([
            [rootPath, { path: rootPath, type: "space" }],
            [alphaFolder, { path: alphaFolder, parent: rootPath, type: "space" }],
            [betaFolder, { path: betaFolder, parent: rootPath, type: "space" }],
            [item, { path: item, parent: betaFolder, type: "file" }],
        ]);
        return {
            settings: {},
            pathsIndex: pathStates,
            pathStateForPath: (path: string) => pathStates.get(path),
            spacesIndex: new Map([
                [rootPath, { path: rootPath, type: "folder", metadata: { sort: { field: "rank", asc: true }, "rank-order": [...storedOrder] } }],
            ]),
            getSpaceItems: () => storedOrder.map((path, rank) => ({ ...pathStates.get(path), rank })),
            spaceManager: { saveSpace: jest.fn() },
            ui: { notify: jest.fn() },
        } as any;
    };

    // visible tree: Root (group) > Alpha, Beta > Item.md
    const rootNode: any = { id: rootPath, parentId: null, depth: 0, type: "group", path: rootPath, item: { path: rootPath, type: "space" } };
    const alphaNode: any = { id: alphaFolder, parentId: rootPath, depth: 1, type: "space", path: alphaFolder, item: { path: alphaFolder }, rank: 0 };
    const betaNode: any = { id: betaFolder, parentId: rootPath, depth: 1, type: "space", path: betaFolder, item: { path: betaFolder }, rank: 1 };
    const itemNode: any = { id: item, parentId: betaFolder, depth: 2, type: "file", path: item, item: { path: item, parent: betaFolder, type: "file" }, rank: 0 };
    const flattenedTree = [rootNode, alphaNode, betaNode, itemNode];

    beforeEach(() => {
        (movePathToNewSpaceAtIndex as jest.Mock).mockClear();
    });

    it("inserts before the parent row at the stored index, not the visible rank", async () => {
        const superstate = buildSuperstate();
        await dropPathInTree(
            superstate,
            item,
            itemNode.id,
            betaNode.id,
            { depth: 1, overId: betaNode.id, parentId: rootPath, sortable: true, insert: false, droppable: true, copy: false, reorder: false, linePosition: "top" } as any,
            flattenedTree,
            [],
            "move",
        );
        // stored order: [folder note, Alpha, Beta] — before Beta = 2.
        // The visible rank of Beta is 1; using it would land before Alpha.
        expect(movePathToNewSpaceAtIndex).toHaveBeenCalledTimes(1);
        expect((movePathToNewSpaceAtIndex as jest.Mock).mock.calls[0][2]).toBe(rootPath);
        expect((movePathToNewSpaceAtIndex as jest.Mock).mock.calls[0][3]).toBe(2);
    });

    it("inserts after the parent row one past the stored index", async () => {
        const superstate = buildSuperstate();
        await dropPathInTree(
            superstate,
            item,
            itemNode.id,
            betaNode.id,
            { depth: 1, overId: betaNode.id, parentId: rootPath, sortable: true, insert: false, droppable: true, copy: false, reorder: false, linePosition: "bottom" } as any,
            flattenedTree,
            [],
            "move",
        );
        expect((movePathToNewSpaceAtIndex as jest.Mock).mock.calls[0][3]).toBe(3);
    });
});
