import { SpaceSort } from "./spaceDef";

export interface MakeMDSettings {
    // state, not settings
    currentFocus: number;
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
    defaultGroupBySubtags: boolean;
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

const escapedPathPattern = (path: string) => path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const expandedSpacePathPattern = (path: string) => new RegExp(`(^|/)${escapedPathPattern(path)}(?=$|/)`, "g");

export const renameExpandedSpacePaths = (expandedSpaces: string[], oldPath: string, newPath: string) => {
    const sourceEntries = expandedSpaces.filter((id) => expandedSpacePathPattern(oldPath).test(id));
    const unaffectedEntries = expandedSpaces.filter((id) =>
        !expandedSpacePathPattern(oldPath).test(id) && !expandedSpacePathPattern(newPath).test(id),
    );
    if (sourceEntries.length == 0 && unaffectedEntries.length == expandedSpaces.length) return expandedSpaces;

    const oldPattern = expandedSpacePathPattern(oldPath);
    const renamedEntries = sourceEntries.map((id) => id.replace(oldPattern, (_match, prefix) => `${prefix}${newPath}`));
    return Array.from(new Set([...unaffectedEntries, ...renamedEntries]));
};
