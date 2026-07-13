export type Focus = {
    name: string;
    paths: string[];
    "excluded-paths"?: string[];
    sticker: string;
    archived?: boolean;
};

export const renameFocusExcludedPaths = (excludedPaths: string[] | undefined, oldPath: string, newPath: string) => {
    if (!excludedPaths) return excludedPaths;

    let changed = false;
    const renamedPaths = excludedPaths.map((path) => {
        if (path != oldPath && !path.startsWith(`${oldPath}/`)) return path;
        changed = true;
        return newPath + path.slice(oldPath.length);
    });

    return changed ? Array.from(new Set(renamedPaths)) : excludedPaths;
};
