import { Superstate } from "makemd-core";
import { pathDisplayInfo } from "core/react/components/UI/pathDisplay";
import i18n from "shared/i18n";
import { createSpace } from "./spaces";

export type WrappablePath = { path: string; parent?: string; type?: string };

export const wrapFolderPathForName = (parentPath: string | undefined, name: string) => {
    const folderName = name.replace(/\//g, "").trim();
    const normalizedParent = parentPath && parentPath != "/" ? parentPath : "";
    return {
        folderName,
        folderPath: normalizedParent ? `${normalizedParent}/${folderName}` : folderName,
    };
};

export const validateWrapFolderName = (superstate: Superstate, parentPath: string | undefined, name: string): string | undefined => {
    const { folderName, folderPath } = wrapFolderPathForName(parentPath, name);
    if (!folderName) return i18n.notice.emptyfolderName;
    if (superstate.spacesIndex.has(folderPath)) return i18n.notice.duplicateFolderName;
};

// Creates the folder and moves the paths inside it. Returns false when the folder already exists.
export const wrapPathsInFolder = async (superstate: Superstate, folderPath: string, paths: string[]): Promise<boolean> => {
    if (await superstate.spaceManager.pathExists(folderPath)) {
        superstate.ui.notify(i18n.notice.fileExists);
        return false;
    }
    await createSpace(superstate, folderPath);
    for (const path of paths)
        await superstate.spaceManager.renamePath(path, `${folderPath}/${path.split("/").pop()}`);
    return true;
};

export const ownWrapFolderPath = (item: WrappablePath) =>
    wrapFolderPathForName(item.parent, pathDisplayInfo(item.path, item.type == "space" ? "folder" : "file").title).folderPath;

// Wraps every item into its own folder named after the item (without extension).
export const wrapEachPathInOwnFolder = async (superstate: Superstate, items: WrappablePath[]) => {
    for (const item of items)
        await wrapPathsInFolder(superstate, ownWrapFolderPath(item), [item.path]);
};
