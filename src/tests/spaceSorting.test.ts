import { childSpaceSort, spaceSortFn, updateSpaceSort } from "core/superstate/utils/spaces";

const settings = {
    defaultSpaceSort: {
        field: "name",
        asc: true,
    },
    defaultFoldersAtTop: true,
} as any;

describe("space tree sorting", () => {
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

    it("falls back to file name ascending when manual sort has no rank-order ranks", () => {
        const rows: any[] = [
            { path: "Atlas/AI/2 Resources", name: "2 Resources", type: "space", rank: -1 },
            { path: "Atlas/AI/0 Notes", name: "0 Notes", type: "space", rank: -1 },
            { path: "Atlas/AI/1 Collections", name: "1 Collections", type: "space", rank: -1 },
        ];

        expect([...rows].sort(spaceSortFn({ field: "rank", asc: true, group: true, recursive: false })).map((row) => row.name)).toEqual(["0 Notes", "1 Collections", "2 Resources"]);
    });
});

describe("updateSpaceSort", () => {
    const createSuperstate = (sort: any) => {
        const space = {
            path: "Projects",
            type: "folder",
            metadata: {
                sort,
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
});
