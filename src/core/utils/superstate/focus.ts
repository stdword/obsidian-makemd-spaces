import { Superstate } from "makemd-core";
import { Focus } from "shared/types/focus";
import { currentFocusIndex, updateFocusAtIndex } from "./focusMode";

export const isPathExcludedFromFocus = (path: string, excludedPaths: string[] = []) =>
    excludedPaths.includes(path);

export const excludePathsFromCurrentFocus = async (superstate: Superstate, paths: string[]) => {
    return excludePathsFromFocus(superstate, currentFocusIndex(superstate), paths);
};

// `focusIndex` may be FOCUS_MODE_INDEX: the temporary focus keeps its exclusions in memory only.
export const excludePathsFromFocus = async (superstate: Superstate, focusIndex: number, paths: string[]) => {
    await updateFocusAtIndex(superstate, focusIndex, (focus) => ({
        ...focus,
        "excluded-paths": Array.from(new Set([...(focus["excluded-paths"] ?? []), ...paths])),
    }));
};

export const removeExcludedPathFromFocus = async (superstate: Superstate, focusIndex: number, path: string) => {
    await updateFocusAtIndex(superstate, focusIndex, (focus) => ({
        ...focus,
        "excluded-paths": (focus["excluded-paths"] ?? []).filter((excludedPath) => excludedPath != path),
    }));
};

// Drop target for paths dragged onto a focus tab: appends the new paths to that focus only.
export const addPathsToFocus = (focuses: Focus[], focusIndex: number, paths: string[]): Focus[] =>
    focuses.map((focus, index) => (index == focusIndex ? { ...focus, paths: [...focus.paths, ...paths.filter((path) => !focus.paths.includes(path))] } : focus));

const NO_EXCLUDED_PATHS: string[] = [];
// Stable empty array for focuses without exclusions, so memoized tree computations keyed on it do not rerun every render.
export const excludedPathsForFocus = (focus: Focus | undefined): string[] => focus?.["excluded-paths"] ?? NO_EXCLUDED_PATHS;
