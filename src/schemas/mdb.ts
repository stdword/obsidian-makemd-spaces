import { PathPropertyName } from "shared/types/context";
import { SpaceProperty } from "shared/types/mdb";
import { safelyParseJSON } from "shared/utils/json";

export const stickerForField = (f: SpaceProperty) => (f.attrs?.length > 0 ? (safelyParseJSON(f.attrs)?.icon ?? fieldTypeForType(f.type, f.name)?.icon) : fieldTypeForType(f.type, f.name)?.icon);

export const fieldTypeForType = (_type: string, name?: string) =>
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
          };
