import { Superstate } from "makemd-core";
import { tagSpacePathFromTag } from "core/utils/strings";
import { tagFolderName, tagSpaceFolderBasePath } from "core/utils/spaces/space";
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
    const basePath = tagSpaceFolderBasePath(superstate.settings);
    const tagParentPath = basePath || "/";
    const ensureFolderPath = async (folderPath: string) => {
        if (!folderPath) return;

        const parts = folderPath.split("/").filter((part) => part.length > 0);
        let currentParent = "/";
        let currentPath = "";
        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            if (!(await superstate.spaceManager.pathExists(currentPath))) {
                await superstate.spaceManager.createSpace(part, currentParent, null);
            }
            currentParent = currentPath;
        }
    };

    return ensureFolderPath(basePath)
        .then(() => superstate.spaceManager.createSpace(tagFolderName(normalizedTag), tagParentPath, null))
        .then(() => superstate.reloadSpace(superstate.spaceManager.spaceInfoForPath(tagPath), null, true));
};
