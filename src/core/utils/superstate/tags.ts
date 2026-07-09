import { Superstate } from "makemd-core";
import { tagSpacePathFromTag } from "schemas/builtin";
import { fileSystemSpaceInfoFromTag } from "core/spaceManager/filesystemAdapter/spaceInfo";
import { ensureTag } from "utils/tags";


export const deleteTagFromPath = (superstate: Superstate, path: string, tag: string) => {
    console.log('TRACE deleteTagFromPath', {path, tag})
    // if (superstate.spacesIndex.has(path)) {
    //     return superstate.spaceManager.deleteTag(metadataPathForSpace(superstate, superstate.spacesIndex.get(path).space), tag);
    // }
    // return superstate.spaceManager.deleteTag(path, tag);
};

export const addTagToPath = (superstate: Superstate, path: string, tag: string) => {
    console.log('TRACE addTagToPath', {path, tag})
    // if (superstate.spacesIndex.has(path)) {
    //     return superstate.spaceManager.addTag(metadataPathForSpace(superstate, superstate.spacesIndex.get(path).space), tag);
    // }
    // return superstate.spaceManager.addTag(path, tag);
};

export const addTag = (superstate: Superstate, tag: string, initialized = true) => {
    console.log('TRACE addTag', {tag})
    const normalizedTag = ensureTag(tag);
    const tagPath = tagSpacePathFromTag(normalizedTag);
    if (superstate.spacesIndex.has(tagPath)) {
        return Promise.resolve(superstate.spacesIndex.get(tagPath));
    }
    return Promise.resolve(superstate.reloadSpace(fileSystemSpaceInfoFromTag(superstate.spaceManager, normalizedTag), null, initialized));
};

export const syncTagSpacesFromObsidian = async (superstate: Superstate) => {
    console.log('TRACE syncTagSpacesFromObsidian')
    const tags = superstate.spaceManager.readTags().map((tag) => ensureTag(tag)).filter((tag) => tag);
    await Promise.all(tags.map((tag) => addTag(superstate, tag, false)));
    return new Set(tags.map((tag) => tagSpacePathFromTag(tag)));
};
