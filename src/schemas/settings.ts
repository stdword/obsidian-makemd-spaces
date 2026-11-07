import { MakeMDSettings } from "shared/types/settings";

export const DEFAULT_SETTINGS: MakeMDSettings = {
    // state, not settings
    currentFocus: 0,
    expandedSpaces: ["/"],

    hiddenExtensions: [".mdb"],
    hiddenFiles: [],

    newFileFolderPath: "",
    newFileLocation: "root",

    // settings
    defaultFoldersAtTop: true,
    defaultGroupBySubtags: true,
    defaultSpaceSort: {
        field: "name",
        asc: true,
    },
    folderIndentationLines: true,
    openSpacesOnLaunch: true,
    overrideNativeMenu: false,
    revealActiveFile: false,
    spaceRowHeight: 29,
    searchMenuFoldersLimit: 75,
    searchMenuFilesLimit: 75,
    searchMenuRefsLimit: 75,
};
