import { isTagSpacePath, tagSpaceNameFromPath } from "schemas/builtin";
import { DEFAULT_SYSTEM_NAME } from "schemas/constants";
import { SpaceType } from "shared/types/PathState";

export type PathDisplayInfo = {
    icon: string;
    title: string;
    extension?: string;
};

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".avif", ".webp", ".gif", ".svg"]);

const pathParts = (path: string) => {
    const fullName = path.split("/").pop() ?? "";
    const normalizedName = fullName.toLowerCase();

    let extension = "";
    if (normalizedName.endsWith('.excalidraw.md'))
        extension = '.excalidraw.md';
    else {
        const extensionStart = normalizedName.lastIndexOf(".");
        if (extensionStart > 0)
            extension = normalizedName.slice(extensionStart);
    }

    return {fullName, extension, title: fullName.slice(0, -extension.length) || fullName}
};

export const iconForSpace = (spaceType: SpaceType): string => {
    if      (spaceType == "tag")    return "lucide//hash"
    else if (spaceType == "vault")  return "ui//home"
    else if (spaceType == "folder") return "lucide//folder-closed"
}

export const pathDisplayInfo = (path: string, type: "file" | "folder" = "file"): PathDisplayInfo => {
    if (path == "/")
        return { icon: iconForSpace('vault'),  title: DEFAULT_SYSTEM_NAME };
    if (isTagSpacePath(path))
        return { icon: iconForSpace('tag'),    title: tagSpaceNameFromPath(path) };

    const {fullName, extension, title} = pathParts(path);
    if (type == "folder")
        return { icon: iconForSpace('folder'), title: fullName };

    if (extension == ".excalidraw.md" || extension == ".excalidraw")
                                return { icon: "ui//excalidraw",       title };
    if (extension == ".md")     return { icon: "ui//file-text",        title };
    if (extension == ".base")   return { icon: "ui//table",            title };
    if (extension == ".canvas") return { icon: "ui//layout-dashboard", title };

    if (imageExtensions.has(extension))
        return { icon: "ui//image", title, extension };
    else
        return { icon: "ui//file",  title, extension };
};
