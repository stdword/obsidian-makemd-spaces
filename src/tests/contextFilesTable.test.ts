import { defaultTableDataForContext } from "core/utils/contexts/contextDefaults";
import { applyContextLabelsToPaths, parseContextTableToCache } from "core/superstate/cacheParsers";
import { savePathColor } from "core/superstate/utils/label";
import { spaceSortFn } from "core/superstate/utils/spaces";
import { defaultContextFileColumns, defaultContextSchemaID } from "shared/schemas/context";
import { IndexMap } from "shared/types/indexMap";
import { savePathSticker } from "shared/utils/sticker";

describe("context files table", () => {
    it("builds default rows from file metadata without Created", () => {
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
            isFolder: "false",
            name: "Name",
            extension: "md",
            ctime: "1775784507240",
            mtime: "1775785141924",
            color: "#e30d0d",
            sticker: "emoji//1f916",
        });
        expect(table.rows[0]).not.toHaveProperty("size");
        expect(table.rows[0]).not.toHaveProperty("Created");
        expect(table.rows[0]).not.toHaveProperty("File");
    });

    it("does not store size for folder rows", () => {
        const superstate = {
            getSpaceItems: jest.fn(() => [
                {
                    path: "Folders/Obsidian",
                    name: "Obsidian",
                    label: { color: "", sticker: "" },
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

        expect(table.rows[0]).toMatchObject({
            path: "Folders/Obsidian",
            isFolder: "true",
            name: "Obsidian",
            extension: "",
            sticker: "",
        });
        expect(table.rows[0]).not.toHaveProperty("size");
    });

    it("moves persisted color and sticker into the path state during context parsing", () => {
        const pathState = {
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
        const pathsIndex = new Map([["Note.md", pathState as any]]);
        const mdb = {
            files: {
                schema: { id: "files", name: "Items", type: "db", primary: "true" },
                cols: defaultContextFileColumns.map((name) => ({ name, schemaId: "files", type: "text" })),
                rows: [{ path: "Note.md", color: "#e30d0d", sticker: "emoji//1f916", size: "999" }],
            },
        };

        const result = parseContextTableToCache(
            { path: "Vault" } as any,
            mdb as any,
            ["Note.md"],
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
            sticker: "emoji//1f916",
        });
        expect(result.cache.contextTable.rows[0]).not.toHaveProperty("size");
    });
});

describe("context file sorting", () => {
    it("sorts ctime and mtime numerically from context rows", () => {
        const rows: any[] = [
            { path: "large.md", type: "file", ctime: "20", mtime: "300" },
            { path: "small.md", type: "file", ctime: "3", mtime: "40" },
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
                rows: [{ path: "Note.md", color: "#e30d0d" }],
            }),
            true,
        );
        expect(superstate.pathsIndex.get("Note.md")?.label.color).toBe("#e30d0d");
        expect(dispatchEvent).toHaveBeenCalledWith("pathStateUpdated", { path: "Note.md" });
    });
});

describe("savePathSticker", () => {
    it("persists file sticker into context.mdb files rows and updates the path state", async () => {
        const saveLabel = jest.fn();
        const saveTable = jest.fn(() => Promise.resolve(true));
        const dispatchEvent = jest.fn();
        const contextTable = {
            schema: { id: defaultContextSchemaID, name: "Items", type: "db", primary: "true" },
            cols: defaultContextFileColumns.map((name) => ({ name, schemaId: defaultContextSchemaID, type: "text" })),
            rows: [{ path: "Note.md", sticker: "ui//file-text" }],
        };
        const superstate = {
            pathsIndex: new Map([["Note.md", { path: "Note.md", label: { color: "", sticker: "ui//file-text" }, spaces: ["Vault"] }]]),
            spacesIndex: new Map([["Vault", { path: "Vault", space: { path: "Vault" } }]]),
            spaceManager: {
                contextForSpace: jest.fn(() => Promise.resolve(contextTable)),
                saveTable,
                saveLabel,
            },
            dispatchEvent,
        };

        await savePathSticker(superstate as any, "Note.md", "emoji//1f916");

        expect(saveLabel).not.toHaveBeenCalled();
        expect(saveTable).toHaveBeenCalledWith(
            "Vault",
            expect.objectContaining({
                rows: [{ path: "Note.md", sticker: "emoji//1f916" }],
            }),
            true,
        );
        expect(superstate.pathsIndex.get("Note.md")?.label.sticker).toBe("emoji//1f916");
        expect(dispatchEvent).toHaveBeenCalledWith("pathStateUpdated", { path: "Note.md" });
    });
});
