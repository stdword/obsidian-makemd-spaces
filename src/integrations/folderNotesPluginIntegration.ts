import { ISuperstate, PathStateWithRank } from "shared/types/superstate";

type FolderNotesSettings = {
    folderNoteName?: string;
    supportedFileTypes?: string[];
};

type FolderNotesPlugin = {
    settings?: FolderNotesSettings;
};

const folderNameForPath = (folderPath: string) => {
    const normalizedPath = folderPath.replace(/\/+$/, "");
    return normalizedPath.split("/").filter(Boolean).pop() ?? normalizedPath;
};

const normalizeExtension = (extension: string) => extension.replace(/^\./, "");

const getFolderNotesSettings = (superstate: ISuperstate): FolderNotesSettings | null => {
    const ui = (superstate as any)?.ui;
    const app = ui?.mainFrame?.plugin?.app ?? ui?.plugin?.app;
    const plugin = app?.plugins?.getPlugin?.("folder-notes") as FolderNotesPlugin | null | undefined;
    return plugin?.settings ?? null;
};

export const hideFolderNoteFileFromItems = (superstate: ISuperstate, folderPath: string, items: PathStateWithRank[]): PathStateWithRank[] => {
    const settings = getFolderNotesSettings(superstate);
    if (!settings?.folderNoteName || !Array.isArray(settings.supportedFileTypes) || settings.supportedFileTypes.length == 0)
        return items;

    const folderNoteBaseName = settings.folderNoteName.replace(/\{\{folder_name\}\}/g, folderNameForPath(folderPath));
    const matchingItem = settings.supportedFileTypes
        .map(normalizeExtension)
        .filter((extension) => extension.length > 0)
        .map((extension) => `${folderPath}/${folderNoteBaseName}.${extension}`)
        .map((folderNotePath) => items.find((item) => item.type != "space" && item.path == folderNotePath))
        .find((item) => item);

    if (!matchingItem)
        return items;
    return items.filter((item) => item !== matchingItem);
};
