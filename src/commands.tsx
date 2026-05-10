import { HiddenPaths } from "core/react/components/UI/Modals/HiddenFiles";
import { addPathToSpaceAtIndex } from "core/superstate/utils/spaces";
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
          plugin.app.workspace.getLeaf()?.containerEl.ownerDocument
        )
      );
    },
  });
  // Navigator MVP excludes diagnostics, logs, and data-folder migration commands.
  // plugin.addCommand({
  //   id: "logs",
  //   name: i18n.commandPalette.toggleEnhancedLogs,
  //   callback: () => {
  //     plugin.superstate.settings.enhancedLogs =
  //       !plugin.superstate.settings.enhancedLogs;
  //     plugin.saveSettings();
  //   },
  // });
  if (plugin.superstate.settings.spacesEnabled) {
    // Navigator MVP excludes debug tab cleanup from the command palette.
    // plugin.addCommand({
    //   id: "mk-debug-close-tabs",
    //   name: i18n.commandPalette.closeExtraFileTabs,
    //   callback: () => {
    //     plugin.closeExtraFileTabs();
    //   },
    // });

    // Navigator MVP excludes onboarding and release notes commands.
    // plugin.addCommand({
    //   id: "mk-release-notes",
    //   name: i18n.commandPalette.releaseNotes,
    //   callback: () => {
    //     plugin.releaseTheNotes();
    //   },
    // });
    // plugin.addCommand({
    //   id: "mk-get-started",
    //   name: i18n.commandPalette.getStarted,
    //   callback: () => {
    //     plugin.getStarted();
    //   },
    // });
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
        plugin.quickOpen(plugin.superstate, BlinkMode.OpenSpaces, (space) => {
          const spaceCache = plugin.superstate.spacesIndex.get(space);
          if (spaceCache)
            addPathToSpaceAtIndex(plugin.superstate, spaceCache, file, -1);
        });
      },
    });

    plugin.addCommand({
      id: "mk-spaces",
      name: i18n.commandPalette.openSpaces,
      callback: () => plugin.openFileTreeLeaf(true),
    });
  }
  // Navigator MVP excludes folder-note conversion from the command palette.
  // if (plugin.superstate.settings.enableFolderNote) {
  //   plugin.addCommand({
  //     id: "mk-convert-folder-note",
  //     name: i18n.commandPalette.convertPathToSpace,
  //     callback: () => plugin.convertPathToSpace(),
  //   });
  // }
  if (plugin.superstate.settings.contextEnabled) {
    // Navigator MVP excludes the standalone file context explorer command.
    // plugin.addCommand({
    //   id: "mk-open-file-context",
    //   name: i18n.commandPalette.openFileContext,
    //   callback: () => plugin.openFileContextLeaf(FILE_CONTEXT_VIEW_TYPE, true),
    // });
  }
  // Navigator MVP excludes inline backlinks from the command palette.
  // if (plugin.superstate.settings.inlineBacklinks) {
  //   plugin.addCommand({
  //     id: "mk-toggle-backlinks",
  //     name: i18n.commandPalette.toggleBacklinks,
  //     callback: () => {
  //       const evt = new CustomEvent(eventTypes.toggleBacklinks);
  //       window.dispatchEvent(evt);
  //     },
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
