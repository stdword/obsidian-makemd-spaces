import { parseFieldValue } from "core/schemas/parseFieldValue";
import i18n from "shared/i18n";
import { PathPropertyName } from "shared/types/context";
import { DBTable, DBTables, SpaceProperty, SpaceTable, SpaceTableSchema } from "shared/types/mdb";
import { SpaceInfo } from "shared/types/spaceInfo";
import { safelyParseJSON } from "shared/utils/json";
import { parsePropString } from "utils/parsers";
import { defaultContextDBSchema, defaultContextSchemaID } from "../shared/schemas/context";
import { defaultContextFields, defaultTagFields } from "../shared/schemas/fields";

export const fieldTypeForField = (f: SpaceProperty) => {
    if (!f) return null;
    return f.type == "fileprop" ? (parseFieldValue(f.value, "fileprop")?.type ?? "text") : f.type;
};

export const stickerForField = (f: SpaceProperty) => (f.attrs?.length > 0 ? (safelyParseJSON(f.attrs)?.icon ?? fieldTypeForType(f.type, f.name)?.icon) : fieldTypeForType(f.type, f.name)?.icon);

export const fieldTypeForType = (type: string, name?: string) => (
    name == PathPropertyName
    ? {
        type: "file",
        icon: "",
        label: "properties.file.label",
        restricted: true,
    }
    : {
        type: "fileprop",
        icon: "",
        label: "properties.fileProperty.label",
        configKeys: ["field", "value", "type", "format"],
        flex: true,
    }
)

export const defaultValueForPropertyType = (name: string, value: string, type: string) => {
    if (type == "fileprop") {
        const { field, property } = parsePropString(value);
        if (property == "ctime" || property == "mtime") return (Date.now() - 60).toString();
        return value;
    }
    return "";
};
export const defaultFrameListViewID = "filesView";
export const defaultFrameListViewSchema: SpaceTableSchema = {
    id: defaultFrameListViewID,
    name: "All",
    type: "view",
    def: JSON.stringify({ db: defaultContextSchemaID, icon: "ui//file-stack" }),
};

export const mainFrameID = "main";

export const defaultMainFrameSchema = (id: string) => ({ id, name: id, type: "frame", def: "", predicate: "", primary: "true" });

export const defaultFramesTable: DBTable = {
    uniques: [],
    cols: ["id", "name", "type", "def", "predicate", "primary"],
    rows: [defaultMainFrameSchema(mainFrameID), defaultFrameListViewSchema] as SpaceTableSchema[],
};

export const defaultContextTable: DBTable = {
    uniques: [],
    cols: ["id", "name", "type", "def", "predicate", "primary"],
    rows: [defaultContextDBSchema] as SpaceTableSchema[],
};

export const defaultMDBTableForContext = (space: SpaceInfo) => {
    return defaultFolderMDBTable;
};

export const defaultFolderMDBTable: SpaceTable = {
    schema: defaultContextDBSchema,
    cols: defaultContextFields.rows as SpaceProperty[],
    rows: [],
};

export const fieldsToTable = (fields: SpaceProperty[], schemas: SpaceTableSchema[]): DBTables => {
    return fields
        .filter((s) => schemas.find((g) => g.id == s.schemaId && g.type == "db"))
        .reduce<DBTables>((p, c) => {
            return {
                ...p,
                ...(p[c.schemaId]
                    ? {
                          [c.schemaId]: {
                              uniques: c.unique == "true" ? [...p[c.schemaId].uniques, c.name] : p[c.schemaId].uniques,
                              cols: [...p[c.schemaId].cols, c.name],
                              rows: [],
                          },
                      }
                    : {
                          [c.schemaId]: {
                              uniques: c.unique == "true" ? [c.name] : [],
                              cols: [c.name],
                              rows: [],
                          },
                      }),
            };
        }, {});
};

export const defaultTablesForContext = (space: SpaceInfo) => {
    return defaultFolderTables;
};

export const defaultFolderTables = {
    m_schema: defaultContextTable,
    m_fields: defaultContextFields,
    ...fieldsToTable(defaultContextFields.rows as SpaceProperty[], defaultContextTable.rows as SpaceTableSchema[]),
};

export const defaultTagTables = {
    m_schema: defaultContextTable,
    m_fields: defaultTagFields,
    ...fieldsToTable(defaultTagFields.rows as SpaceProperty[], defaultContextTable.rows as SpaceTableSchema[]),
};
