import initSqlJs from "sql.js";
import { replaceDB } from "adapters/mdb/db/db";
import { defaultContextFileColumns, defaultContextSchemaID } from "shared/schemas/fields";

describe("mdb db schema", () => {
    it("creates isPinned as a BOOLEAN column in the context files table", async () => {
        const SQL = await initSqlJs();
        const db = new SQL.Database();

        replaceDB(db, {
            [defaultContextSchemaID]: {
                uniques: ["path"],
                cols: defaultContextFileColumns,
                rows: [{ path: "Note.md", color: "", isPinned: "false" }],
            },
        });

        const tableInfo = db.exec(`PRAGMA table_info("${defaultContextSchemaID}")`)[0];
        const typeIndex = tableInfo.columns.indexOf("type");
        const nameIndex = tableInfo.columns.indexOf("name");
        const isPinned = tableInfo.values.find((row) => row[nameIndex] == "isPinned");

        expect(isPinned?.[typeIndex]).toBe("BOOLEAN");
        db.close();
    });
});
