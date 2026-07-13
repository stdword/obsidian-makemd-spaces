import { Superstate } from "makemd-core";

export const isPathExcludedFromFocus = (path: string, excludedPaths: string[] = []) =>
    excludedPaths.includes(path);

export const excludePathsFromCurrentFocus = async (superstate: Superstate, paths: string[]) => {
    return excludePathsFromFocus(superstate, superstate.settings.currentFocus, paths);
};

export const excludePathsFromFocus = async (superstate: Superstate, focusIndex: number, paths: string[]) => {
    const focus = superstate.focuses[focusIndex];
    if (!focus) return;

    const excludedPaths = Array.from(new Set([...(focus["excluded-paths"] ?? []), ...paths]));
    const focuses = superstate.focuses.map((item, index) =>
        index == focusIndex ? { ...item, "excluded-paths": excludedPaths } : item,
    );

    await superstate.spaceManager.saveFocuses(focuses);
};

export const removeExcludedPathFromFocus = async (superstate: Superstate, focusIndex: number, path: string) => {
    const focus = superstate.focuses[focusIndex];
    if (!focus) return;

    const focuses = superstate.focuses.map((item, index) =>
        index == focusIndex
            ? { ...item, "excluded-paths": (item["excluded-paths"] ?? []).filter((excludedPath) => excludedPath != path) }
            : item,
    );

    await superstate.spaceManager.saveFocuses(focuses);
};
