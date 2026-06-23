import { defaultTableDataForContext } from "core/utils/contexts/contextDefaults";
import { applyContextLabelsToPaths, parseContextTableToCache } from "core/superstate/cacheParsers";
import { savePathColor } from "core/superstate/utils/label";
import { spaceSortFn } from "core/superstate/utils/spaces";
import { defaultContextFileColumns, defaultContextSchemaID } from "shared/schemas/context";
import { IndexMap } from "shared/types/indexMap";

describe("context files table", () => {
    it("builds default file rows with only path, color, and isPinned", () => {
        const superstate = {
            getSpaceItems: jest.fn(() => [
                {
                    path: "Pages/test/Name.md",
                    name: "Name",
                    label: { color: "#e30d0d", sticker: "emoji//1f916" },
                    metadata: {
                        file: {
                            isFolder: false,
                            name: "Name",
                            extension: "md",
                            ctime: 1775784507240,
                            mtime: 1775785141924,
                        },
                    },
                },
            ]),
        };

        const table = defaultTableDataForContext(superstate as any, { path: "Pages/test" } as any);

        expect(table.schema.id).toBe(defaultContextSchemaID);
        expect(table.cols.map((col) => col.name)).toEqual(defaultContextFileColumns);
        expect(table.rows[0]).toEqual({
            path: "Pages/test/Name.md",
            color: "#e30d0d",
            isPinned: "false",
        });
        expect(table.rows[0]).not.toHaveProperty("size");
        expect(table.rows[0]).not.toHaveProperty("Created");
        expect(table.rows[0]).not.toHaveProperty("File");
        expect(table.rows[0]).not.toHaveProperty("isFolder");
        expect(table.rows[0]).not.toHaveProperty("name");
        expect(table.rows[0]).not.toHaveProperty("extension");
        expect(table.rows[0]).not.toHaveProperty("ctime");
        expect(table.rows[0]).not.toHaveProperty("mtime");
        expect(table.rows[0]).not.toHaveProperty("sticker");
    });

    it("marks folder rows with a trailing slash and never stores folder color", () => {
        const superstate = {
            getSpaceItems: jest.fn(() => [
                {
                    path: "Folders/Obsidian",
                    name: "Obsidian",
                    label: { color: "#e30d0d", sticker: "emoji//1f4c1" },
                    metadata: {
                        file: {
                            isFolder: true,
                            name: "Obsidian",
                            ctime: 1775784507240,
                            mtime: 1775785141924,
                        },
                    },
                },
            ]),
        };

        const table = defaultTableDataForContext(superstate as any, { path: "Folders" } as any);

        expect(table.rows[0]).toEqual({
            path: "Folders/Obsidian/",
            color: "",
            isPinned: "false",
        });
    });

    it("moves persisted file color into the path state during context parsing", () => {
        const fileState = {
            path: "Note.md",
            name: "Note",
            type: "file",
            subtype: "md",
            label: { color: "", sticker: "ui//file-text" },
            metadata: { file: { name: "Note", extension: "md", isFolder: false } },
            tags: [] as string[],
            spaces: ["Vault"],
            outlinks: [] as string[],
        };
        const folderState = {
            path: "Folder",
            name: "Folder",
            type: "space",
            subtype: "folder",
            label: { color: "#defjson", sticker: "emoji//1f4c1" },
            metadata: { file: { name: "Folder", isFolder: true } },
            tags: [] as string[],
            spaces: ["Vault"],
            outlinks: [] as string[],
        };
        const pathsIndex = new Map([
            ["Note.md", fileState as any],
            ["Folder", folderState as any],
        ]);
        const mdb = {
            files: {
                schema: { id: "files", name: "Items", type: "db", primary: "true" },
                cols: defaultContextFileColumns.map((name) => ({ name, schemaId: "files", type: "text" })),
                rows: [
                    { path: "Note.md", color: "#e30d0d", sticker: "emoji//1f916", size: "999", ctime: "1" },
                    { path: "Folder/", color: "#should-not-apply", sticker: "emoji//1f916" },
                ],
            },
        };

        const result = parseContextTableToCache(
            { path: "Vault" } as any,
            mdb as any,
            ["Note.md", "Folder"],
            true,
            pathsIndex,
            new IndexMap(),
            {} as any,
            new Map(),
            {},
        );

        applyContextLabelsToPaths(result.cache.contextTable, pathsIndex);

        expect(pathsIndex.get("Note.md")?.label).toEqual({
            color: "#e30d0d",
            sticker: "ui//file-text",
        });
        expect(pathsIndex.get("Folder")?.label).toEqual({
            color: "#defjson",
            sticker: "emoji//1f4c1",
        });
        expect(result.cache.contextTable.rows[0]).not.toHaveProperty("size");
        expect(result.cache.contextTable.rows[0]).not.toHaveProperty("ctime");
        expect(result.cache.contextTable.rows[0]).not.toHaveProperty("sticker");
        expect(result.cache.contextTable.rows[1]).toEqual({
            path: "Folder/",
            color: "",
            isPinned: "false",
        });
    });
});

describe("context file sorting", () => {
    it("sorts ctime and mtime numerically from file metadata", () => {
        const rows: any[] = [
            { path: "large.md", type: "file", metadata: { file: { ctime: 20, mtime: 300 } } },
            { path: "small.md", type: "file", metadata: { file: { ctime: 3, mtime: 40 } } },
        ];

        expect([...rows].sort(spaceSortFn({ field: "ctime", asc: true, group: false, recursive: false })).map((row) => row.path)).toEqual(["small.md", "large.md"]);
        expect([...rows].sort(spaceSortFn({ field: "mtime", asc: true, group: false, recursive: false })).map((row) => row.path)).toEqual(["small.md", "large.md"]);
    });
});

describe("savePathColor", () => {
    it("persists file color into context.mdb files rows instead of path labels", async () => {
        const saveLabel = jest.fn();
        const saveTable = jest.fn(() => Promise.resolve(true));
        const dispatchEvent = jest.fn();
        const contextTable = {
            schema: { id: defaultContextSchemaID, name: "Items", type: "db", primary: "true" },
            cols: defaultContextFileColumns.map((name) => ({ name, schemaId: defaultContextSchemaID, type: "text" })),
            rows: [{ path: "Note.md", color: "" }],
        };
        const superstate = {
            pathsIndex: new Map([["Note.md", { path: "Note.md", label: { color: "", sticker: "" }, spaces: ["Vault"] }]]),
            spacesIndex: new Map([["Vault", { path: "Vault", space: { path: "Vault" } }]]),
            spaceManager: {
                contextForSpace: jest.fn(() => Promise.resolve(contextTable)),
                saveTable,
                saveLabel,
            },
            dispatchEvent,
        };

        await savePathColor(superstate as any, "Note.md", "#e30d0d");

        expect(saveLabel).not.toHaveBeenCalled();
        expect(saveTable).toHaveBeenCalledWith(
            "Vault",
            expect.objectContaining({
                rows: [{ path: "Note.md", color: "#e30d0d", isPinned: "false" }],
            }),
            true,
        );
        expect(superstate.pathsIndex.get("Note.md")?.label.color).toBe("#e30d0d");
        expect(dispatchEvent).toHaveBeenCalledWith("pathStateUpdated", { path: "Note.md" });
    });

    it("does not persist folder color into context.mdb files rows", async () => {
        const saveTable = jest.fn(() => Promise.resolve(true));
        const saveSpace = jest.fn();
        const updateSpaceMetadata = jest.fn(() => Promise.resolve(true));
        const dispatchEvent = jest.fn();
        const contextTable = {
            schema: { id: defaultContextSchemaID, name: "Items", type: "db", primary: "true" },
            cols: defaultContextFileColumns.map((name) => ({ name, schemaId: defaultContextSchemaID, type: "text" })),
            rows: [{ path: "Folder/", color: "" }],
        };
        const superstate = {
            pathsIndex: new Map([["Folder", { path: "Folder", type: "space", subtype: "folder", label: { color: "", sticker: "emoji//1f4c1" }, spaces: ["Vault"], metadata: { file: { isFolder: true } } }]]),
            spacesIndex: new Map([
                ["Vault", { path: "Vault", space: { path: "Vault" } }],
                ["Folder", { path: "Folder", space: { path: "Folder" }, metadata: { defaultColor: "" } }],
            ]),
            spaceManager: {
                contextForSpace: jest.fn(() => Promise.resolve(contextTable)),
                saveTable,
                saveSpace,
            },
            updateSpaceMetadata,
            dispatchEvent,
        };

        await savePathColor(superstate as any, "Folder", "#e30d0d");

        expect(saveTable).not.toHaveBeenCalled();
        expect(saveSpace).toHaveBeenCalledWith("Folder", expect.any(Function));
        expect(updateSpaceMetadata).toHaveBeenCalledWith("Folder", { defaultColor: "#e30d0d" });
        expect(superstate.pathsIndex.get("Folder")?.label.color).toBe("");
        expect(dispatchEvent).not.toHaveBeenCalled();
    });
});
