import MakeMDPlugin from "main";
import { FilesystemMiddleware } from "makemd-core";
import { SqlJsStatic } from "sql.js";
import { loadSQL } from "../db/sqljs";

export interface SqliteStorage {
    plugin: MakeMDPlugin;
    middleware: FilesystemMiddleware;
    sqlJS(): Promise<SqlJsStatic>;
}

export class LocalSqliteStorage implements SqliteStorage {
    constructor(
        public plugin: MakeMDPlugin,
        public middleware: FilesystemMiddleware,
    ) {}

    public async sqlJS() {
        return loadSQL();
    }
}
