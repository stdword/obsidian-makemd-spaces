import { Superstate } from "makemd-core";
import { pathToString } from "utils/path";


export const validateName = (tag: string) => {
    return tag.trim();
};

export const getAllSubtags = (superstate: Superstate, tag: string) => {
    const tags = superstate.spaceManager.readTags();
    return tags.filter((f) => f.startsWith(tag) && f != tag);
};

export const tagPathToTag = (string: string) => {
    return pathToString(string).replace(/\+/g, "/");
};

export const ensureTag = (tag: string) => {
    if (!tag) return null;
    let string = tag;
    if (string.charAt(0) != "#") string = "#" + string;
    return string.toLowerCase();
};

export const stringFromTag = (string: string) => {
    if (string.charAt(0) == "#") {
        if (string.charAt(1) == "#") {
            return string.substring(2, string.length);
        }
        return string.substring(1, string.length);
    }

    return string;
};
