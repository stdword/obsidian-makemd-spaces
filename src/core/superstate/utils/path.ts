import { Superstate } from "makemd-core";
import i18n from "shared/i18n";
import { uniq } from "shared/utils/array";
import { movePath, renamePathWithExtension, renamePathWithoutExtension } from "shared/utils/uri";
import { renameTag } from "utils/tags";

export const resolvePath = (path: string, source: string, isSpace?: (path: string) => boolean): string => {
    if (!source || !path) return path;
    if (path.indexOf("http") == 0) return path;
    if (path.indexOf("|") != -1) {
        path = path.split("|")[0];
    }
    if (path.indexOf("./") == 0 && source) {
        if (isSpace?.(source)) {
            return source + path.slice(1);
        }
        return source.slice(0, source.lastIndexOf("/")) + path.slice(1);
    } else if (path.indexOf("../") == 0 && source) {
        const sourceParts = source.split("/");
        const pathParts = path.split("/");
        sourceParts.pop();
        while (pathParts[0] === "..") {
            sourceParts.pop();
            pathParts.shift();
        }
        return [...sourceParts, ...pathParts].join("/");
    }
    return path;
};

export const renamePathByName = async (superstate: Superstate, oldPath: string, newName: string): Promise<string> => {
    if (superstate.spacesIndex.has(oldPath)) {
        const spaceState = superstate.spacesIndex.get(oldPath);
        if (spaceState.type == "tag") {
            return renameTag(superstate, spaceState.name, newName);
        }
        return superstate.spaceManager.renameSpace(oldPath, renamePathWithoutExtension(oldPath, newName));
    } else {
        return superstate.spaceManager.renamePath(oldPath, renamePathWithExtension(oldPath, newName));
    }
};

export const hidePath = async (superstate: Superstate, path: string) => {
    superstate.settings.hiddenFiles = uniq([...superstate.settings.hiddenFiles, path]);
    superstate.ui.notify(i18n.notice.itemJustHidden);
    superstate.saveSettings();
    superstate.reloadPath(path, true).then(() => superstate.dispatchEvent("superstateUpdated", null));
};

export const isPathDirectlyHidden = (superstate: Superstate, path: string) => superstate.settings?.hiddenFiles?.some((hiddenPath) => hiddenPath == path) ?? false;

const descendantsForPath = (superstate: Superstate, path: string): string[] => {
    const prefix = path == "/" ? "" : `${path}/`;
    const indexedPaths = [...superstate.pathsIndex.keys()].filter((filePath) => filePath != path && filePath.startsWith(prefix));
    const filesystemPaths = ((superstate.spaceManager as any).primarySpaceAdapter?.fileSystem?.allFiles?.(true) ?? [])
        .map((file: { path: string }) => file.path)
        .filter((filePath: string) => filePath != path && filePath.startsWith(prefix));
    return uniq([...indexedPaths, ...filesystemPaths]);
};

const reloadPathsForHiddenRuleChange = async (superstate: Superstate, paths: string[]) => {
    const affectedSpaces = new Set<string>();
    await Promise.all(
        paths.map(async (path) => {
            const oldSpaces = superstate.pathsIndex.get(path)?.spaces ?? [];
            await superstate.reloadPath(path, true);
            if (superstate.pathsIndex.get(path)?.hidden == true && !isPathDirectlyHidden(superstate, path)) {
                await superstate.reloadPath(path, true);
            }
            (superstate.pathsIndex.get(path)?.spaces ?? oldSpaces).forEach((spacePath) => affectedSpaces.add(spacePath));
            oldSpaces.forEach((spacePath) => affectedSpaces.add(spacePath));
        }),
    );
    affectedSpaces.forEach((spacePath) => superstate.dispatchEvent("spaceStateUpdated", { path: spacePath }));
};

export const unhidePath = async (superstate: Superstate, path: string) => {
    superstate.settings.hiddenFiles = superstate.settings.hiddenFiles.filter((hiddenPath) => hiddenPath != path);
    superstate.saveSettings();
    await reloadPathsForHiddenRuleChange(superstate, uniq([path, ...descendantsForPath(superstate, path)]));
    superstate.dispatchEvent("superstateUpdated", null);
};

export const hidePaths = async (superstate: Superstate, paths: string[]) => {
    superstate.settings.hiddenFiles = uniq([...superstate.settings.hiddenFiles, ...paths]);
    superstate.saveSettings();
    Promise.all(
        paths.map((path) => {
            superstate.reloadPath(path, true);
        }),
    ).then(() => superstate.dispatchEvent("superstateUpdated", null));
};

export const deletePath = async (superstate: Superstate, path: string) => {
    superstate.spaceManager.deletePath(path);
    await superstate.onPathDeleted(path);
};

export const movePathToSpace = async (superstate: Superstate, oldPath: string, newParent: string) => {
    return superstate.spaceManager.renamePath(oldPath, movePath(oldPath, newParent));
};
