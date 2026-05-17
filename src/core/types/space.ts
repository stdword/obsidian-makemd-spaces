import { fileSystemSpaceInfoFromFolder } from "core/spaceManager/filesystemAdapter/spaceInfo";
import { SpaceManager } from "makemd-core";

import { PathState, SpaceState } from "shared/types/PathState";
import { MakeMDSettings } from "../../shared/types/settings";

export const FMMetadataKeys = (settings: MakeMDSettings) => [settings.fmKeySticker, settings.fmKeyColor, spaceLinksKey, spaceSortKey];
export const createVaultSpace = (manager: SpaceManager): SpaceState => ({
    name: "Home",
    path: "/",
    space: fileSystemSpaceInfoFromFolder(manager, "/"),
    type: "default",
});

export const vaultPath: PathState = {
    name: "Home",
    readOnly: false,
    path: "/",
    label: {
        sticker: "ui//vault",
        color: "",
    },
    type: "default",
};

export type BuiltinSpace = {
    name: string;
    icon: string;
    readOnly: boolean;
    hidden: boolean;
};

export const builtinSpaces: Record<string, BuiltinSpace> = {
    tags: {
        name: "Tags",
        icon: "ui//tags",
        readOnly: false,
        hidden: false,
    },
};

export const spaceLinksKey = "_links";
export const spaceSortKey = "_sort";
export const spaceRecursiveKey = "_subfolders";
