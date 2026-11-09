import _ from "lodash";
import { Superstate } from "makemd-core";
import { isSpaceSeparatorPath } from "schemas/builtin";
import { Focus, FocusModeState, renameFocusExcludedPaths } from "shared/types/focus";
import { renameExpandedSpacePaths } from "shared/types/settings";
import { ExpandedIdMapping, translateExpandedIds, writeBackExpandedIds } from "./expandedIds";

// Focus Mode is a temporary focus that lives only in memory: it is kept apart from
// `superstate.focuses` (which is saved to focuses.json as a whole) and is addressed by this
// sentinel index. `settings.currentFocus` keeps pointing at the regular focus to return to.
export const FOCUS_MODE_INDEX = -1;

/** A selected tree row: its path and, when known, the row id it had in the tree it was picked from. */
export type FocusModeSource = { path: string; originId?: string };

const isUnder = (id: string, root: string) => id == root || id.startsWith(`${root}/`);

export const isFocusModeActive = (superstate: Superstate): boolean => !!superstate.focusMode;

export const currentFocusIndex = (superstate: Superstate): number =>
    superstate.focusMode ? FOCUS_MODE_INDEX : superstate.settings.currentFocus;

export const focusAtIndex = (superstate: Superstate, index: number): Focus | undefined =>
    index == FOCUS_MODE_INDEX ? superstate.focusMode?.focus : superstate.focuses[index];

export const currentFocus = (superstate: Superstate): Focus | undefined => focusAtIndex(superstate, currentFocusIndex(superstate));

const keepExpandedState = (superstate: Superstate) => {
    const { expandedSpaces, origins } = superstate.focusMode;
    const mappings: ExpandedIdMapping[] = origins.map((origin) => ({ from: origin.path, to: origin.originId }));
    superstate.settings.expandedSpaces = writeBackExpandedIds(superstate.settings.expandedSpaces ?? [], expandedSpaces, mappings);
};

export const enterFocusMode = (superstate: Superstate, sources: FocusModeSource[]): void => {
    const unique = sources.filter((source, index) => sources.findIndex((other) => other.path == source.path) == index);
    if (unique.length == 0) return;

    const previous = superstate.focusMode;
    const placed = unique.filter((source) => source.originId != null);
    const expandedSpaces = translateExpandedIds(
        currentExpandedSpaces(superstate),
        placed.map((source) => ({ from: source.originId, to: source.path })),
    );
    // Inside Focus Mode a row id belongs to the temporary tree; resolve it to the regular
    // tree through the section it sits under. Rows with no regular place have no origin.
    const origins = placed.flatMap((source) => {
        if (!previous) return [{ path: source.path, originId: source.originId }];
        const section = previous.origins.find((origin) => isUnder(source.originId, origin.path));
        return section ? [{ path: source.path, originId: section.originId + source.originId.slice(section.path.length) }] : [];
    });
    if (previous && superstate.settings.focusModeKeepExpanded) keepExpandedState(superstate);

    superstate.focusMode = {
        focus: { name: "", sticker: "", paths: unique.map((source) => source.path) },
        expandedSpaces,
        origins,
    };
    superstate.dispatchEvent("focusesChanged", null);
    superstate.dispatchEvent("settingsChanged", null);
};

export const exitFocusMode = async (superstate: Superstate, nextFocusIndex?: number): Promise<void> => {
    if (!superstate.focusMode) return;
    if (superstate.settings.focusModeKeepExpanded) keepExpandedState(superstate);
    superstate.focusMode = null;

    const isOpenable = (index: number) => !!superstate.focuses[index] && !superstate.focuses[index].archived;
    const target = nextFocusIndex ?? superstate.settings.currentFocus;
    superstate.settings.currentFocus = isOpenable(target) ? target : Math.max(0, superstate.focuses.findIndex((focus) => !focus.archived));

    await superstate.saveSettings();
    superstate.dispatchEvent("focusesChanged", null);
};

export const updateFocusAtIndex = async (superstate: Superstate, index: number, update: (focus: Focus) => Focus): Promise<void> => {
    if (index == FOCUS_MODE_INDEX) {
        if (!superstate.focusMode) return;
        const focus = update(superstate.focusMode.focus);
        superstate.focusMode = { ...superstate.focusMode, focus };
        if (focus.paths.every(isSpaceSeparatorPath)) return exitFocusMode(superstate);
        superstate.dispatchEvent("focusesChanged", null);
        return;
    }
    if (!superstate.focuses[index]) return;
    await superstate.spaceManager.saveFocuses(superstate.focuses.map((focus, i) => (i == index ? update(focus) : focus)));
};

export const updateCurrentFocus = (superstate: Superstate, update: (focus: Focus) => Focus): Promise<void> =>
    updateFocusAtIndex(superstate, currentFocusIndex(superstate), update);

export const currentExpandedSpaces = (superstate: Superstate): string[] =>
    superstate.focusMode ? superstate.focusMode.expandedSpaces : superstate.settings.expandedSpaces ?? [];

/** `refresh` re-renders the navigator from the stored state; the tree itself passes false because it already holds the new state. */
export const setCurrentExpandedSpaces = (superstate: Superstate, ids: string[], refresh = false): void => {
    if (superstate.focusMode) {
        superstate.focusMode = { ...superstate.focusMode, expandedSpaces: ids };
        if (refresh) superstate.dispatchEvent("settingsChanged", null);
        return;
    }
    superstate.settings.expandedSpaces = ids;
    superstate.saveSettings(refresh);
};

/** Follows a renamed or moved path inside the temporary focus. Saves nothing. */
export const renameFocusModePath = (superstate: Superstate, oldPath: string, newPath: string): void => {
    const state = superstate.focusMode;
    if (!state) return;
    const renamePath = (path: string) => (isUnder(path, oldPath) ? newPath + path.slice(oldPath.length) : path);
    const renameId = (id: string) => renameExpandedSpacePaths([id], oldPath, newPath)[0];

    const next: FocusModeState = {
        focus: {
            ...state.focus,
            paths: state.focus.paths.map(renamePath),
            ...(state.focus["excluded-paths"] ? { "excluded-paths": renameFocusExcludedPaths(state.focus["excluded-paths"], oldPath, newPath) } : {}),
        },
        expandedSpaces: renameExpandedSpacePaths(state.expandedSpaces, oldPath, newPath),
        origins: state.origins.map((origin) => ({ path: renamePath(origin.path), originId: renameId(origin.originId) })),
    };
    if (_.isEqual(next, state)) return;
    superstate.focusMode = next;
    superstate.dispatchEvent("focusesChanged", null);
    superstate.dispatchEvent("settingsChanged", null);
};

/** Drops a deleted path from the temporary sections; Focus Mode closes once nothing is left. */
export const removeFocusModePath = async (superstate: Superstate, path: string): Promise<void> => {
    if (!superstate.focusMode?.focus.paths.includes(path)) return;
    await updateFocusAtIndex(superstate, FOCUS_MODE_INDEX, (focus) => ({ ...focus, paths: focus.paths.filter((item) => item != path) }));
};

/** A press on a regular focus tab. A plain left press leaves Focus Mode for that focus right away. */
export const focusTabPointerDown = (superstate: Superstate, index: number, e: { button: number; ctrlKey: boolean }): boolean => {
    // Ctrl+click is a right click on macOS; right clicks are handled by focusTabContextMenu.
    if (!superstate.focusMode || e.button != 0 || e.ctrlKey) return false;
    exitFocusMode(superstate, index);
    return true;
};

/** A right click on a regular focus tab only closes Focus Mode; returns true when the tab menu must not open. */
export const focusTabContextMenu = (superstate: Superstate): boolean => {
    if (!superstate.focusMode) return false;
    exitFocusMode(superstate);
    return true;
};
