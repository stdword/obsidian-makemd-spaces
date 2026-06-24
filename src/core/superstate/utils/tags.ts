import { Superstate } from "makemd-core";
import { tagSpacePathFromTag } from "core/utils/strings";
import { ensureTag } from "utils/tags";
import { metadataPathForSpace } from "./spaces";

export const deleteTagFromPath = (superstate: Superstate, path: string, tag: string) => {
    if (superstate.spacesIndex.has(path)) {
        return superstate.spaceManager.deleteTag(metadataPathForSpace(superstate, superstate.spacesIndex.get(path).space), tag);
    }
    return superstate.spaceManager.deleteTag(path, tag);
};


export const addTagToPath = (superstate: Superstate, path: string, tag: string) => {

    if (superstate.spacesIndex.has(path)) {
        return superstate.spaceManager.addTag(metadataPathForSpace(superstate, superstate.spacesIndex.get(path).space), tag);
    }
    return superstate.spaceManager.addTag(path, tag);
};

export const addTag = (superstate: Superstate, tag: string) => {
    const normalizedTag = ensureTag(tag);
    const tagPath = tagSpacePathFromTag(normalizedTag);
    if (superstate.spacesIndex.has(tagPath)) {
        return Promise.resolve(superstate.spacesIndex.get(tagPath));
    }
    return Promise.resolve(superstate.spaceManager.createSpace(normalizedTag, "", null)).then(() => superstate.reloadSpace(superstate.spaceManager.spaceInfoForPath(tagPath), null, true));
};
