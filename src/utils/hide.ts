import { SPACE_SUB_FOLDER } from "schemas/constants";
import { MakeMDSettings } from "shared/types/settings";

export const isSpaceInternalPath = (path: string) =>
    path.endsWith("/" + SPACE_SUB_FOLDER) ||
    path == SPACE_SUB_FOLDER ||
    path.split("/").pop() == SPACE_SUB_FOLDER ||
    path.includes("/" + SPACE_SUB_FOLDER + "/") ||
    path.startsWith(SPACE_SUB_FOLDER + "/");

export const excludePathPredicate = (settings: MakeMDSettings, path: string) =>
    settings.hiddenExtensions.some((e) => path.endsWith(e)) ||
        isSpaceInternalPath(path) ||
        path.startsWith("/#") ||
        settings.hiddenFiles.some((e) => path.startsWith(e));

export const excludeSpacesPredicate = (settings: MakeMDSettings, path: string) =>
    settings.skipFolderNames.some((e) => path.endsWith(e)) ||
        isSpaceInternalPath(path) ||
        path.startsWith("/#") ||
        path.startsWith("/$") ||
        settings.hiddenFiles.some((e) => path.startsWith(e));
