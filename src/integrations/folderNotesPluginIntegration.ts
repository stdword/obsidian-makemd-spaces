import { isTagSpacePath } from "schemas/builtin";
import { ISuperstate, PathStateWithRank } from "shared/types/superstate";

type FolderNotesSettings = {
    folderNoteName: string;
    supportedFileTypes: string[];
    hideFolderNote: boolean;
};

const getSettings = (superstate: ISuperstate): FolderNotesSettings | null =>
    (superstate.ui?.pluginSettings?.("folder-notes") as FolderNotesSettings | null) ?? null;

const getFolderNoteName = (settings: FolderNotesSettings, folderPath: string) => {
    const folderName = folderPath.split("/").filter(Boolean).pop() ?? folderPath;
    return settings.folderNoteName.replace(/\{\{folder_name\}\}/g, folderName);
};

const FOLDER_NOTE_FILE_TYPE_PRIORITY = ["md", "canvas", "excalidraw", "base"];
const folderNoteFileTypeRank = (extension: string) => {
    const index = FOLDER_NOTE_FILE_TYPE_PRIORITY.indexOf(extension);
    return index == -1 ? FOLDER_NOTE_FILE_TYPE_PRIORITY.length : index;
};

// Returns a new array: the input is the live settings object of the Folder Notes plugin.
export const prioritizeFolderNoteFileTypes = (fileTypes: string[]): string[] =>
    [...fileTypes].sort((a, b) => folderNoteFileTypeRank(a) - folderNoteFileTypeRank(b));

export const getFolderNotePath = (superstate: ISuperstate, folderPath: string, childPaths: string[]): string => {
    if (isTagSpacePath(folderPath)) return "";

    const settings = getSettings(superstate);
    if (!settings?.folderNoteName || !Array.isArray(settings.supportedFileTypes) || settings.supportedFileTypes.length == 0)
        return "";

    const folderNoteName = getFolderNoteName(settings, folderPath);
    const possibleFolderNotesNames = prioritizeFolderNoteFileTypes(settings.supportedFileTypes)
        .map((extension) => `${folderPath}/${folderNoteName}.${extension}`);

    return possibleFolderNotesNames.find((path) => childPaths.includes(path)) ?? "";
};

export const filterFolderNoteChildren = (superstate: ISuperstate, folderNotePath: string, items: PathStateWithRank[]): PathStateWithRank[] => {
    if (!folderNotePath || getSettings(superstate)?.hideFolderNote != true)
        return items;
    return items.filter((item) => item.path != folderNotePath);
};

export const folderPathForHiddenFolderNote = (superstate: ISuperstate, path: string): string | null => {
    if (!path || getSettings(superstate)?.hideFolderNote != true)
        return null;

    const parentPath = superstate.pathStateForPath(path)?.parent;
    if (!parentPath)
        return null;

    const parentSpace = superstate.spacesIndex.get(parentPath);
    return parentSpace?.type == "folder" && parentSpace.space?.notePath == path ? parentSpace.path : null;
};

// The navigator highlights the row whose path equals the active path. A hidden folder note
// has no row, so its folder is treated as the active item instead.
export const navigatorActivePathForPath = (superstate: ISuperstate, path: string): string =>
    folderPathForHiddenFolderNote(superstate, path) ?? path;
