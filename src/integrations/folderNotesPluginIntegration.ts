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

const folderNoteNameForPath = (settings: FolderNotesSettings, folderPath: string) => {
    const folderName = folderPath.split("/").filter(Boolean).pop() ?? folderPath;
    return settings.folderNoteName.replace(/\{\{folder_name\}\}/g, folderName);
};

export type FolderNoteChildren = {
    children: PathStateWithRank[];
    folderNotePath: string | null;
};

export const processFolderNoteChildren = (superstate: ISuperstate, folderPath: string, items: PathStateWithRank[]): FolderNoteChildren => {
    if (isTagSpacePath(folderPath))
        return { children: items, folderNotePath: null };

    const settings = getSettings(superstate);
    if (!settings?.folderNoteName || !Array.isArray(settings.supportedFileTypes) || settings.supportedFileTypes.length == 0)
        return { children: items, folderNotePath: null };

    const folderNoteName = folderNoteNameForPath(settings, folderPath);
    const fileTypesPriority = ['md', 'canvas', 'excalidraw', 'base'];
    const possibleFolderNotesNames = settings.supportedFileTypes
        .sort((a, b) => fileTypesPriority.indexOf(a) > fileTypesPriority.indexOf(b) ? 1 : -1)
        .map((extension) => `${folderPath}/${folderNoteName}.${extension}`);

    const matchingItem = possibleFolderNotesNames
        .map((path) => items.find((item) => item.type == "file" && item.path == path))
        .find((item) => item);

    if (!matchingItem)
        return { children: items, folderNotePath: null };

    console.log("TRACE integration", matchingItem.path);

    return {
        children: settings.hideFolderNote ? items.filter((item) => item !== matchingItem) : items,
        folderNotePath: matchingItem.path,
    };
};
