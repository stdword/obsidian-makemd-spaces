
import { SpaceTableSchema } from "shared/types/mdb";

export const defaultContextSchemaID = "files";
export const defaultContextFileColumns = ["path", "color", "isPinned"];
export const defaultContextDBSchema: SpaceTableSchema = {
  id: defaultContextSchemaID,
  name: "Items",
  type: "db",
  primary: "true",
};
