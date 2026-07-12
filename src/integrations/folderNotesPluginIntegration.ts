import { isTagSpacePath } from "schemas/builtin";
import { ISuperstate, PathStateWithRank } from "shared/types/superstate";

type FolderNotesSettings = {
    folderNoteName: string;
    supportedFileTypes: string[];
    hideFolderNote: boolean;
};

const getApp = (superstate: ISuperstate) => {
    const ui = (superstate as any)?.ui;
    return ui?.mainFrame?.plugin?.app ?? ui?.plugin?.app;
};

const getSettings = (superstate: ISuperstate): FolderNotesSettings | null => {
    const app = getApp(superstate);
    const plugin = app?.plugins?.getPlugin?.("folder-notes");
    return plugin?.settings ?? null;
};

const getFolderNoteName = (settings: FolderNotesSettings, folderPath: string) => {
    const folderName = folderPath.split("/").filter(Boolean).pop() ?? folderPath;
    return settings.folderNoteName.replace(/\{\{folder_name\}\}/g, folderName);
};

export const getFolderNotePath = (superstate: ISuperstate, folderPath: string, childPaths: string[]): string => {
    if (isTagSpacePath(folderPath)) return "";

    const settings = getSettings(superstate);
    if (!settings?.folderNoteName || !Array.isArray(settings.supportedFileTypes) || settings.supportedFileTypes.length == 0)
        return "";

    const folderNoteName = getFolderNoteName(settings, folderPath);
    const fileTypesPriority = ['md', 'canvas', 'excalidraw', 'base'];
    const possibleFolderNotesNames = settings.supportedFileTypes
        .sort((a, b) => fileTypesPriority.indexOf(a) > fileTypesPriority.indexOf(b) ? 1 : -1)
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
