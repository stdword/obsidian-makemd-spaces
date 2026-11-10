import { SpaceSort } from "./spaceDef";

export interface MakeMDSettings {
    // state, not settings
    currentFocus: number;
    /** Expand keys, see core/utils/superstate/expandKeys. */
    expandedSpaces: string[];

    hiddenExtensions: string[];
    hiddenFiles: string[];

    newFileFolderPath: string;
    newFileLocation: string;

    // settings
    folderIndentationLines: boolean;
    defaultFoldersAtTop: boolean;
    defaultGroupBySubtags: boolean;
    defaultSpaceSort: SpaceSort;
    openSpacesOnLaunch: boolean;
    overrideNativeMenu: boolean;
    revealActiveFile: boolean;
    focusModeKeepExpanded: boolean;
    spaceRowHeight: number;
    searchMenuTagsLimit?: number;
    searchMenuFoldersLimit?: number;
    searchMenuFilesLimit?: number;
    searchMenuRefsLimit?: number;
}
