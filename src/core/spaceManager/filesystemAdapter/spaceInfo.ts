import { pathInSpaceFolder } from "core/utils/superstate/space";
import { FilesystemSpaceInfo } from "shared/types/spaceInfo";
import { tagToTagPath } from "utils/tags";

import { SpaceManager } from "core/spaceManager/spaceManager";
import { builtinSpaces } from "core/types/space";
import { DEFAULT_SYSTEM_NAME, SPACE_DEF_FILE, SPACE_DEF_PATH } from "shared/constants";
import { builtinSpacePathPrefix } from "shared/schemas/builtin";
import { removeTrailingSlashFromFolder } from "shared/utils/paths";
import { folderPathToString } from "utils/path";
import { encodeSpaceName, tagSpacePathFromTag } from "../../utils/strings";

export const fileSystemSpaceInfoFromTag = (manager: SpaceManager, tag: string): FilesystemSpaceInfo => {
    const path = tagSpacePathFromTag(tag.toLowerCase());
    const folderPath = tagToTagPath(tag);
    return {
        name: tag.replace(/^#/, ""),
        path,

        folderPath,
        defPath: pathInSpaceFolder(folderPath, SPACE_DEF_FILE),
        notePath: `${folderPath}/${encodeSpaceName(tag)}.md`,
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
            notePath: "",
        };
    }
    const folderName = folderPathToString(folder);
    return {
        name: folderName,

        path: folder,
        folderPath: folder,
        defPath: folder + `/${SPACE_DEF_PATH}`,
        notePath: folder + "/" + folderName + ".md",
    };
};
