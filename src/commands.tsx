import React from "react";

import { HiddenPaths } from "core/react/components/UI/Modals/HiddenFiles";
import { eventTypes } from "schemas/event";
import i18n from "shared/i18n";
import { windowFromDocument } from "utils/dom";
import MakeMDPlugin from "main";
import { pathDisplayInfo } from "core/react/components/UI/pathDisplay";

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
        id: "mk-link-active-file",
        name: i18n.commandPalette.linkActiveFileToSpace,
        callback: () => {
            const file = plugin.superstate.ui.activePath;
            if (!file)
                return;
            const pathState = plugin.superstate.pathsIndex.get(file);
            if (!pathState)
                return;

            if (plugin.superstate.focuses.length == 0) {
                const display = pathDisplayInfo('/');
                const newFocuses = [{
                    name: display.title,
                    sticker: display.icon,
                    paths: [file],
                }] as typeof plugin.superstate.focuses;
                plugin.superstate.spaceManager.saveFocuses(newFocuses);
                return;
            }

            const currentFocusIndex = plugin.superstate.settings.currentWaypoint;
            const currentFocus = plugin.superstate.focuses[currentFocusIndex];
            if (currentFocus.paths.includes(file))
                return;

            const nextFocuses = plugin.superstate.focuses.map((focus, index) => (
                (index == currentFocusIndex)
                    ? { ...focus, paths: [...focus.paths, file] }
                    : focus
            ));
            plugin.superstate.spaceManager.saveFocuses(nextFocuses);
        },
    });

    plugin.addCommand({
        id: "mk-open-spaces",
        name: i18n.commandPalette.openSpaces,
        callback: () => plugin.openFileTreeLeaf(true),
    });
};
