import { SpaceSort } from "./spaceDef";

export interface MakeMDSettings {
    // constants, not settings
    fmKeyColor: string;
    fmKeySticker: string;

    // state, not settings
    currentWaypoint: number;
    expandedSpaces: string[];

    hiddenExtensions: string[];
    hiddenFiles: string[];
    skipFolderNames: string[];

    newFileFolderPath: string;
    newFileLocation: string;

    // settings
    deleteFileOption: "trash" | "permanent" | "system-trash";
    expandFolderOnClick: boolean;
    folderIndentationLines: boolean;
    pinnedSeparatorLine: boolean;
    defaultFoldersAtTop: boolean;
    defaultSpaceSort: SpaceSort;
    openSpacesOnLaunch: boolean;
    overrideNativeMenu: boolean;
    revealActiveFile: boolean;
    spaceRowHeight: number;
    searchMenuTagsLimit?: number;
    searchMenuFoldersLimit?: number;
    searchMenuFilesLimit?: number;
    searchMenuRefsLimit?: number;
}
