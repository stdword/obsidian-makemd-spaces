import { MakeMDSettings } from "../../shared/types/settings";

export const DEFAULT_SETTINGS: MakeMDSettings = {
    // constants, not settings
    fmKeyColor: "color",
    fmKeySticker: "sticker",

    // state, not settings
    currentWaypoint: 0,
    expandedSpaces: ["/"],

    hiddenExtensions: [".mdb"],
    hiddenFiles: [],
    skipFolderNames: [],

    newFileFolderPath: "",
    newFileLocation: "root",

    // settings
    deleteFileOption: "system-trash",
    expandFolderOnClick: true,
    folderIndentationLines: true,
    openSpacesOnLaunch: true,
    overrideNativeMenu: false,
    revealActiveFile: false,
    spaceRowHeight: 29,
};
