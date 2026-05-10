import { HiddenPaths } from "core/react/components/UI/Modals/HiddenFiles";
import { eventTypes } from "core/types/types";
import MakeMDPlugin from "main";
import i18n from "shared/i18n";
import React from "react";
import { BlinkMode } from "shared/types/blink";
import { windowFromDocument } from "shared/utils/dom";

export const attachCommands = (plugin: MakeMDPlugin) => {
  plugin.addCommand({
    id: "open-hidden",
    name: i18n.labels.manageHiddenFiles,
    callback: () => {
      plugin.superstate.ui.openModal(
        i18n.labels.hiddenFiles,
        <HiddenPaths superstate={plugin.superstate}></HiddenPaths>,
        windowFromDocument(
          plugin.app.workspace.getLeaf()?.containerEl.ownerDocument,
        ),
      );
    },
  });
  // Navigator MVP excludes diagnostics and data-folder migration commands.
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
      const nextFocuses = plugin.superstate.focuses.map((focus, index) =>
        index == currentFocusIndex
          ? { ...currentFocus, paths: [...currentFocus.paths, file] }
          : focus,
      );
      if (currentFocusIndex >= plugin.superstate.focuses.length) {
        nextFocuses.push({ ...currentFocus, paths: [file] });
      }
      plugin.superstate.spaceManager.saveFocuses(nextFocuses);
    },
  });

  plugin.addCommand({
    id: "mk-spaces", // Open Navigator
    name: i18n.commandPalette.openSpaces,
    callback: () => plugin.openFileTreeLeaf(true),
  });
  // Navigator MVP excludes folder-note conversion from the command palette.
  // if (plugin.superstate.settings.enableFolderNote) {
  //   plugin.addCommand({
  //     id: "mk-convert-folder-note",
  //     name: i18n.commandPalette.convertPathToSpace,
  //     callback: () => plugin.convertPathToSpace(),
  //   });
  // }
  if (plugin.superstate.settings.blinkEnabled) {
    plugin.addCommand({
      id: "mk-blink",
      name: i18n.commandPalette.blink,
      callback: () => plugin.quickOpen(plugin.superstate, BlinkMode.Blink),
      hotkeys: [
        {
          modifiers: ["Mod"],
          key: "o",
        },
      ],
    });
  }

  // Navigator MVP excludes homepage management from the command palette.
  // plugin.addCommand({
  //   id: "mk-set-homepage",
  //   name: "Set Current Space/Path as Homepage",
  //   callback: () => {
  //     const currentPath = plugin.superstate.ui.activePath;
  //     if (currentPath) {
  //       plugin.superstate.settings.homepagePath = currentPath;
  //       plugin.saveSettings();
  //       plugin.superstate.ui.notify(`Homepage set to: ${currentPath}`);
  //     } else {
  //       plugin.superstate.ui.notify("No active path to set as homepage");
  //     }
  //   },
  // });
};
