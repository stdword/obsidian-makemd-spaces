import { SpaceManager } from "core/spaceManager/spaceManager";
import { Superstate } from "makemd-core";
import { SPACE_SUB_FOLDER } from "shared/constants";
import { PathState } from "shared/types/PathState";
import { MakeMDSettings } from "shared/types/settings";
import { removeTrailingSlashFromFolder } from "shared/utils/paths";
import { encodeSpaceName } from "../strings";

export const pathInSpaceFolder = (basePath: string, path: string) => `${basePath}/${SPACE_SUB_FOLDER}/${path}`;

export const pathIsSpace = (superstate: Superstate, path: string) => {
    if (!path) return false;
    return superstate.spacesIndex.has(path);
};

export const spaceFolderPathFromSpace = (path: string, _manager: SpaceManager) => {
    if (path == "/") return SPACE_SUB_FOLDER + "/";
    return path + SPACE_SUB_FOLDER + "/";
};

export const spaceFolderForMDBPath = (path: string, _manager: SpaceManager): string => {
    const indexOfLastSlash = path.lastIndexOf("/");
    if (indexOfLastSlash == -1) {
        return "/";
    }
    let parentPath = path.substring(0, indexOfLastSlash);

    const indexOfSecondLastSlash = parentPath.lastIndexOf("/");
    if (parentPath.substring(indexOfSecondLastSlash + 1) == SPACE_SUB_FOLDER) {
        parentPath = parentPath.substring(0, indexOfSecondLastSlash);
    } else return null;

    if (parentPath.startsWith("/#")) {
        parentPath = parentPath.replace(/^/, "spaces:/");
    }
    return parentPath;
};

export const tagSpaceFolderBasePath = (settings: MakeMDSettings) => {
    const path = removeTrailingSlashFromFolder((settings?.tagSpaceFolderPath ?? "").trim().replace(/^\/+/, ""));
    return path == "/" ? "" : path;
};

export const tagFolderName = (tag: string) => encodeSpaceName((tag?.startsWith("#") ? tag : `#${tag}`).toLowerCase());

export const folderForTagSpace = (tag: string, settings: MakeMDSettings) => {
    const basePath = tagSpaceFolderBasePath(settings);
    const folderName = tagFolderName(tag);
    return basePath ? `${basePath}/${folderName}` : folderName;
};

export const spacesFromFileCache = (cache: PathState, superstate: Superstate) => {
    return (cache?.spaces ?? [])
        .map((f) => superstate.spacesIndex.get(f))
        .filter((f) => f)
        .map((f) => f.space);
};
