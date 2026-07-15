import { addSpaceSeparator, childSpaceSort, duplicatePathNextToOriginal, moveSpaceSeparator, removeSpaceSeparator, saveSpaceMetadataValue, setSpaceSeparatorVisible, spaceSortFn, uniqueRankOrder, updatePathRankInSpace, updateSpaceSort } from "core/utils/superstate/spaces";
import { SPACE_HIDDEN_SEPARATOR_PATH, SPACE_SEPARATOR_PATH } from "schemas/builtin";

const settings = {
    defaultSpaceSort: {
        field: "name",
        asc: true,
    },
    defaultFoldersAtTop: true,
    defaultGroupBySubtags: false,
} as any;

describe("space tree sorting", () => {
    it("places sub-tags before folders and files when both grouping options are enabled", () => {
        const rows: any[] = [
            { path: "Note.md", name: "Note", type: "file", subtype: "md" },
            { path: "Folder", name: "Folder", type: "space", subtype: "folder" },
            { path: "spaces://#topic/child", name: "child", type: "space", subtype: "tag" },
        ];

        expect([...rows].sort(spaceSortFn({ field: "name", asc: true, group: true, subtags: true })).map((row) => row.path)).toEqual([
            "spaces://#topic/child",
            "Folder",
            "Note.md",
        ]);
    });

    it("keeps sub-tags before folders in custom sort even when their ranks are lower", () => {
        const rows: any[] = [
            { path: "Note.md", name: "Note", type: "file", subtype: "md", rank: 0 },
            { path: "Folder", name: "Folder", type: "space", subtype: "folder", rank: 1 },
            { path: "spaces://#topic/child", name: "child", type: "space", subtype: "tag", rank: 2 },
        ];

        expect([...rows].sort(spaceSortFn({ field: "rank", asc: true, group: true, subtags: true })).map((row) => row.path)).toEqual([
            "spaces://#topic/child",
            "Folder",
            "Note.md",
        ]);
    });

    it("uses plugin default sort for a child space without its own sort when parent sort is not recursive", () => {
        expect(childSpaceSort(undefined, { field: "rank", asc: true, recursive: false }, settings)).toEqual({
            field: "name",
            asc: true,
            group: true,
            recursive: false,
        });
    });

    it("inherits parent sort for a child space only when parent sort is recursive", () => {
        expect(childSpaceSort(undefined, { field: "rank", asc: true, recursive: true }, settings)).toEqual({
            field: "rank",
            asc: true,
            group: true,
            recursive: true,
        });
    });

    it("inherits tag grouping and ordering settings for sub-tags when recursive sorting is enabled", () => {
        expect(childSpaceSort(
            { field: "name", asc: true, group: false, subtags: false },
            { field: "rank", asc: true, group: true, subtags: true, recursive: true },
            settings,
        )).toEqual({
            field: "rank",
            asc: true,
            group: true,
            subtags: true,
            recursive: true,
        });
    });

    it("falls back to file name ascending when manual sort has no rank-order ranks", () => {
        const rows: any[] = [
            { path: "Workspace/Sample Area/2 References", name: "2 References", type: "space", rank: -1 },
            { path: "Workspace/Sample Area/0 Inbox", name: "0 Inbox", type: "space", rank: -1 },
            { path: "Workspace/Sample Area/1 Lists", name: "1 Lists", type: "space", rank: -1 },
        ];

        expect([...rows].sort(spaceSortFn({ field: "rank", asc: true, group: true, recursive: false })).map((row) => row.name)).toEqual(["0 Inbox", "1 Lists", "2 References"]);
    });

    it("keeps ranked items in rank-order before sorting unranked items by fallback fields", () => {
        const rows: any[] = [
            { path: "Projects/A New.md", name: "A New", type: "file", rank: -1 },
            { path: "Projects/Beta.md", name: "Beta", type: "file", rank: 1 },
            { path: "Projects/Alpha.md", name: "Alpha", type: "file", rank: 0 },
        ];

        expect([...rows].sort(spaceSortFn({ field: "rank", asc: true, group: true, recursive: false })).map((row) => row.name)).toEqual(["Alpha", "Beta", "A New"]);
    });
});

describe("space metadata persistence", () => {
    it("deduplicates paths without collapsing separator occurrences", () => {
        expect(uniqueRankOrder(["A.md", SPACE_SEPARATOR_PATH, "A.md", SPACE_HIDDEN_SEPARATOR_PATH])).toEqual([
            "A.md",
            SPACE_SEPARATOR_PATH,
            SPACE_HIDDEN_SEPARATOR_PATH,
        ]);
    });

    it("persists separator visibility at its rank-order occurrence", async () => {
        const space = { path: "Workspace", type: "tag", metadata: { "rank-order": ["A.md", SPACE_SEPARATOR_PATH] } } as any;
        const superstate = {
            spacesIndex: new Map([[space.path, space]]),
            updateSpaceMetadata: jest.fn((path, metadata) => {
                superstate.spacesIndex.set(path, { ...space, metadata });
                return Promise.resolve();
            }),
        } as any;

        await setSpaceSeparatorVisible(superstate, space.path, 1, false);

        expect(superstate.spacesIndex.get(space.path).metadata["rank-order"]).toEqual(["A.md", SPACE_HIDDEN_SEPARATOR_PATH]);
    });

    it("preserves two separators while reordering a regular item", async () => {
        const space = {
            path: "spaces://#fixture",
            type: "tag",
            metadata: { sort: { field: "rank" }, "rank-order": ["A.md", SPACE_SEPARATOR_PATH, "B.md", SPACE_SEPARATOR_PATH] },
        } as any;
        const superstate = {
            settings,
            spacesIndex: new Map([[space.path, space]]),
            updateSpaceMetadata: jest.fn((path, metadata) => {
                superstate.spacesIndex.set(path, { ...space, metadata });
                return Promise.resolve();
            }),
        } as any;

        await updatePathRankInSpace(superstate, "B.md", 0, space.path);

        expect(superstate.spacesIndex.get(space.path).metadata["rank-order"]).toEqual([
            "B.md",
            "A.md",
            SPACE_SEPARATOR_PATH,
            SPACE_SEPARATOR_PATH,
        ]);
    });

    it("adds a separator and switches the space to manual sorting", async () => {
        const items = [
            { path: "Workspace/Alpha.md", name: "Alpha", type: "file" },
            { path: "Workspace/Beta.md", name: "Beta", type: "file" },
        ] as any[];
        const space = {
            path: "Workspace",
            type: "folder",
            metadata: { sort: { field: "name", asc: true }, "rank-order": [] },
        } as any;
        const updateSpaceMetadata = jest.fn(() => Promise.resolve());
        const superstate = {
            settings,
            spacesIndex: new Map([[space.path, space]]),
            getSpaceItems: jest.fn(() => items),
            spaceManager: { saveSpace: jest.fn((_path, update) => Promise.resolve(update(space.metadata))) },
            updateSpaceMetadata,
        } as any;

        await addSpaceSeparator(superstate, space.path);

        expect(updateSpaceMetadata).toHaveBeenCalledWith(space.path, expect.objectContaining({
            sort: expect.objectContaining({ field: "rank", asc: true }),
            "rank-order": [items[0].path, items[1].path, SPACE_SEPARATOR_PATH],
        }));
    });

    it("moves, copies, and removes separators by their rank-order occurrence", async () => {
        const source = { path: "Source", type: "folder", metadata: { sort: { field: "rank" }, "rank-order": ["Source/A.md", SPACE_SEPARATOR_PATH, "Source/B.md"] } } as any;
        const target = { path: "spaces://#target", type: "tag", metadata: { sort: { field: "rank" }, "rank-order": ["Target/C.md"] } } as any;
        const superstate = {
            settings,
            spacesIndex: new Map([[source.path, source], [target.path, target]]),
            spaceManager: { saveSpace: jest.fn(() => Promise.resolve()) },
            updateSpaceMetadata: jest.fn((path, metadata) => {
                superstate.spacesIndex.set(path, { ...superstate.spacesIndex.get(path), metadata });
                return Promise.resolve(superstate.spacesIndex.get(path));
            }),
        } as any;

        await moveSpaceSeparator(superstate, source.path, 1, target.path, 1, true);
        expect(superstate.spacesIndex.get(source.path).metadata["rank-order"]).toEqual(["Source/A.md", SPACE_SEPARATOR_PATH, "Source/B.md"]);
        expect(superstate.spacesIndex.get(target.path).metadata["rank-order"]).toEqual(["Target/C.md", SPACE_SEPARATOR_PATH]);

        await removeSpaceSeparator(superstate, source.path, 1);
        expect(superstate.spacesIndex.get(source.path).metadata["rank-order"]).toEqual(["Source/A.md", "Source/B.md"]);
    });

    it("waits for the context file write before updating in-memory metadata", async () => {
        let finishWrite: () => void = (): void => undefined;
        const saveSpace = jest.fn(() => new Promise<void>((resolve) => {
            finishWrite = resolve;
        }));
        const updateSpaceMetadata = jest.fn(() => Promise.resolve());
        const superstate = {
            spacesIndex: new Map([["Workspace", {
                path: "Workspace",
                type: "folder",
                metadata: { "rank-order": [] },
            }]]),
            spaceManager: { saveSpace },
            updateSpaceMetadata,
        } as any;

        const saving = saveSpaceMetadataValue(superstate, "Workspace", "rank-order", ["Workspace/First.md"]);
        await Promise.resolve();

        expect(saveSpace).toHaveBeenCalled();
        expect(updateSpaceMetadata).not.toHaveBeenCalled();

        finishWrite();
        await saving;

        expect(updateSpaceMetadata).toHaveBeenCalledWith("Workspace", {
            "rank-order": ["Workspace/First.md"],
        });
    });
});

describe("duplicate manual sorting", () => {
    const createSuperstate = (sort: any) => ({
        settings,
        spacesIndex: new Map([["Projects", {
            path: "Projects",
            type: "folder",
            metadata: {
                sort,
                "rank-order": ["Projects/First.md", "Projects/Source.md", "Projects/Third.md"],
            },
        }]]),
        spaceManager: {
            copyPath: jest.fn(() => Promise.resolve("Projects/Source 1.md")),
            saveSpace: jest.fn(() => Promise.resolve()),
        },
        getSpaceItems: jest.fn((): any[] => []),
        updateSpaceMetadata: jest.fn(() => Promise.resolve()),
    } as any);

    it("places a duplicate immediately after its source in manual sort", async () => {
        const superstate = createSuperstate({ field: "rank", asc: true });

        await duplicatePathNextToOriginal(superstate, "Projects/Source.md", "Projects", "Source");

        expect(superstate.updateSpaceMetadata).toHaveBeenCalledWith("Projects", expect.objectContaining({
            "rank-order": ["Projects/First.md", "Projects/Source.md", "Projects/Source 1.md", "Projects/Third.md"],
        }));
    });

    it("does not write rank-order for non-manual sorting", async () => {
        const superstate = createSuperstate({ field: "name", asc: true });

        await duplicatePathNextToOriginal(superstate, "Projects/Source.md", "Projects", "Source");

        expect(superstate.spaceManager.copyPath).toHaveBeenCalledWith("Projects/Source.md", "Projects", "Source");
        expect(superstate.spaceManager.saveSpace).not.toHaveBeenCalled();
        expect(superstate.updateSpaceMetadata).not.toHaveBeenCalled();
    });
});

describe("updateSpaceSort", () => {
    const items = [
        { path: "Projects/Beta.md", name: "Beta", type: "file", rank: 0 },
        { path: "Projects/Folder B", name: "Folder B", type: "space", rank: 1 },
        { path: "Projects/Alpha.md", name: "Alpha", type: "file", rank: 2 },
        { path: "Projects/Folder A", name: "Folder A", type: "space", rank: 3 },
    ];
    const createSuperstate = (sort: any, rankOrder: string[] = [], spaceItems: any[] = items) => {
        const space = {
            path: "Projects",
            type: "folder",
            metadata: {
                sort,
                "rank-order": rankOrder,
            },
            space: {
                defPath: "Projects/.space/context.json",
            },
        };
        return {
            settings,
            spacesIndex: new Map([["Projects", space]]),
            spaceManager: {
                pathExists: jest.fn(() => Promise.resolve(true)),
                saveSpace: jest.fn(() => Promise.resolve()),
            },
            getSpaceItems: jest.fn(() => spaceItems),
            updateSpaceMetadata: jest.fn(() => Promise.resolve()),
        } as any;
    };

    it("removes folder grouping without dropping existing recursive sort metadata", async () => {
        const superstate = createSuperstate({ group: true, recursive: true });

        await updateSpaceSort(superstate, "Projects", { group: false });

        expect(superstate.updateSpaceMetadata).toHaveBeenCalledWith("Projects", expect.objectContaining({
            sort: {
                group: false,
                recursive: true,
            },
        }));
    });

    it("merges recursive changes into existing folder grouping sort metadata", async () => {
        const superstate = createSuperstate({ group: true });

        await updateSpaceSort(superstate, "Projects", { recursive: true });

        expect(superstate.updateSpaceMetadata).toHaveBeenCalledWith("Projects", expect.objectContaining({
            sort: {
                group: true,
                recursive: true,
            },
        }));
    });

    it("merges sort field changes without dropping grouping or recursive flags", async () => {
        const superstate = createSuperstate({ group: true, recursive: true });

        await updateSpaceSort(superstate, "Projects", { field: "mtime", asc: false });

        expect(superstate.updateSpaceMetadata).toHaveBeenCalledWith("Projects", expect.objectContaining({
            sort: {
                field: "mtime",
                asc: false,
                group: true,
                recursive: true,
            },
        }));
    });

    it("keeps explicit folder grouping and recursive false overrides when toggled off", async () => {
        const superstate = createSuperstate({ group: true, recursive: true });

        await updateSpaceSort(superstate, "Projects", { group: false, recursive: false });

        expect(superstate.updateSpaceMetadata).toHaveBeenCalledWith("Projects", expect.objectContaining({
            sort: {
                group: false,
                recursive: false,
            },
        }));
    });

    it("resets rank-order to the default sort order when clearing custom sort", async () => {
        const superstate = createSuperstate({ field: "rank", asc: true, group: false }, ["Projects/Beta.md", "Projects/Folder B", "Projects/Alpha.md", "Projects/Folder A"]);

        await updateSpaceSort(superstate, "Projects", null);

        expect(superstate.updateSpaceMetadata).toHaveBeenCalledWith("Projects", expect.objectContaining({
            sort: undefined,
            "rank-order": ["Projects/Folder A", "Projects/Folder B", "Projects/Alpha.md", "Projects/Beta.md"],
        }));
    });

    it("moves folders to the top in current rank-order when enabling folder grouping for custom sort", async () => {
        const superstate = createSuperstate({ field: "rank", asc: true, group: false }, ["Projects/Beta.md", "Projects/Folder B", "Projects/Alpha.md", "Projects/Folder A"]);

        await updateSpaceSort(superstate, "Projects", { group: true });

        expect(superstate.updateSpaceMetadata).toHaveBeenCalledWith("Projects", expect.objectContaining({
            sort: {
                field: "rank",
                asc: true,
                group: true,
            },
            "rank-order": ["Projects/Folder B", "Projects/Folder A", "Projects/Beta.md", "Projects/Alpha.md"],
        }));
    });

    it("moves folders to the top in a tag space custom rank-order", async () => {
        const superstate = createSuperstate({ field: "rank", asc: true, group: false }, ["Projects/Beta.md", "Projects/Folder B", "Projects/Alpha.md", "Projects/Folder A"]);
        const space = superstate.spacesIndex.get("Projects");
        space.type = "tag";

        await updateSpaceSort(superstate, "Projects", { group: true });

        expect(superstate.spaceManager.saveSpace).not.toHaveBeenCalled();
        expect(superstate.updateSpaceMetadata).toHaveBeenCalledWith("Projects", expect.objectContaining({
            sort: {
                field: "rank",
                asc: true,
                group: true,
            },
            "rank-order": ["Projects/Folder B", "Projects/Folder A", "Projects/Beta.md", "Projects/Alpha.md"],
        }));
    });

    it("keeps existing rank-order when switching to custom sort with folder grouping already enabled", async () => {
        const rankOrder = ["Projects/Beta.md", "Projects/Folder B", "Projects/Alpha.md", "Projects/Folder A"];
        const superstate = createSuperstate({ field: "name", asc: true, group: true }, rankOrder);

        await updateSpaceSort(superstate, "Projects", { field: "rank", asc: true });

        expect(superstate.updateSpaceMetadata).toHaveBeenCalledWith("Projects", expect.objectContaining({
            sort: {
                field: "rank",
                asc: true,
                group: true,
            },
            "rank-order": rankOrder,
        }));
    });
});
