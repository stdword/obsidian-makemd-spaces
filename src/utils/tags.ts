import { Superstate } from "makemd-core";
import { pathToString } from "utils/path";

export const renameTag = async (superstate: Superstate, tag: string, toTag: string) => {
    console.log('TRACE renameTag', {toTag, tag})
    // const tags = getAllSubtags(superstate, tag);
    // const newTag = ensureTag(validateName(toTag));
    // const paths = superstate.spaceManager.pathsForTag(tag);
    // for (const path of paths) {
    //     superstate.spaceManager.renameTag(path, tag, newTag);
    // }
    // superstate.onTagRenamed(tag, newTag);
    // for (const subtag of tags) {
    //     await renameTag(superstate, subtag, subtag.replace(tag, newTag));
    // }
    // return newTag;
};

export const validateName = (tag: string) => {
    return tag.trim();
};

export const getAllSubtags = (superstate: Superstate, tag: string) => {
    const tags = superstate.spaceManager.readTags();
    return tags.filter((f) => f.startsWith(tag) && f != tag);
};

export const tagToTagPath = (tag: string) => {
    return encodeSpaceName(ensureTag(tag));
};

export const encodeSpaceName = (spaceName: string) => spaceName?.replace(/\//g, "+");

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
