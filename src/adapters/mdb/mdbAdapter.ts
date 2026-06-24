import { mdbTablesToDBTables, saveDBToPath } from "adapters/mdb/db/db";
import { deleteMDBTable, getMDB, getMDBTable, getMDBTableProperties, getMDBTableSchemas, getMDBTables } from "adapters/mdb/utils/mdb";
import MakeMDPlugin from "main";
import { AFile, FileTypeAdapter, FilesystemMiddleware } from "makemd-core";
import { SPACE_CONTEXT_FILE } from "shared/constants";
import { defaultContextSchemaID } from "shared/schemas/context";
import { fieldSchema } from "shared/schemas/fields";
import { DBTable, DBTables, MDB, SpaceProperty, SpaceTable, SpaceTableSchema, SpaceTables } from "shared/types/mdb";
import { loadSQL } from "./db/sqljs";
import { deletePropertyToDBTables, savePropertyToDBTables } from "./utils/property";
import { saveSchemaToDBTables } from "./utils/schema";
type MDBContent = {
    schema: SpaceTableSchema;
    schemas: SpaceTableSchema[];
    field: SpaceProperty;
    fields: SpaceProperty[];
    table: DBTable;
    tables: DBTables;
    mdbTable: SpaceTable;
    mdbTables: SpaceTables;
};

export class MDBFileTypeAdapter implements FileTypeAdapter<MDB, MDBContent> {
    constructor(public plugin: MakeMDPlugin) {}
    public async sqlJS() {
        // console.time("Loading SQlite");
        const sqljs = await loadSQL();
        // console.timeEnd("Loading SQlite");
        return sqljs;
    }
    public async newFile(parent: string, name: string, type: string, content?: DBTables) {
        const newPath = `${parent}/${name}.${type}`;
        await saveDBToPath(this, newPath, content, newPath.split("/").pop() != SPACE_CONTEXT_FILE);

        return this.middleware.getFile(newPath);
    }

    public supportedFileTypes = ["mdb"];
    public id = "mdb.make.md";
    public cache: Map<string, MDB>;
    public middleware: FilesystemMiddleware;
    public initiate(middleware: FilesystemMiddleware) {
        this.middleware = middleware;
        this.cache = new Map();
    }

    public async parseCache(file: AFile, refresh: boolean) {
        await getMDB(this, file.path)
            .then((mdb) => {
                if (!mdb) {
                    return false;
                }
                this.cache.set(file.path, {
                    schemas: mdb.schemas ?? [],
                    fields: mdb.fields,
                    tables: mdb.tables,
                });
                return true;
            })
            .then((f) => {
                if (f) this.middleware.updateFileCache(file.path, this.cache.get(file.path), refresh);
            });
    }

    public contentTypes(_file: AFile) {
        return ["schemas", "fields", "tables", "field", "table", "schema", "field", "mdbTable", "mdbTables"] as Array<keyof MDBContent>;
    }
    public cacheTypes(_file: AFile) {
        return ["schemas", "fields", "tables"] as Array<keyof MDB>;
    }
    public getCacheTypeByRefString(_file: AFile, _refString: string) {
        return null as any;
    }
    public getCache(file: AFile, fragmentType: keyof MDB, _query?: string) {
        return this.cache.get(file.path)[fragmentType];
    }
    public async readContent(file: AFile, fragmentType: keyof MDBContent, fragmentId: any): Promise<MDBContent[typeof fragmentType]> {
        if (fragmentType == "table") {
            return this.cache.get(file.path)["tables"][fragmentId];
        }
        if (fragmentType == "schema") {
            const schema = this.cache.get(file.path)["schemas"].find((t) => t.id == fragmentId);
            if (schema) {
                return schema;
            }
            return getMDBTableSchemas(this, file.path).then((f) => f.find((t) => t.id == fragmentId));
        }
        if (fragmentType == "schemas") {
            return getMDBTableSchemas(this, file.path);
            // return this.cache.get(file.path)[fragmentType]
        }
        if (fragmentType == "fields") {
            return getMDBTableProperties(this, file.path) ?? [];
        }

        if (fragmentType == "mdbTables") {
            return getMDBTables(this, file.path);
        }
        if (fragmentType == "mdbTable") {
            return getMDBTable(this, file.path, fragmentId);

            //    const table = this.readFragment(file, 'table', fragmentId) as DBTable;
            //    const schema = this.readFragment(file, 'schema', fragmentId) as MDBSchema;
            //    const fields = this.readFragment(file, 'fields', fragmentId) as MDBField[];
            //     return dbTableToMDBTable(table, schema, fields)
        }
    }
    public async newContent(file: AFile, fragmentType: keyof MDBContent, name: string, content: any, _options: { [key: string]: any }) {
        if (fragmentType == "schema") {
            const schemas = (await this.readContent(file, "schemas", null)) as SpaceTableSchema[];
            const dbTables = saveSchemaToDBTables(content, schemas);
            return saveDBToPath(this, file.path, dbTables);
        }
        if (fragmentType == "field") {
            const oldFields = (await this.readContent(file, "fields", null)) as SpaceProperty[];
            const dbTables = savePropertyToDBTables(content, oldFields);

            return saveDBToPath(this, file.path, dbTables);
        }
        if (fragmentType == "table") {
            return saveDBToPath(this, file.path, { [name]: content });
        }
        if (fragmentType == "tables") {
            return saveDBToPath(this, file.path, content);
        }
        if (fragmentType == "mdbTable") {
            return saveDBToPath(this, file.path, mdbTablesToDBTables({ [name]: content }), file.path.split("/").pop() != SPACE_CONTEXT_FILE);
        }
    }
    public async saveContent(file: AFile, fragmentType: keyof MDBContent, fragmentId: any, content: (prev: any) => any) {
        if (fragmentType == "schema") {
            const schemas = ((await this.readContent(file, "schemas", null)) as SpaceTableSchema[]) ?? [];
            const dbTables = saveSchemaToDBTables(content(schemas.find((t) => t.id == fragmentId)), schemas);
            return saveDBToPath(this, file.path, dbTables);
        }
        if (fragmentType == "field") {
            const oldFields = (await this.readContent(file, "fields", null)) as SpaceProperty[];
            const oldField = oldFields.find((t) => t.name == fragmentId.name && t.schemaId == fragmentId.schemaId);
            const dbTables = savePropertyToDBTables(content(oldField), oldFields, oldField);
            return saveDBToPath(this, file.path, dbTables);
        }
        if (fragmentType == "table") {
            return saveDBToPath(this, file.path, { [fragmentId]: content(this.cache.get(file.path)["tables"][fragmentId]) });
        }
        if (fragmentType == "mdbTable") {
            const mdbTable = await this.readContent(file, "mdbTable", fragmentId);
            const tables = { [fragmentId]: content(mdbTable) };
            if (file.path.split("/").pop() == SPACE_CONTEXT_FILE && fragmentId == defaultContextSchemaID) {
                return saveDBToPath(this, file.path, mdbTablesToDBTables(tables), false);
            }
            const oldFields = (await this.readContent(file, "fields", null)) as SpaceProperty[];
            const newFields = {
                m_fields: {
                    uniques: fieldSchema.uniques,
                    cols: fieldSchema.cols,
                    rows: [...oldFields.filter((f) => f.schemaId != fragmentId), ...Object.values(tables).flatMap((f) => f.cols)],
                },
            };
            return saveDBToPath(this, file.path, { ...mdbTablesToDBTables(tables), ...newFields });
        }
    }
    public async deleteContent(file: AFile, fragmentType: keyof MDBContent, fragmentId: any) {
        if (fragmentType == "schema") {
            return deleteMDBTable(this, fragmentId, file.path);
        }
        if (fragmentType == "field") {
            const fields = (await this.readContent(file, "fields", null)) as SpaceProperty[];
            const field = fields.find((t) => t.name == fragmentId.name && t.schemaId == fragmentId.schemaId);
            if (!field) return;
            const dbTables = deletePropertyToDBTables(field, fields);
            return saveDBToPath(this, file.path, dbTables);
        }
        if (fragmentType == "table") {
            return deleteMDBTable(this, fragmentId, file.path);
        }
    }
}
