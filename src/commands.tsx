import React from "react";

import { HiddenPaths } from "core/react/components/UI/Modals/HiddenFiles";
import { eventTypes } from "core/types/types";
import i18n from "shared/i18n";
import { windowFromDocument } from "shared/utils/dom";
import MakeMDPlugin from "main";

export const attachCommands = (plugin: MakeMDPlugin) => {
    plugin.addCommand({
        id: "mk-open-hidden",
        name: i18n.labels.manageHiddenFiles,
        callback: () => {
            plugin.superstate.ui.openModal(i18n.labels.hiddenFiles, <HiddenPaths superstate={plugin.superstate}></HiddenPaths>, windowFromDocument(plugin.app.workspace.getLeaf()?.containerEl.ownerDocument));
        },
    });

    plugin.addCommand({
        id: "mk-reveal-file",
        name: i18n.commandPalette.revealFile,
        callback: () => {
            const file = plugin.superstate.ui.activePath;
            if (!file) return;
            const evt = new CustomEvent(eventTypes.revealPath, {
                detail: { path: file },
            });
            window.dispatchEvent(evt);
        },
    });

    plugin.addCommand({
        id: "mk-pin-active",
        name: i18n.commandPalette.pinActiveFileToSpace,
        callback: () => {
            const file = plugin.superstate.ui.activePath;
            if (!file) return;
            const pathState = plugin.superstate.pathsIndex.get(file);
            if (!pathState) return;
            const currentFocusIndex = plugin.superstate.settings.currentWaypoint;
            const currentFocus = plugin.superstate.focuses[currentFocusIndex] ?? {
                name: i18n.labels.home,
                sticker: "ui//home",
                paths: [] as string[],
            };
            if (currentFocus.paths.includes(file)) return;
            const nextFocuses = plugin.superstate.focuses.map((focus, index) => (index == currentFocusIndex ? { ...currentFocus, paths: [...currentFocus.paths, file] } : focus));
            if (currentFocusIndex >= plugin.superstate.focuses.length) {
                nextFocuses.push({ ...currentFocus, paths: [file] });
            }
            plugin.superstate.spaceManager.saveFocuses(nextFocuses);
        },
    });

    plugin.addCommand({
        id: "mk-open-spaces",
        name: i18n.commandPalette.openSpaces,
        callback: () => plugin.openFileTreeLeaf(true),
    });
};
