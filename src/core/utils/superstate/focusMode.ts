import { Superstate } from "makemd-core";
import { isSpaceSeparatorPath } from "schemas/builtin";
import { Focus } from "shared/types/focus";
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

export const setCurrentExpandedSpaces = (superstate: Superstate, ids: string[]): void => {
    if (superstate.focusMode) {
        superstate.focusMode = { ...superstate.focusMode, expandedSpaces: ids };
        superstate.dispatchEvent("settingsChanged", null);
        return;
    }
    superstate.settings.expandedSpaces = ids;
    superstate.saveSettings(false);
};
