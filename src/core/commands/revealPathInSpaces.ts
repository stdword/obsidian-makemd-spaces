import { Superstate } from "makemd-core";
import { currentFocusIndex, exitFocusMode, focusAtIndex, isFocusModeActive } from "core/utils/superstate/focusMode";
import { eventTypes } from "schemas/event";
import i18n from "shared/i18n";
import { folderPathForHiddenFolderNote } from "integrations/folderNotesPluginIntegration";

export const revealPathInSpaces = async (superstate: Superstate, path: string) => {
    if (!path)
        return;
    const revealPath = folderPathForHiddenFolderNote(superstate, path) ?? path;

    const activeFocusIndex = currentFocusIndex(superstate);

    // order of search
    const focusIndexes = [
        activeFocusIndex,
        ...superstate.focuses.map((_, index) => index).filter((index) => index !== activeFocusIndex),
    ];

    const matches = focusIndexes.flatMap((focusIndex, searchOrder) =>
        focusAtIndex(superstate, focusIndex)?.paths
            .filter((availablePath) =>
                revealPath === availablePath || availablePath === "/" || revealPath.startsWith(`${availablePath}/`),
            )
            .map((availablePath) => ({ focusIndex, searchOrder, specificity: availablePath.length })) ?? [],
    );
    matches.sort((a, b) => b.specificity - a.specificity || a.searchOrder - b.searchOrder);
    // Focus Mode is left only when the file is not in it at all, however specific another focus's section is.
    const stayInFocusMode = isFocusModeActive(superstate) && matches.some((match) => match.focusIndex == activeFocusIndex);
    const foundFocusIndex = stayInFocusMode ? activeFocusIndex : matches[0]?.focusIndex;

    if (foundFocusIndex !== undefined && foundFocusIndex !== activeFocusIndex) {
        if (isFocusModeActive(superstate)) {
            // The file lives only in a regular focus: Focus Mode gives way to it.
            await exitFocusMode(superstate, foundFocusIndex);
        } else {
            superstate.settings.currentFocus = foundFocusIndex;
            await superstate.saveSettings();
        }

        // Let React commit the new focus so the navigator reads its updated spaces.
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }

    let resultReceived = false;
    const onResult = (found: boolean) => {
        if (foundFocusIndex === undefined) return;
        if (resultReceived) return;
        resultReceived = true;
        if (!found) superstate.ui.notify(i18n.notice.notFound);
    };

    window.dispatchEvent(new CustomEvent(eventTypes.revealPath, { detail: { path: revealPath, onResult } }));

    if (foundFocusIndex === undefined) {
        superstate.ui.notify(i18n.notice.notFound);
    }
};
