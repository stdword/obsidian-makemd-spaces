import { fileSystemSpaceInfoFromFolder } from "core/spaceManager/filesystemAdapter/spaceInfo";
import { SpaceManager } from "makemd-core";

import { PathState, SpaceState } from "shared/types/PathState";
import { MakeMDSettings } from "../../shared/types/settings";
import { DEFAULT_SYSTEM_NAME } from "shared/constants";

export const FMMetadataKeys = (settings: MakeMDSettings) => [settings.fmKeySticker, settings.fmKeyColor];
export const createVaultSpace = (manager: SpaceManager): SpaceState => ({
    name: DEFAULT_SYSTEM_NAME,
    path: "/",
    space: fileSystemSpaceInfoFromFolder(manager, "/"),
    type: "default",
});

export const vaultPath: PathState = {
    name: DEFAULT_SYSTEM_NAME,
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
    hidden: boolean;
};

export const builtinSpaces: Record<string, BuiltinSpace> = {
    tags: {
        name: "Tags",
        icon: "ui//tags",
        hidden: false,
    },
};
