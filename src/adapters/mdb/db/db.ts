import { getParentPathFromString } from "utils/path";

import JSZip from "jszip";
import { DBTable, DBTables } from "shared/types/mdb";
import { uniq } from "utils/array";
import { removeTrailingSlashFromFolder } from "utils/paths";
import { sanitizeSQLStatement } from "utils/sanitizers";
import { Database, QueryExecResult, SqlJsStatic } from "sql.js";
import { serializeSQLFieldNames, serializeSQLStatements, serializeSQLValues } from "utils/serializers";
import { ZippedSqliteStorage } from "../localCache/sqliteStorage";

JSZip.support.nodebuffer = false;

export const getZippedDB = async (storage: ZippedSqliteStorage, sqlJS: SqlJsStatic, path: string) => {
    const buf = await getZippedDBFile(storage, path);
    if (buf) {
        const db = await new sqlJS.Database(new Uint8Array(buf));
        try {
            db.exec("SELECT name FROM sqlite_schema");
        } catch {
            return new sqlJS.Database();
        }
        return db;
    }
    return new sqlJS.Database();
};

export const getZippedDBFile = async (storage: ZippedSqliteStorage, path: string) => {
    if (!(await storage.middleware.fileExists(path))) {
        return null;
    }
    const zip = new JSZip();

    const file = await storage.middleware.readBinaryToFile(path);
    let buffer;
    try {
        buffer = await zip.loadAsync(file).then(() => zip.file("data.mdb").async("arraybuffer"));
    } catch (e) {
        // empty
    }
    return buffer;
};

export const saveZippedDBFile = async (storage: ZippedSqliteStorage, path: string, binary: ArrayBuffer) => {
    if (!(await storage.middleware.fileExists(removeTrailingSlashFromFolder(getParentPathFromString(path))))) {
        await storage.middleware.createFolder(getParentPathFromString(path));
    }
    const zip = new JSZip();
    zip.file("data.mdb", binary);
    const zipFile = await zip.generateAsync({
        type: "arraybuffer",
        compression: "DEFLATE",
        compressionOptions: {
            level: 5,
        },
    });
    const file = storage.middleware.writeBinaryToFile(path, zipFile);
    return file;
};

export const dbResultsToDBTables = (res: QueryExecResult[]): DBTable[] => {
    return res.reduce(
        (p, c) => [
            ...p,
            {
                cols: c.columns,
                rows: c ? c.values.map((r) => c.columns.reduce((prev, curr, index) => ({ ...prev, [curr]: r[index] }), {})) : [],
            },
        ],
        [],
    ) as DBTable[];
};

export const selectDB = (db: Database, table: string, condition?: string, fields?: string): DBTable | null => {
    const fieldsStr = fields ?? "*";
    const sqlstr = condition ? `SELECT ${fieldsStr} FROM "${table}" WHERE ${condition};` : `SELECT ${fieldsStr} FROM ${table};`;
    let tables;
    try {
        tables = dbResultsToDBTables(db.exec(sqlstr)); // Run the query without returning anything
    } catch (e) {
        return null;
    }
    if (tables.length == 1) return tables[0];
    return null;
};

export const insertIntoDB = (db: Database, tables: DBTables, replace?: boolean) => {
    const sqlstr = serializeSQLStatements(
        Object.keys(tables).map((t) => {
            const tableFields = tables[t].cols;
            const rowsQuery = tables[t].rows.reduce((prev, curr) => {
                return `${prev} ${replace ? "REPLACE" : "INSERT"} INTO "${t}" VALUES (${serializeSQLValues(tableFields.map((c) => `'${sanitizeSQLStatement(curr?.[c]) ?? ""}'`))});`;
            }, "");
            return rowsQuery;
        }),
    );
    try {
        db.exec(`${sqlstr}`);
    } catch (e) {
        // empty
    }
};

export const deleteFromDB = (db: Database, table: string, condition: string) => {
    const sqlstr = `DELETE FROM "${table}" WHERE ${condition};`;
    // Run the query without returning anything
    try {
        db.exec(sqlstr);
    } catch (e) {
        // empty
    }
};

export const dropTable = (db: Database, table: string) => {
    const sqlstr = `DROP TABLE IF EXISTS "${table}";`;
    // Run the query without returning anything
    try {
        db.exec(sqlstr);
    } catch (e) {
        // empty
    }
};

export const replaceDB = (db: Database, tables: DBTables) => {
    //rewrite the entire table, useful for storing ranks and col order, not good for performance
    const sqlStatements: string[] = [];
    Object.keys(tables).forEach((t) => {
        const tableFields = tables[t].cols;
        const fieldQuery = serializeSQLFieldNames(
            uniq(tableFields)
                .filter((f) => f)
                .map((f) => `'${sanitizeSQLStatement(f)}' char`),
        );

        const createQuery = `CREATE TABLE IF NOT EXISTS "${t}" (${fieldQuery}); `;
        const idxQuery = tables[t].uniques
            .filter((f) => f)
            .reduce((p, c) => {
                return `${p} CREATE UNIQUE INDEX IF NOT EXISTS "idx_${t}_${c.replace(/,/g, "_")}" ON "${t}"(${c});`;
            }, "");
        const beginTransaction = `BEGIN TRANSACTION;`;
        const rowsQuery = tables[t].rows.map((curr) => {
            return `REPLACE INTO "${t}" VALUES (${serializeSQLValues(tableFields.map((c) => `'${sanitizeSQLStatement(curr?.[c] ?? "")}'`))});`;
        });
        const commitQuery = `COMMIT;`;
        sqlStatements.push(`DROP INDEX IF EXISTS "idx_${t}__id"; DROP TABLE IF EXISTS "${t}";`);
        if (fieldQuery.length > 0) {
            sqlStatements.push(createQuery);
            sqlStatements.push(idxQuery);
            sqlStatements.push(beginTransaction);
            sqlStatements.push(...rowsQuery);
            sqlStatements.push(commitQuery);
        }
    });
    // Run the query without returning anything
    try {
        for (const s of sqlStatements) {
            db.exec(s);
        }
    } catch (e) {
        return false;
    }
    return true;
};
