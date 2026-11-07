import { Superstate } from "makemd-core";
import { Focus } from "shared/types/focus";

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

// Drop target for paths dragged onto a focus tab: appends the new paths to that focus only.
export const addPathsToFocus = (focuses: Focus[], focusIndex: number, paths: string[]): Focus[] =>
    focuses.map((focus, index) => (index == focusIndex ? { ...focus, paths: [...focus.paths, ...paths.filter((path) => !focus.paths.includes(path))] } : focus));

const NO_EXCLUDED_PATHS: string[] = [];
// Stable empty array for focuses without exclusions, so memoized tree computations keyed on it do not rerun every render.
export const excludedPathsForFocus = (focus: Focus | undefined): string[] => focus?.["excluded-paths"] ?? NO_EXCLUDED_PATHS;
