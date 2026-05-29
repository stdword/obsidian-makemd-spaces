
import { defaultContextFileColumns, defaultContextSchemaID } from "shared/schemas/context";
import { PathPropertyName } from "shared/types/context";
import { DBTable, SpaceProperty } from "shared/types/mdb";
import { SpaceInfo } from "shared/types/spaceInfo";



export const fieldSchema = {
  uniques: ["name,schemaId"],
  cols: [
    "name",
    "schemaId",
    "type",
    "value",
    "attrs",
    "hidden",
    "unique",
    "primary",
  ],
};

export const defaultContextFields: DBTable = {
  ...fieldSchema,
  rows: defaultContextFileColumns.map((name) => ({
    name,
    schemaId: defaultContextSchemaID,
    type: name == PathPropertyName ? "file" : name == "ctime" || name == "mtime" || name == "size" ? "number" : "text",
    primary: name == PathPropertyName ? "true" : "",
    hidden: "",
    unique: name == PathPropertyName ? "true" : "",
    attrs: "",
    value: "",
  })) as SpaceProperty[],
};

export const defaultFieldsForContext = (space: SpaceInfo) => {
  return defaultContextFields;
};

export const defaultTableFields: SpaceProperty[] = [
  {
    name: "Name",
    schemaId: "",
    type: "text",
    primary: "true",
  },
];

export const defaultTagFields: DBTable = {
  ...fieldSchema,
  rows: [
    {
      name: PathPropertyName,
      schemaId: defaultContextSchemaID,
      type: "file",
      primary: "true",
      hidden: "",
      unique: "",
      attrs: "",
      value: "",
    },
  ],
};
