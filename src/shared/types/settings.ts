export type DeleteFileOption = "trash" | "permanent" | "system-trash";

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
    deleteFileOption: DeleteFileOption;
    expandFolderOnClick: boolean;
    folderIndentationLines: boolean;
    openSpacesOnLaunch: boolean;
    overrideNativeMenu: boolean;
    revealActiveFile: boolean;
    spaceRowHeight: number;
}
