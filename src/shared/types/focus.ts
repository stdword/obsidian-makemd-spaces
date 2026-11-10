export type Focus = {
    name: string;
    paths: string[];
    "excluded-paths"?: string[];
    sticker: string;
    archived?: boolean;
};

/** Focus Mode: a temporary focus that lives only in memory. */
export type FocusModeState = {
    focus: Focus;
    /** Expand keys of the temporary tree; never written to settings directly. */
    expandedSpaces: string[];
    /** The expand key each section's row has in the regular tree, for carrying collapse state back. */
    origins: { path: string; originKey: string }[];
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
