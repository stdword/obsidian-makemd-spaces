import { SPACE_SUB_FOLDER } from "schemas/constants";
import { MakeMDSettings } from "shared/types/settings";

export const excludePathPredicate = (settings: MakeMDSettings, path: string) =>
    settings.hiddenExtensions.some((e) => path.endsWith(e)) ||
        path.endsWith("/" + SPACE_SUB_FOLDER) ||
        path == SPACE_SUB_FOLDER ||
        path.split("/").pop() == SPACE_SUB_FOLDER ||
        path.startsWith("/#") ||
        settings.hiddenFiles.some((e) => path.startsWith(e));

export const excludeSpacesPredicate = (settings: MakeMDSettings, path: string) =>
    settings.skipFolderNames.some((e) => path.endsWith(e)) ||
        path.endsWith("/" + SPACE_SUB_FOLDER) ||
        path == SPACE_SUB_FOLDER ||
        path.split("/").pop() == SPACE_SUB_FOLDER ||
        path.startsWith("/#") ||
        path.startsWith("/$") ||
        settings.hiddenFiles.some((e) => path.startsWith(e));
