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

import { dropPathInSpaceAtIndex, dropPathInTree, dropPathsInSpaceAtIndex } from "core/utils/dnd/dropPath";
import { linkPathToSpaceAtIndex } from "core/utils/superstate/spaces";
import i18n from "shared/i18n";

describe("dropPathInSpaceAtIndex", () => {
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
