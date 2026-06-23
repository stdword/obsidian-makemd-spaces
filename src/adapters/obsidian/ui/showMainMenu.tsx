import { defaultMenu, menuSeparator } from "core/react/components/UI/Menus/menu/SelectionMenu";
import { HiddenPaths } from "core/react/components/UI/Modals/HiddenFiles";
import MakeMDPlugin from "main";
import { SelectOption, Superstate } from "makemd-core";
import React from "react";
import i18n from "shared/i18n";
import { windowFromDocument } from "shared/utils/dom";

let activeMainMenu: ReturnType<Superstate["ui"]["openMenu"]> | null = null;

export const showMainMenu = (el: HTMLElement, superstate: Superstate, plugin: MakeMDPlugin) => {
    if (activeMainMenu?.isOpen?.()) {
        activeMainMenu.hide(true);
        activeMainMenu = null;
        return;
    }

    const toggleSections = (collapse: boolean) => {
        const spaces = superstate.focuses[superstate.settings.currentWaypoint].paths;
        const newSections = collapse ? [] : spaces;
        superstate.settings.expandedSpaces = newSections;
        superstate.saveSettings();
    };

    const menuOptions: SelectOption[] = [];

    menuOptions.push({
        name: i18n.menu.collapseAllSections,
        icon: "ui//chevrons-down-up",
        onClick: () => {
            toggleSections(true);
        },
    });

    menuOptions.push({
        name: i18n.menu.expandAllSections,
        icon: "ui//chevrons-up-down",
        onClick: () => {
            toggleSections(false);
        },
    });

    menuOptions.push(menuSeparator);

    menuOptions.push({
        name: i18n.labels.manageHiddenFiles,
        icon: "ui//eye-off",
        onClick: (e) => {
            superstate.ui.openModal(i18n.labels.hiddenFiles, <HiddenPaths superstate={superstate}></HiddenPaths>, windowFromDocument(e.view.document));
        },
    });

    menuOptions.push({
        name: i18n.menu.settings,
        icon: "ui//settings",
        onClick: (e) => {
            superstate.ui.openPath("obsidian://settings", false);
        },
    });

    const offset = el.getBoundingClientRect();
    activeMainMenu = superstate.ui.openMenu(offset, defaultMenu(superstate.ui, menuOptions), windowFromDocument(el.ownerDocument), "bottom", () => {
        activeMainMenu = null;
    });
};
