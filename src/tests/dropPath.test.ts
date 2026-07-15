jest.mock(
    "makemd-core",
    () => ({
        SelectOptionType: {
            Submenu: "submenu",
            Separator: "separator",
            Radio: "radio",
        },
    }),
    { virtual: true },
);

import { dropPathInSpaceAtIndex, dropPathInTree, dropPathsInSpaceAtIndex, rankForDropLinePosition, rankForDropPositionInSpace } from "core/utils/dnd/dropPath";
import { linkPathToSpaceAtIndex } from "core/utils/superstate/spaces";
import i18n from "shared/i18n";

describe("rankForDropLinePosition", () => {
    const active = { rank: 0 } as any;

    it("compensates a downward reorder before the target", () => {
        expect(rankForDropLinePosition(2, { linePosition: "top" } as any, active, "space", "space")).toBe(1);
    });

    it("compensates a downward reorder after the target", () => {
        expect(rankForDropLinePosition(2, { linePosition: "bottom" } as any, active, "space", "space")).toBe(2);
    });

    it("does not compensate moves between spaces", () => {
        expect(rankForDropLinePosition(2, { linePosition: "top" } as any, active, "source", "target")).toBe(2);
    });

    it("leaves focus-level compensation to focus reordering", () => {
        expect(rankForDropLinePosition(2, { linePosition: "top" } as any, active, null, null)).toBe(2);
    });
});

describe("rankForDropPositionInSpace", () => {
    const order = ["Board/Overview.canvas", "Board/Alpha.md", "Board/Beta.md", "Board/Gamma.md", "Board/Pinned.md"];
    const superstate = {
        spacesIndex: new Map([["Board", { path: "Board", metadata: { "rank-order": order } }]]),
        getSpaceItems: jest.fn(() => order.map((path, rank) => ({ path, rank }))),
    } as any;
    const node = (path: string): any => ({ id: `Board/${path}`, path, item: { path }, type: "file" });

    it.each([
        ["moves up before a target", "Board/Gamma.md", "Board/Alpha.md", "top", 1],
        ["moves up after a target", "Board/Gamma.md", "Board/Alpha.md", "bottom", 2],
        ["moves down before a target", "Board/Alpha.md", "Board/Gamma.md", "top", 2],
        ["moves down after a target", "Board/Alpha.md", "Board/Gamma.md", "bottom", 3],
        ["keeps an item already before its target in place", "Board/Beta.md", "Board/Gamma.md", "top", 2],
        ["keeps an item already after its target in place", "Board/Beta.md", "Board/Alpha.md", "bottom", 2],
    ])("%s", (_name, path, targetPath, position, expectedRank) => {
        expect(rankForDropPositionInSpace(superstate, path, "Board", node(targetPath), position as "top" | "bottom")).toBe(expectedRank);
    });
});

describe("same-space tree reorder with hidden and pinned items", () => {
    const spacePath = "Board";
    const hidden = "Board/Overview.canvas";
    const alpha = "Board/Alpha.md";
    const beta = "Board/Beta.md";
    const gamma = "Board/Gamma.md";
    const pinnedOne = "Board/PinnedOne.md";
    const pinnedTwo = "Board/PinnedTwo.md";
    const initialOrder = [hidden, alpha, beta, gamma, pinnedOne, pinnedTwo];

    const runReorder = async (activePath: string, targetPath: string, linePosition: "top" | "bottom") => {
        const space: any = {
            path: spacePath,
            type: "folder",
            metadata: {
                sort: { field: "rank", asc: true },
                "rank-order": [...initialOrder],
                pinned: [pinnedOne, pinnedTwo],
            },
        };
        const pathStates = new Map(initialOrder.map((path) => [path, { path, parent: spacePath, type: "file" }]));
        const updateSpaceMetadata = jest.fn((_path: string, metadata: any) => {
            space.metadata = metadata;
            return Promise.resolve();
        });
        const superstate = {
            settings: {},
            pathsIndex: pathStates,
            pathStateForPath: jest.fn((path: string) => pathStates.get(path)),
            spacesIndex: new Map([[spacePath, space]]),
            getSpaceItems: jest.fn(() => initialOrder.map((path, rank) => ({ ...pathStates.get(path), rank }))),
            spaceManager: {
                saveSpace: jest.fn((_path: string, update: (metadata: any) => any) => {
                    space.metadata = update(space.metadata);
                    return Promise.resolve();
                }),
            },
            updateSpaceMetadata,
        } as any;
        const parent: any = {
            id: spacePath,
            parentId: null,
            depth: 0,
            type: "group",
            path: spacePath,
            item: { path: spacePath, type: "space" },
        };
        const visiblePaths = [pinnedOne, pinnedTwo, alpha, beta, gamma];
        const nodes = visiblePaths.map((path, rank): any => ({
            id: `${spacePath}/${path}`,
            parentId: spacePath,
            depth: 1,
            type: "file",
            path,
            item: pathStates.get(path),
            rank,
            pinned: path == pinnedOne || path == pinnedTwo,
            sortable: true,
        }));
        const activeNode = nodes.find((node) => node.path == activePath);
        const targetNode = nodes.find((node) => node.path == targetPath);

        await dropPathInTree(
            superstate,
            activePath,
            activeNode.id,
            targetNode.id,
            {
                depth: 1,
                overId: targetNode.id,
                parentId: spacePath,
                sortable: true,
                insert: false,
                droppable: true,
                copy: false,
                reorder: true,
                linePosition,
            },
            [parent, ...nodes],
            [] as any,
            "move",
        );

        return { order: space.metadata["rank-order"], updateSpaceMetadata };
    };

    it.each([
        ["moves the last item above the first", gamma, alpha, "top", [hidden, gamma, alpha, beta, pinnedOne, pinnedTwo]],
        ["moves the first item below the last", alpha, gamma, "bottom", [hidden, beta, gamma, alpha, pinnedOne, pinnedTwo]],
        ["moves a middle item upward", beta, alpha, "top", [hidden, beta, alpha, gamma, pinnedOne, pinnedTwo]],
        ["moves a middle item downward", beta, gamma, "bottom", [hidden, alpha, gamma, beta, pinnedOne, pinnedTwo]],
        ["clamps an unpinned item to the start of the unpinned zone", gamma, pinnedOne, "top", [hidden, gamma, alpha, beta, pinnedOne, pinnedTwo]],
    ])("%s", async (_name, activePath, targetPath, linePosition, expectedOrder) => {
        const result = await runReorder(activePath as string, targetPath as string, linePosition as "top" | "bottom");
        expect(result.order).toEqual(expectedOrder);
    });

    it("does not save when the item is already immediately before the target", async () => {
        const result = await runReorder(beta, gamma, "top");
        expect(result.order).toEqual(initialOrder);
        expect(result.updateSpaceMetadata).not.toHaveBeenCalled();
    });
});

describe("dropPathInSpaceAtIndex", () => {
    it("builds a complete rank order when the first reorder moves an item to the bottom", async () => {
        const updateSpaceMetadata = jest.fn(() => Promise.resolve());
        const items = [
            { path: "Studio/Ideas", rank: 0 },
            { path: "Studio/Drafts", rank: 1 },
            { path: "Studio/Archive", rank: 2 },
        ];
        const superstate = {
            settings: {},
            pathsIndex: new Map(items.map((item) => [item.path, { ...item, parent: "Studio", type: "space" }])),
            pathStateForPath: jest.fn((path: string) => superstate.pathsIndex.get(path)),
            getSpaceItems: jest.fn(() => items),
            spacesIndex: new Map([
                ["Studio", { path: "Studio", type: "folder", metadata: { sort: { field: "rank", asc: true }, "rank-order": [] } }],
            ]),
            spaceManager: { saveSpace: jest.fn((_path: string, update: (metadata: Record<string, any>) => Record<string, any>) => update({})) },
            updateSpaceMetadata,
        } as any;

        await dropPathInSpaceAtIndex(superstate, "Studio/Ideas", "Studio", "Studio", 2);

        expect(updateSpaceMetadata).toHaveBeenCalledWith("Studio", expect.objectContaining({
            "rank-order": ["Studio/Drafts", "Studio/Archive", "Studio/Ideas"],
        }));
    });

    it("awaits tag space rank-order updates when reordering inside the same custom-sorted tag space", async () => {
        let resolveUpdate: () => void;
        const updateDone = new Promise<void>((resolve) => {
            resolveUpdate = resolve;
        });
        const tagSpacePath = "spaces://#fixture";
        const updateSpaceMetadata = jest.fn(() => updateDone);
        const superstate = {
            settings: {},
            pathsIndex: new Map([
                ["EntryOne.md", { path: "EntryOne.md", name: "Entry One", type: "file" }],
                ["EntryTwo.md", { path: "EntryTwo.md", name: "Entry Two", type: "file" }],
                ["EntryThree.md", { path: "EntryThree.md", name: "Entry Three", type: "file" }],
            ]),
            pathStateForPath: jest.fn((path: string) => superstate.pathsIndex.get(path)),
            spacesIndex: new Map([
                [
                    tagSpacePath,
                    {
                        path: tagSpacePath,
                        name: "#fixture",
                        type: "tag",
                        metadata: {
                            sort: { field: "rank", asc: true },
                            "rank-order": ["EntryOne.md", "EntryTwo.md", "EntryThree.md"],
                        },
                    },
                ],
            ]),
            updateSpaceMetadata,
        } as any;

        const drop = dropPathInSpaceAtIndex(superstate, "EntryThree.md", tagSpacePath, tagSpacePath, 0);
        let settled = false;
        drop.then(() => {
            settled = true;
        });
        await Promise.resolve();

        expect(updateSpaceMetadata).toHaveBeenCalledWith(tagSpacePath, expect.objectContaining({
            "rank-order": ["EntryThree.md", "EntryOne.md", "EntryTwo.md"],
        }));
        expect(settled).toBe(false);

        resolveUpdate();
        await drop;

        expect(settled).toBe(true);
    });

    it("does not add tags by dropping an external path into a tag space", async () => {
        const tagSpacePath = "spaces://#fixture";
        const superstate = {
            pathsIndex: new Map([
                ["Outside.md", { path: "Outside.md", name: "Outside", type: "file" }],
            ]),
            pathStateForPath: jest.fn((path: string) => superstate.pathsIndex.get(path)),
            spacesIndex: new Map([
                [
                    tagSpacePath,
                    {
                        path: tagSpacePath,
                        name: "#fixture",
                        type: "tag",
                        metadata: {
                            sort: { field: "rank", asc: true },
                            "rank-order": [],
                        },
                    },
                ],
            ]),
            spaceManager: {},
            updateSpaceMetadata: jest.fn(() => Promise.resolve()),
        } as any;

        await dropPathInSpaceAtIndex(superstate, "Outside.md", "Source", tagSpacePath, 0);

        expect(superstate.updateSpaceMetadata).not.toHaveBeenCalled();
    });

    it("adds a path to the active focus when dropping onto the focus level and it is not already there", async () => {
        const saveFocuses = jest.fn();
        const superstate = {
            settings: {
                currentFocus: 0,
            },
            focuses: [
                {
                    name: "Current View",
                    paths: ["RootFolder"],
                },
            ],
            pathsIndex: new Map([
                ["Inserted.md", { path: "Inserted.md", name: "Inserted", type: "file" }],
            ]),
            pathStateForPath: jest.fn((path: string) => superstate.pathsIndex.get(path)),
            spaceManager: {
                saveFocuses,
            },
        } as any;

        await dropPathInSpaceAtIndex(superstate, "Inserted.md", "spaces://#fixture", null, 1, "link");

        expect(saveFocuses).toHaveBeenCalledWith([
            {
                name: "Current View",
                paths: ["RootFolder", "Inserted.md"],
            },
        ]);
    });

    it("keeps a folder visible in its source space when shift-linking it to another space", async () => {
        const sourcePath = "Source";
        const targetPath = "Target";
        const folderPath = "Source/Archive";
        const saveSpace = jest.fn((_path: string, update: (metadata: Record<string, any>) => Record<string, any>) => Promise.resolve(update({})));
        const spacesMap = new Map([[folderPath, new Set([sourcePath])]]);
        const superstate = {
            settings: {},
            pathsIndex: new Map([[folderPath, { path: folderPath, parent: sourcePath, name: "Archive", type: "space", subtype: "folder" }]]),
            pathStateForPath: jest.fn((path: string) => superstate.pathsIndex.get(path)),
            spacesIndex: new Map([
                [sourcePath, { path: sourcePath, type: "folder", metadata: { links: [] } }],
                [targetPath, { path: targetPath, type: "folder", metadata: { links: [] } }],
            ]),
            spacesMap: {
                get: jest.fn((path: string) => spacesMap.get(path) ?? new Set()),
                set: jest.fn((path: string, spaces: Set<string>) => spacesMap.set(path, spaces)),
            },
            spaceManager: { saveSpace },
            updateSpaceMetadata: jest.fn(async (path: string, metadata: Record<string, any>) => {
                superstate.spacesIndex.get(path).metadata = metadata;
            }),
            reloadPath: jest.fn(() => Promise.resolve()),
            dispatchEvent: jest.fn(),
            ui: { notify: jest.fn() },
        } as any;

        await dropPathInSpaceAtIndex(superstate, folderPath, sourcePath, targetPath, 0, "link");

        expect([...spacesMap.get(folderPath)]).toEqual([sourcePath, targetPath]);
        expect(saveSpace.mock.calls.map(([path]) => path)).toEqual([targetPath]);
    });

    it("does nothing when dropping a path into the folder that already contains it", async () => {
        const movePath = jest.fn(() => Promise.resolve());
        const superstate = {
            pathsIndex: new Map([
                ["ExistingFolder/ExistingNote.md", { path: "ExistingFolder/ExistingNote.md", parent: "ExistingFolder", name: "Existing Note", type: "file" }],
            ]),
            pathStateForPath: jest.fn((path: string) => superstate.pathsIndex.get(path)),
            spacesIndex: new Map([
                [
                    "ExistingFolder",
                    {
                        path: "ExistingFolder",
                        name: "ExistingFolder",
                        type: "folder",
                    },
                ],
                [
                    "spaces://#fixture",
                    {
                        path: "spaces://#fixture",
                        name: "#fixture",
                        type: "tag",
                    },
                ],
            ]),
            spaceManager: {
                renamePath: movePath,
            },
            updateSpaceMetadata: jest.fn(() => Promise.resolve()),
        } as any;

        await dropPathInSpaceAtIndex(superstate, "ExistingFolder/ExistingNote.md", "spaces://#fixture", "ExistingFolder", 0, "move");

        expect(movePath).not.toHaveBeenCalled();
        expect(superstate.updateSpaceMetadata).not.toHaveBeenCalled();
    });

    it("notifies and does not create a link when linking a path to its own folder", async () => {
        const notify = jest.fn();
        const superstate = {
            pathsIndex: new Map([
                ["Container/Item.md", { path: "Container/Item.md", parent: "Container", name: "Item", type: "file" }],
            ]),
            pathStateForPath: jest.fn((path: string) => superstate.pathsIndex.get(path)),
            spacesIndex: new Map(),
            spacesMap: {
                get: jest.fn(() => new Set()),
                set: jest.fn(),
            },
            spaceManager: {
                saveSpace: jest.fn(() => Promise.resolve()),
            },
            updateSpaceMetadata: jest.fn(() => Promise.resolve()),
            reloadPath: jest.fn(() => Promise.resolve()),
            dispatchEvent: jest.fn(),
            ui: {
                notify,
            },
        } as any;
        const space: any = {
            path: "Container",
            type: "folder",
            metadata: {
                links: [],
                "rank-order": [],
            },
        };

        await linkPathToSpaceAtIndex(superstate, space, "Container/Item.md", 0);

        expect(notify).toHaveBeenCalledWith(i18n.notice.cannotLinkToOwnFolder);
        expect(superstate.updateSpaceMetadata).not.toHaveBeenCalled();
        expect(superstate.spaceManager.saveSpace).not.toHaveBeenCalled();
    });

    it("notifies after a drag link drop into the path own folder", async () => {
        const notify = jest.fn();
        const superstate = {
            pathsIndex: new Map([
                ["Container/Item.md", { path: "Container/Item.md", parent: "Container", name: "Item", type: "file" }],
            ]),
            pathStateForPath: jest.fn((path: string) => superstate.pathsIndex.get(path)),
            spacesIndex: new Map([
                [
                    "Container",
                    {
                        path: "Container",
                        type: "folder",
                        metadata: {
                            links: [],
                            "rank-order": [],
                        },
                    },
                ],
            ]),
            spacesMap: {
                get: jest.fn(() => new Set()),
                set: jest.fn(),
            },
            spaceManager: {
                saveSpace: jest.fn(() => Promise.resolve()),
            },
            updateSpaceMetadata: jest.fn(() => Promise.resolve()),
            reloadPath: jest.fn(() => Promise.resolve()),
            dispatchEvent: jest.fn(),
            ui: {
                notify,
            },
        } as any;

        await dropPathInSpaceAtIndex(superstate, "Container/Item.md", "spaces://#fixture", "Container", 0, "link");

        expect(notify).toHaveBeenCalledWith(i18n.notice.cannotLinkToOwnFolder);
        expect(superstate.updateSpaceMetadata).not.toHaveBeenCalled();
        expect(superstate.spaceManager.saveSpace).not.toHaveBeenCalled();
    });

    it("notifies after a drag link drop from a folder item into the same folder", async () => {
        const notify = jest.fn();
        const superstate = {
            pathsIndex: new Map([
                ["Container/Item.md", { path: "Container/Item.md", parent: "Container", name: "Item", type: "file" }],
            ]),
            pathStateForPath: jest.fn((path: string) => superstate.pathsIndex.get(path)),
            spacesIndex: new Map([
                [
                    "Container",
                    {
                        path: "Container",
                        type: "folder",
                        metadata: {
                            links: [],
                            "rank-order": [],
                        },
                    },
                ],
            ]),
            spacesMap: {
                get: jest.fn(() => new Set()),
                set: jest.fn(),
            },
            spaceManager: {
                saveSpace: jest.fn(() => Promise.resolve()),
            },
            updateSpaceMetadata: jest.fn(() => Promise.resolve()),
            reloadPath: jest.fn(() => Promise.resolve()),
            dispatchEvent: jest.fn(),
            ui: {
                notify,
            },
        } as any;

        await dropPathInSpaceAtIndex(superstate, "Container/Item.md", "Container", "Container", 0, "link");

        expect(notify).toHaveBeenCalledWith(i18n.notice.cannotLinkToOwnFolder);
        expect(superstate.updateSpaceMetadata).not.toHaveBeenCalled();
        expect(superstate.spaceManager.saveSpace).not.toHaveBeenCalled();
    });

    it("notifies when bulk linking a path to its own unindexed folder", async () => {
        const notify = jest.fn();
        const superstate = {
            pathsIndex: new Map([
                ["Container/Item.md", { path: "Container/Item.md", parent: "Container", name: "Item", type: "file" }],
            ]),
            pathStateForPath: jest.fn((path: string) => superstate.pathsIndex.get(path)),
            spacesIndex: new Map(),
            ui: {
                notify,
            },
        } as any;

        await dropPathsInSpaceAtIndex(superstate, ["Container/Item.md"], "Container", -1, "link");

        expect(notify).toHaveBeenCalledWith(i18n.notice.cannotLinkToOwnFolder);
    });

    it("notifies and does not save when linking a path already linked in the folder", async () => {
        const notify = jest.fn();
        const superstate = {
            pathsIndex: new Map([
                ["Source/Item.md", { path: "Source/Item.md", parent: "Source", name: "Item", type: "file" }],
            ]),
            pathStateForPath: jest.fn((path: string) => superstate.pathsIndex.get(path)),
            spacesIndex: new Map(),
            spacesMap: {
                get: jest.fn(() => new Set(["Container"])),
                set: jest.fn(),
            },
            spaceManager: {
                saveSpace: jest.fn(() => Promise.resolve()),
            },
            updateSpaceMetadata: jest.fn(() => Promise.resolve()),
            reloadPath: jest.fn(() => Promise.resolve()),
            dispatchEvent: jest.fn(),
            ui: {
                notify,
            },
        } as any;
        const space: any = {
            path: "Container",
            type: "folder",
            metadata: {
                links: ["Source/Item.md"],
                "rank-order": ["Source/Item.md"],
            },
        };

        await linkPathToSpaceAtIndex(superstate, space, "Source/Item.md", 0);

        expect(notify).toHaveBeenCalledWith(i18n.notice.cannotLinkToOwnFolder);
        expect(superstate.updateSpaceMetadata).not.toHaveBeenCalled();
        expect(superstate.spaceManager.saveSpace).not.toHaveBeenCalled();
    });

    it("removes an existing link and keeps its rank when moving a linked path into that folder without an explicit position", async () => {
        const renamePath = jest.fn(() => Promise.resolve());
        const space = {
            path: "Container",
            type: "folder",
            metadata: {
                sort: { field: "rank", asc: true },
                links: ["Source/Item.md"],
                "rank-order": ["SiblingA.md", "Source/Item.md", "SiblingB.md"],
            },
            space: {
                defPath: "Container/.space/context.json",
            },
        };
        const superstate = {
            settings: {},
            pathsIndex: new Map([
                ["Source/Item.md", { path: "Source/Item.md", parent: "Source", name: "Item.md", type: "file" }],
            ]),
            pathStateForPath: jest.fn((path: string) => superstate.pathsIndex.get(path)),
            spacesIndex: new Map([["Container", space]]),
            spacesMap: {
                get: jest.fn(() => new Set(["spaces://#fixture", "Container"])),
                set: jest.fn(),
            },
            spaceManager: {
                pathExists: jest.fn(() => Promise.resolve(false)),
                renamePath,
                saveSpace: jest.fn((_path: string, update: (metadata: any) => any) => {
                    space.metadata = update(space.metadata);
                    return Promise.resolve();
                }),
            },
            getSpaceItems: jest.fn(() => [
                { path: "SiblingA.md" },
                { path: "Source/Item.md" },
                { path: "SiblingB.md" },
            ]),
            updateSpaceMetadata: jest.fn((_path: string, metadata: any) => {
                space.metadata = metadata;
                return Promise.resolve();
            }),
            ui: {
                notify: jest.fn(),
            },
        } as any;

        await dropPathInSpaceAtIndex(superstate, "Source/Item.md", "spaces://#fixture", "Container", false as any, "move");

        expect(renamePath).toHaveBeenCalledWith("Source/Item.md", "Container/Item.md");
        expect(superstate.updateSpaceMetadata).toHaveBeenLastCalledWith("Container", expect.objectContaining({
            links: [],
            "rank-order": ["SiblingA.md", "Container/Item.md", "SiblingB.md"],
        }));
    });

    it("uses the explicit drag rank when moving a linked path into that folder at a specific position", async () => {
        const space = {
            path: "Container",
            type: "folder",
            metadata: {
                sort: { field: "rank", asc: true },
                links: ["Source/Item.md"],
                "rank-order": ["SiblingA.md", "Source/Item.md", "SiblingB.md"],
            },
            space: {
                defPath: "Container/.space/context.json",
            },
        };
        const superstate = {
            settings: {},
            pathsIndex: new Map([
                ["Source/Item.md", { path: "Source/Item.md", parent: "Source", name: "Item.md", type: "file" }],
            ]),
            pathStateForPath: jest.fn((path: string) => superstate.pathsIndex.get(path)),
            spacesIndex: new Map([["Container", space]]),
            spacesMap: {
                get: jest.fn(() => new Set(["spaces://#fixture", "Container"])),
                set: jest.fn(),
            },
            spaceManager: {
                pathExists: jest.fn(() => Promise.resolve(false)),
                renamePath: jest.fn(() => Promise.resolve()),
                saveSpace: jest.fn((_path: string, update: (metadata: any) => any) => {
                    space.metadata = update(space.metadata);
                    return Promise.resolve();
                }),
            },
            getSpaceItems: jest.fn(() => [
                { path: "SiblingA.md" },
                { path: "Source/Item.md" },
                { path: "SiblingB.md" },
            ]),
            updateSpaceMetadata: jest.fn((_path: string, metadata: any) => {
                space.metadata = metadata;
                return Promise.resolve();
            }),
            ui: {
                notify: jest.fn(),
            },
        } as any;

        await dropPathInSpaceAtIndex(superstate, "Source/Item.md", "spaces://#fixture", "Container", 0, "move");

        expect(superstate.updateSpaceMetadata).toHaveBeenLastCalledWith("Container", expect.objectContaining({
            links: [],
            "rank-order": ["Container/Item.md", "SiblingA.md", "SiblingB.md"],
        }));
    });

    it("adjusts the explicit drag rank when replacing a link above the target position", async () => {
        const space = {
            path: "Container",
            type: "folder",
            metadata: {
                sort: { field: "rank", asc: true },
                links: ["Source/Item.md"],
                "rank-order": ["Source/Item.md", "SiblingA.md", "SiblingB.md", "SiblingC.md"],
            },
            space: {
                defPath: "Container/.space/context.json",
            },
        };
        const superstate = {
            settings: {},
            pathsIndex: new Map([
                ["Source/Item.md", { path: "Source/Item.md", parent: "Source", name: "Item.md", type: "file" }],
            ]),
            pathStateForPath: jest.fn((path: string) => superstate.pathsIndex.get(path)),
            spacesIndex: new Map([["Container", space]]),
            spacesMap: {
                get: jest.fn(() => new Set(["spaces://#fixture", "Container"])),
                set: jest.fn(),
            },
            spaceManager: {
                pathExists: jest.fn(() => Promise.resolve(false)),
                renamePath: jest.fn(() => Promise.resolve()),
                saveSpace: jest.fn((_path: string, update: (metadata: any) => any) => {
                    space.metadata = update(space.metadata);
                    return Promise.resolve();
                }),
            },
            getSpaceItems: jest.fn(() => [
                { path: "Source/Item.md" },
                { path: "SiblingA.md" },
                { path: "SiblingB.md" },
                { path: "SiblingC.md" },
            ]),
            updateSpaceMetadata: jest.fn((_path: string, metadata: any) => {
                space.metadata = metadata;
                return Promise.resolve();
            }),
            ui: {
                notify: jest.fn(),
            },
        } as any;

        await dropPathInSpaceAtIndex(superstate, "Source/Item.md", "spaces://#fixture", "Container", 2, "move");

        expect(superstate.updateSpaceMetadata).toHaveBeenLastCalledWith("Container", expect.objectContaining({
            links: [],
            "rank-order": ["SiblingA.md", "Container/Item.md", "SiblingB.md", "SiblingC.md"],
        }));
    });

    it("does not add tags by dropping external multiple paths into a tag space", async () => {
        const tagSpacePath = "spaces://#fixture";
        const addTag = jest.fn(() => Promise.resolve());
        const superstate = {
            pathsIndex: new Map([
                ["Outside.md", { path: "Outside.md", name: "Outside", type: "file" }],
            ]),
            spacesIndex: new Map([
                [
                    tagSpacePath,
                    {
                        path: tagSpacePath,
                        name: "#fixture",
                        type: "tag",
                        metadata: {
                            sort: { field: "rank", asc: true },
                            "rank-order": [],
                        },
                    },
                ],
            ]),
            spaceManager: {
                addTag,
            },
        } as any;

        await dropPathsInSpaceAtIndex(superstate, ["Outside.md"], tagSpacePath, 0, "link");

        expect(addTag).not.toHaveBeenCalled();
    });

    it("keeps explicit link-to-tag actions working outside drag and drop", async () => {
        const tagSpacePath = "spaces://#fixture";
        const addTag = jest.fn(() => Promise.resolve());
        const superstate = {
            spacesIndex: new Map([
                [
                    tagSpacePath,
                    {
                        path: tagSpacePath,
                        name: "#fixture",
                        type: "tag",
                    },
                ],
            ]),
            spaceManager: {
            },
        } as any;

        await dropPathsInSpaceAtIndex(superstate, ["Outside.md"], tagSpacePath, -1, "link");

        expect(superstate.spacesIndex.has(tagSpacePath)).toBe(true);
    });

    it("drops before a focus-level file using the file path instead of the tree node id", async () => {
        const saveFocuses = jest.fn();
        const superstate = {
            settings: {
                currentFocus: 0,
            },
            focuses: [
                {
                    name: "Current View",
                    paths: ["RootFolder", "Anchor.md"],
                },
            ],
            pathsIndex: new Map([
                ["Inserted.md", { path: "Inserted.md", name: "Inserted", type: "file" }],
            ]),
            pathStateForPath: jest.fn((path: string) => superstate.pathsIndex.get(path)),
            spacesIndex: new Map(),
            spaceManager: {
                saveFocuses,
            },
        } as any;
        const focusFileNode: any = {
            id: "null/Anchor.md",
            parentId: null,
            depth: 0,
            type: "group",
            path: "Anchor.md",
            item: { path: "Anchor.md", type: "file", name: "Anchor" },
            rank: 1,
            collapsed: false,
            childrenCount: 0,
            sortable: false,
        };
        const insertedFromTagNode: any = {
            id: "spaces://#fixture/Inserted.md",
            parentId: "spaces://#fixture",
            depth: 1,
            type: "file",
            path: "Inserted.md",
            item: { path: "Inserted.md", type: "file", name: "Inserted" },
            rank: 0,
            collapsed: false,
            childrenCount: 0,
            sortable: true,
        };

        await dropPathInTree(
            superstate,
            "Inserted.md",
            "spaces://#fixture/Inserted.md",
            "null/Anchor.md",
            {
                depth: 0,
                overId: "null/Anchor.md",
                parentId: null,
                sortable: true,
                insert: false,
                droppable: true,
                copy: true,
                reorder: false,
                linePosition: "top",
            },
            [
                {
                    id: "RootFolder",
                    parentId: null,
                    depth: 0,
                    type: "group",
                    path: "RootFolder",
                    item: { path: "RootFolder", type: "space", name: "RootFolder" },
                    rank: 0,
                    collapsed: true,
                    childrenCount: 0,
                    sortable: true,
                } as any,
                focusFileNode,
                insertedFromTagNode,
            ],
            [{ path: "RootFolder" }, { path: "Anchor.md" }] as any,
            "link",
        );

        expect(saveFocuses).toHaveBeenCalledWith([
            {
                name: "Current View",
                paths: ["RootFolder", "Inserted.md", "Anchor.md"],
            },
        ]);
    });
});
