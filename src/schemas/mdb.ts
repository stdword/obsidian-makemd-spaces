import { parseFieldValue } from "core/schemas/parseFieldValue";
import { PathPropertyName } from "shared/types/context";
import { SpaceProperty } from "shared/types/mdb";
import { safelyParseJSON } from "shared/utils/json";
import { parsePropString } from "utils/parsers";

export const fieldTypeForField = (f: SpaceProperty) => {
    if (!f) return null;
    return f.type == "fileprop" ? (parseFieldValue(f.value, "fileprop")?.type ?? "text") : f.type;
};

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

export const defaultValueForPropertyType = (_name: string, value: string, type: string) => {
    if (type == "fileprop") {
        const { property } = parsePropString(value);
        if (property == "ctime" || property == "mtime") return (Date.now() - 60).toString();
        return value;
    }
    return "";
};
