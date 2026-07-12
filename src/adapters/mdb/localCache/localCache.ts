import { dbResultsToDBTables, deleteFromDB, dropTable, getZippedDB, insertIntoDB, replaceDB, saveZippedDBFile, selectDB } from "adapters/mdb/db/db";
import { debounce } from "lodash";
import { CacheDBSchema } from "schemas/cache";
import { DBRow, DBTable, DBTables } from "shared/types/mdb";
import { sanitizeSQLStatement } from "utils/sanitizers";
import { Database } from "sql.js";
import { LocalCachePersister } from "shared/types/persister";
import { ZippedSqliteStorage } from "./sqliteStorage";

/** Simpler wrapper for a file-backed cache for arbitrary metadata. */
export class LocalStorageCache implements LocalCachePersister {
    public db: Database;
    private initialized: boolean;
    private dirty = false;
    public indexVersion = Date.now().toString();
    private defaultTables : DBTables;
    public constructor(public storageDBPath: string, private storage: ZippedSqliteStorage, types: string[]) {
        this.defaultTables = types.reduce((acc, type) => ({...acc, [type]: CacheDBSchema}), {})
    }

    public async unload() {
        this.debounceSaveSpaceDatabase.cancel();
        await this.saveNow();
        this.initialized = false;
        this.db?.close();
    }
    public async initialize () {

        this.db = await getZippedDB(this.storage, await this.storage.sqlJS(), this.storageDBPath);
        let tables: DBTable[];
        try {
            tables =  dbResultsToDBTables(
                this.db.exec(
                    "SELECT name FROM sqlite_schema WHERE type ='table' AND name NOT LIKE 'sqlite_%';"
                    )
            );
            } catch (e) {
                this.storage.plugin.superstate.ui.error(e);
            tables = [];
            }
        if (tables.length == 0) {
            replaceDB(this.db, this.defaultTables);
        } else {
            tables
                .flatMap((table) => table.rows.map((row: DBRow) => row.name as string))
                .filter((tableName) => !this.defaultTables[tableName])
                .forEach((tableName) => dropTable(this.db, tableName));
        }
        this.initialized = true;
    }

    public isInitialized() {
        return this.initialized;
    }
    public reset() {
        if (!this.initialized) return;
        replaceDB(this.db, this.defaultTables);
    }
    /** Store file metadata by path. */
    public async store(path: string, cache: string, type: string, version = this.indexVersion): Promise<void> {
        if (!this.initialized) return;
        if (!this.db) return;

        await insertIntoDB(this.db, {
            [type]: {...this.defaultTables[type], rows: [{ path, cache, version }]},
        }, true)
        this.dirty = true;
        this.debounceSaveSpaceDatabase();
        return;
    }
    public async remove(path: string, type: string): Promise<void> {
        if (!this.initialized) return;
        if (!this.db) return;
        await deleteFromDB(this.db, type, `path='${sanitizeSQLStatement(path)}'`)
        this.dirty = true;
        this.debounceSaveSpaceDatabase();
        return;
    }
    public cleanType (type: string) {
        if (!this.initialized) return;
        if (!this.db) return;
        deleteFromDB(this.db, type, `version != '${this.indexVersion}' AND version != ''`)
        return;
    }
    private saveNow = async () => {
        if (!this.initialized) return;
        if (!this.db) return;
        if (!this.dirty) return;
        this.dirty = false;
        await saveZippedDBFile(this.storage, this.storageDBPath, this.db.export().buffer as ArrayBuffer);
    };

    private debounceSaveSpaceDatabase = debounce(
      () => this.saveNow(),
      5000,
      {
          leading: false,
      })

    /** Obtain a list of all persisted files. */
    public async loadAll(type: string): Promise<DBRow[]> {
        if (!this.initialized) return [];
        if (!this.db) return [];
        return selectDB(this.db, type)?.rows ?? []
    }
}
