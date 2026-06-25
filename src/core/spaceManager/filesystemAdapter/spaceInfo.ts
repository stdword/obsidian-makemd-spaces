import { folderForTagSpace, pathInSpaceFolder, spaceFolderPathFromSpace } from "core/utils/spaces/space";
import { FilesystemSpaceInfo } from "shared/types/spaceInfo";

import { SpaceManager } from "core/spaceManager/spaceManager";
import { builtinSpaces } from "core/types/space";
import { DEFAULT_SYSTEM_NAME, SPACE_CONTEXT_FILE, SPACE_DEF_FILE, SPACE_DEF_PATH } from "shared/constants";
import { builtinSpacePathPrefix } from "shared/schemas/builtin";
import { removeTrailingSlashFromFolder } from "shared/utils/paths";
import { folderPathToString } from "utils/path";
import { encodeSpaceName, tagSpacePathFromTag } from "../../utils/strings";

export const fileSystemSpaceInfoFromTag = (manager: SpaceManager, tag: string): FilesystemSpaceInfo => {
    const path = tagSpacePathFromTag(tag.toLowerCase());
    const folderPath = folderForTagSpace(tag, manager.superstate.settings);
    return {
        name: tag.replace(/^#/, ""),
        path,

        folderPath,
        defPath: pathInSpaceFolder(folderPath, SPACE_DEF_FILE),
        notePath: `${folderPath}/${encodeSpaceName(tag)}.md`,
        dbPath: spaceFolderPathFromSpace(folderPath + "/", manager) + SPACE_CONTEXT_FILE,
    };
};

export const fileSystemSpaceInfoByPath = (manager: SpaceManager, contextPath: string): FilesystemSpaceInfo => {
    if (!contextPath) return;
    if (contextPath.startsWith(builtinSpacePathPrefix)) {
        const builtinPath = contextPath.slice(builtinSpacePathPrefix.length);

        const folderPath = "$" + builtinPath;
        return {
            name: builtinSpaces[builtinPath].name,
            path: contextPath,

            folderPath,
            defPath: pathInSpaceFolder(folderPath, SPACE_DEF_FILE),
            notePath: `${folderPath}/${builtinSpaces[builtinPath].name}.md`,
            dbPath: spaceFolderPathFromSpace(folderPath + "/", manager) + SPACE_CONTEXT_FILE,
        };
    }
    const uri = manager.uriByString(contextPath);
    if (!uri) return null;
    const pathType = manager.spaceTypeByString(uri);

    if (pathType == "folder") {
        return fileSystemSpaceInfoFromFolder(manager, removeTrailingSlashFromFolder(uri.path));
    } else if (pathType == "tag") {
        if (uri.path.length > 1) {
            return fileSystemSpaceInfoFromTag(manager, uri.authority + "/" + uri.path);
        }
        return fileSystemSpaceInfoFromTag(manager, uri.authority);
    } else if (pathType == "vault") {
        return fileSystemSpaceInfoFromFolder(manager, "/");
    }
    return null;
};

export const fileSystemSpaceInfoFromFolder = (manager: SpaceManager, folder: string): FilesystemSpaceInfo => {
    if (folder == "/") {
        const vaultName = "Vault";
        return {
            name: DEFAULT_SYSTEM_NAME,

            path: folder,
            folderPath: folder,
            defPath: SPACE_DEF_PATH,
            notePath: vaultName + ".md",
            dbPath: spaceFolderPathFromSpace(folder, manager) + SPACE_CONTEXT_FILE,
        };
    }
    const folderName = folderPathToString(folder);
    return {
        name: folderName,

        path: folder,
        folderPath: folder,
        defPath: folder + `/${SPACE_DEF_PATH}`,
        notePath: folder + "/" + folderName + ".md",
        dbPath: spaceFolderPathFromSpace(folder + "/", manager) + SPACE_CONTEXT_FILE,
    };
};
