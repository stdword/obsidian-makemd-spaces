import { MakeMDSettings } from "shared/types/settings";

export const DEFAULT_SETTINGS: MakeMDSettings = {
    // state, not settings
    currentFocus: 0,
    expandedSpaces: ["/"],

    hiddenExtensions: [".mdb"],
    hiddenFiles: [],
    skipFolderNames: [],

    newFileFolderPath: "",
    newFileLocation: "root",

    // settings
    deleteFileOption: "system-trash",
    defaultFoldersAtTop: true,
    defaultSpaceSort: {
        field: "name",
        asc: true,
    },
    expandFolderOnClick: true,
    folderIndentationLines: true,
    pinnedSeparatorLine: false,
    openSpacesOnLaunch: true,
    overrideNativeMenu: false,
    revealActiveFile: false,
    spaceRowHeight: 29,
    searchMenuFoldersLimit: 75,
    searchMenuFilesLimit: 75,
    searchMenuRefsLimit: 75,
};
