import { pathInSpaceFolder } from "core/utils/superstate/space";
import { FilesystemSpaceInfo, SpaceState } from "shared/types/PathState";
import { encodeSpaceName, tagToTagPath } from "utils/tags";

import { SpaceManager } from "core/spaceManager/spaceManager";
import { DEFAULT_SYSTEM_NAME, SPACE_CONFIG_FILE, SPACE_CONFIG_PATH } from "schemas/constants";
import { removeTrailingSlashFromFolder } from "utils/paths";
import { folderPathToString } from "utils/path";
import { tagSpacePathFromTag } from "schemas/builtin";

export const fileSystemSpaceInfoFromTag = (manager: SpaceManager, tag: string): SpaceState => {
    const path = tagSpacePathFromTag(tag.toLowerCase());
    const folderPath = tagToTagPath(tag);
    return {
        type: "tag",
        name: tag.replace(/^#/, ""),
        path,
        space: {
            folderPath,
            defPath: pathInSpaceFolder(folderPath, SPACE_CONFIG_FILE),
            notePath: `${folderPath}/${encodeSpaceName(tag)}.md`,
        },
        metadata: {},
    };
};

export const fileSystemSpaceInfoByPath = (manager: SpaceManager, contextPath: string): SpaceState => {
    if (!contextPath) return;

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

export const fileSystemSpaceInfoFromFolder = (manager: SpaceManager, folder: string): SpaceState => {
    if (folder == "/") {
        return {
            type: "folder",
            name: DEFAULT_SYSTEM_NAME,
            path: folder,
            space: {
                folderPath: folder,
                defPath: SPACE_CONFIG_PATH,
                notePath: "",
            },
            metadata: {},
        };
    }
    const folderName = folderPathToString(folder);
    return {
        type: "folder",
        name: folderName,
        path: folder,
        space: {
            folderPath: folder,
            defPath: folder + `/${SPACE_CONFIG_PATH}`,
            notePath: folder + "/" + folderName + ".md",
        },
        metadata: {},
    };
};
