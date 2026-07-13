import { childSpaceSort, saveSpaceMetadataValue, spaceSortFn, updateSpaceSort } from "core/utils/superstate/spaces";

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
