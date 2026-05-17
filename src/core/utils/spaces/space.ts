import { SpaceManager } from "core/spaceManager/spaceManager";
import { Superstate } from "makemd-core";
import { SPACE_SUB_FOLDER } from "shared/constants";
import { PathState } from "shared/types/PathState";
import { MakeMDSettings } from "shared/types/settings";

export const pathInSpaceFolder = (basePath: string, path: string) => `${basePath}/${SPACE_SUB_FOLDER}/${path}`;

export const pathIsSpace = (superstate: Superstate, path: string) => {
    if (!path) return false;
    return superstate.spacesIndex.has(path);
};

export const spaceFolderPathFromSpace = (path: string, manager: SpaceManager) => {
    if (path == "/")
        return SPACE_SUB_FOLDER + "/";
    return path + SPACE_SUB_FOLDER + "/";
};

export const spaceFolderForMDBPath = (path: string, manager: SpaceManager): string => {
    const indexOfLastSlash = path.lastIndexOf("/");
    if (indexOfLastSlash == -1) {
        return "/";
    }
    let parentPath = path.substring(0, indexOfLastSlash);

    const indexOfSecondLastSlash = parentPath.lastIndexOf("/");
    if (parentPath.substring(indexOfSecondLastSlash + 1) == SPACE_SUB_FOLDER) {
        parentPath = parentPath.substring(0, indexOfSecondLastSlash);
    } else
        return null;

    if (parentPath.startsWith("/#")) {
        parentPath = parentPath.replace(/^/, "spaces:/");
    }
    return parentPath;
};

export const folderForTagSpace = (space: string, settings: MakeMDSettings) => (
    "/" + space
)

export const spacesFromFileCache = (cache: PathState, superstate: Superstate) => {
    return (cache?.spaces ?? [])
        .map((f) => superstate.spacesIndex.get(f))
        .filter((f) => f)
        .map((f) => f.space);
};
