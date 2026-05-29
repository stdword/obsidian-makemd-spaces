import { defaultTableDataForContext } from "core/utils/contexts/contextDefaults";
import { savePathColor } from "core/superstate/utils/label";
import { spaceSortFn } from "core/superstate/utils/spaces";
import { defaultContextFileColumns, defaultContextSchemaID } from "shared/schemas/context";

describe("context files table", () => {
    it("builds default rows from file metadata without Created", () => {
        const superstate = {
            getSpaceItems: jest.fn(() => [
                {
                    path: "Pages/test/Name.md",
                    name: "Name",
                    label: { color: "#e30d0d", sticker: "" },
                    metadata: {
                        file: {
                            isFolder: false,
                            name: "Name",
                            extension: "md",
                            ctime: 1775784507240,
                            mtime: 1775785141924,
                            size: 759,
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
            size: "759",
            color: "#e30d0d",
        });
        expect(table.rows[0]).not.toHaveProperty("Created");
        expect(table.rows[0]).not.toHaveProperty("File");
    });

    it("stores an empty size for folder rows", () => {
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
            size: "",
        });
    });
});

describe("context file sorting", () => {
    it("sorts ctime, mtime, and size numerically from context rows", () => {
        const rows: any[] = [
            { path: "large.md", type: "file", ctime: "20", mtime: "300", size: "100" },
            { path: "small.md", type: "file", ctime: "3", mtime: "40", size: "9" },
        ];

        expect([...rows].sort(spaceSortFn({ field: "ctime", asc: true, group: false, recursive: false })).map((row) => row.path)).toEqual(["small.md", "large.md"]);
        expect([...rows].sort(spaceSortFn({ field: "mtime", asc: true, group: false, recursive: false })).map((row) => row.path)).toEqual(["small.md", "large.md"]);
        expect([...rows].sort(spaceSortFn({ field: "size", asc: true, group: false, recursive: false })).map((row) => row.path)).toEqual(["small.md", "large.md"]);
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
