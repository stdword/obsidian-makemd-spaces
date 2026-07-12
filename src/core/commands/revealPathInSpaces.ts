import { Superstate } from "makemd-core";
import { eventTypes } from "schemas/event";
import i18n from "shared/i18n";
import { folderPathForHiddenFolderNote } from "integrations/folderNotesPluginIntegration";

export const revealPathInSpaces = async (superstate: Superstate, path: string) => {
    if (!path)
        return;
    const revealPath = folderPathForHiddenFolderNote(superstate, path) ?? path;

    const currentFocusIndex = superstate.settings.currentFocus;

    // order of search
    const focusIndexes = [
        currentFocusIndex,
        ...superstate.focuses.map((_, index) => index).filter((index) => index !== currentFocusIndex),
    ];

    const matches = focusIndexes.flatMap((focusIndex, searchOrder) =>
        superstate.focuses[focusIndex]?.paths
            .filter((availablePath) =>
                revealPath === availablePath || availablePath === "/" || revealPath.startsWith(`${availablePath}/`),
            )
            .map((availablePath) => ({ focusIndex, searchOrder, specificity: availablePath.length })) ?? [],
    );
    matches.sort((a, b) => b.specificity - a.specificity || a.searchOrder - b.searchOrder);
    const foundFocusIndex = matches[0]?.focusIndex;

    if (foundFocusIndex !== undefined && foundFocusIndex !== currentFocusIndex) {
        superstate.settings.currentFocus = foundFocusIndex;
        await superstate.saveSettings();

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
