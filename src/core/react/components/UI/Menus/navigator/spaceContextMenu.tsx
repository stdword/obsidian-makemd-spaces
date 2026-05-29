import { savePathColor } from "core/superstate/utils/label";
import { hidePath, renamePathByName } from "core/superstate/utils/path";
import { addPathToSpaceAtIndex, removePathsFromSpace, removeSpace, updateSpaceSort } from "core/superstate/utils/spaces";
import { SelectOption, SelectOptionType, Superstate } from "makemd-core";
import React from "react";
import StickerModal from "shared/components/StickerModal";
import { default as i18n } from "shared/i18n";
import { PathState } from "shared/types/PathState";
import { SpaceSort } from "shared/types/spaceDef";
import { FilesystemSpaceInfo } from "shared/types/spaceInfo";
import { savePathSticker } from "shared/utils/sticker";
import { movePath } from "shared/utils/uri";
import { stringFromTag } from "utils/tags";
import { ConfirmationModal } from "../../Modals/ConfirmationModal";
import { InputModal } from "../../Modals/InputModal";
import { defaultMenu, menuSeparator } from "../menu/SelectionMenu";
import { showColorPickerMenu } from "../properties/colorPickerMenu";
import { showSpacesMenu } from "../properties/selectSpaceMenu";
import { showApplyItemsMenu } from "./showApplyItemsMenu";
import { showSpaceAddMenu } from "./showSpaceAddMenu";
import { Rect } from "shared/types/Pos";

export const showSpaceContextMenu = (superstate: Superstate, path: PathState, rect: Rect, win: Window, parentSpace?: string, onClose?: () => void) => {
    const space = superstate.spacesIndex.get(path.path);
    if (!space) return;
    const menuOptions: SelectOption[] = [];

    menuOptions.push({
        name: i18n.menu.new,
        icon: "ui//plus",
        type: SelectOptionType.Submenu,
        onSubmenu: (offset) => {
            return showSpaceAddMenu(superstate, offset, win, space, false, true);
        },
    });

    menuOptions.push(menuSeparator);

    menuOptions.push({
        name: i18n.menu.changeColor,
        icon: "ui//palette",
        type: SelectOptionType.Submenu,
        onSubmenu: (offset) => {
            return showColorPickerMenu(superstate, offset, win, "", (value) => savePathColor(superstate, space.path, value), false, true);
        },
    });
    if (space.path !== "/") {
        menuOptions.push({
            name: i18n.buttons.changeIcon,
            icon: "ui//sticker",
            onClick: (e) => {
                superstate.ui.openPalette(<StickerModal ui={superstate.ui} selectedSticker={(emoji) => savePathSticker(superstate, space.path, emoji)} />, win);
            },
        });
    }

    if (space.metadata?.sort) {
        menuOptions.push(menuSeparator);

        menuOptions.push({
            name: i18n.menu.sortBy,
            icon: "ui//sort-desc",
            type: SelectOptionType.Submenu,
            onSubmenu: (offset) => {
                const currentSpace = superstate.spacesIndex.get(space.path) ?? space;
                const sort = currentSpace.metadata?.sort ?? space.metadata.sort;
                const saveSort = (sortOption: SpaceSort) => updateSpaceSort(superstate, currentSpace.path, sortOption);
                const sortOptions: SelectOption[] = [];
                sortOptions.push({
                    name: i18n.menu.groupSpaces,
                    icon: "ui//arrow-up-down",
                    value: sort.group == true,
                    type: SelectOptionType.Radio,
                    onClick: (e) => {
                        saveSort({
                            field: sort.field,
                            asc: sort.asc,
                            group: !sort.group,
                            recursive: sort.recursive,
                        });
                    },
                });
                sortOptions.push(menuSeparator);
                sortOptions.push({
                    name: i18n.menu.recursiveSort,
                    icon: "ui//arrow-up-down",
                    value: sort.recursive == true,
                    type: SelectOptionType.Radio,
                    onClick: (e) => {
                        saveSort({
                            field: sort.field,
                            asc: sort.asc,
                            group: sort.group,
                            recursive: !sort.recursive,
                        });
                    },
                });
                sortOptions.push(menuSeparator);
                const rankSortOption: SpaceSort = {
                    field: "rank",
                    asc: true,
                    group: sort.group,
                    recursive: sort.recursive,
                };
                sortOptions.push({
                    name: i18n.menu.customSort,
                    icon: "ui//arrow-up-down",
                    value: sort.field == rankSortOption.field && sort.asc == rankSortOption.asc,
                    type: SelectOptionType.Radio,
                    onClick: (e) => {
                        saveSort(rankSortOption);
                    },
                });
                sortOptions.push(menuSeparator);
                const nameSortOption: SpaceSort = {
                    field: "name",
                    asc: true,
                    group: sort.group,
                    recursive: sort.recursive,
                };
                sortOptions.push({
                    name: i18n.menu.fileNameSortAlphaAsc,
                    icon: "ui//arrow-up-down",
                    value: sort.field == nameSortOption.field && sort.asc == nameSortOption.asc,
                    type: SelectOptionType.Radio,
                    onClick: (e) => {
                        saveSort(nameSortOption);
                    },
                });
                const nameSortOptionDesc: SpaceSort = {
                    field: "name",
                    asc: false,
                    group: sort.group,
                    recursive: sort.recursive,
                };
                sortOptions.push({
                    name: i18n.menu.fileNameSortAlphaDesc,
                    icon: "ui//arrow-up-down",
                    value: sort.field == nameSortOptionDesc.field && sort.asc == nameSortOptionDesc.asc,
                    type: SelectOptionType.Radio,
                    onClick: (e) => {
                        saveSort(nameSortOptionDesc);
                    },
                });
                sortOptions.push(menuSeparator);
                const numberSortOption: SpaceSort = {
                    field: "number",
                    asc: true,
                    group: sort.group,
                    recursive: sort.recursive,
                };
                sortOptions.push({
                    name: i18n.menu.fileNameSortNumericalAsc,
                    icon: "ui//arrow-up-down",
                    value: sort.field == numberSortOption.field && sort.asc == numberSortOption.asc,
                    type: SelectOptionType.Radio,
                    onClick: (e) => {
                        saveSort(numberSortOption);
                    },
                });
                const numberSortOptionDesc: SpaceSort = {
                    field: "number",
                    asc: false,
                    group: sort.group,
                    recursive: sort.recursive,
                };
                sortOptions.push({
                    name: i18n.menu.fileNameSortNumericalDesc,
                    icon: "ui//arrow-up-down",
                    value: sort.field == numberSortOptionDesc.field && sort.asc == numberSortOptionDesc.asc,
                    type: SelectOptionType.Radio,
                    onClick: (e) => {
                        saveSort(numberSortOptionDesc);
                    },
                });
                sortOptions.push(menuSeparator);
                const createdTimeSortOption: SpaceSort = {
                    field: "ctime",
                    asc: false,
                    group: sort.group,
                    recursive: sort.recursive,
                };
                sortOptions.push({
                    name: i18n.menu.createdTimeSortAsc,
                    icon: "ui//arrow-up-down",
                    value: sort.field == createdTimeSortOption.field && sort.asc == createdTimeSortOption.asc,
                    type: SelectOptionType.Radio,
                    onClick: (e) => {
                        saveSort(createdTimeSortOption);
                    },
                });
                const createdTimeSortOptionDesc: SpaceSort = {
                    field: "ctime",
                    asc: true,
                    group: sort.group,
                    recursive: sort.recursive,
                };
                sortOptions.push({
                    name: i18n.menu.createdTimeSortDesc,
                    icon: "ui//arrow-up-down",
                    value: sort.field == createdTimeSortOptionDesc.field && sort.asc == createdTimeSortOptionDesc.asc,
                    type: SelectOptionType.Radio,
                    onClick: (e) => {
                        saveSort(createdTimeSortOptionDesc);
                    },
                });
                sortOptions.push(menuSeparator);
                const modifiedTimeSortOption: SpaceSort = {
                    field: "mtime",
                    asc: false,
                    group: sort.group,
                    recursive: sort.recursive,
                };
                sortOptions.push({
                    name: i18n.menu.modifiedTimeSortAsc,
                    icon: "ui//arrow-up-down",
                    value: sort.field == modifiedTimeSortOption.field && sort.asc == modifiedTimeSortOption.asc,
                    type: SelectOptionType.Radio,
                    onClick: (e) => {
                        saveSort(modifiedTimeSortOption);
                    },
                });
                const modifiedTimeSortOptionDesc: SpaceSort = {
                    field: "mtime",
                    asc: true,
                    group: sort.group,
                    recursive: sort.recursive,
                };
                sortOptions.push({
                    name: i18n.menu.modifiedTimeSortDesc,
                    icon: "ui//arrow-up-down",
                    value: sort.field == modifiedTimeSortOptionDesc.field && sort.asc == modifiedTimeSortOptionDesc.asc,
                    type: SelectOptionType.Radio,
                    onClick: (e) => {
                        saveSort(modifiedTimeSortOptionDesc);
                    },
                });

                sortOptions.push(menuSeparator);
                const sizeSortOption: SpaceSort = {
                    field: "size",
                    asc: false,
                    group: sort.group,
                    recursive: sort.recursive,
                };
                sortOptions.push({
                    name: i18n.menu.sizeSortAsc,
                    icon: "ui//arrow-up-down",
                    value: sort.field == sizeSortOption.field && sort.asc == sizeSortOption.asc,
                    type: SelectOptionType.Radio,
                    onClick: (e) => {
                        saveSort(sizeSortOption);
                    },
                });
                const sizeSortOptionDesc: SpaceSort = {
                    field: "size",
                    asc: true,
                    group: sort.group,
                    recursive: sort.recursive,
                };
                sortOptions.push({
                    name: i18n.menu.sizeSortDesc,
                    icon: "ui//arrow-up-down",
                    value: sort.field == sizeSortOptionDesc.field && sort.asc == sizeSortOptionDesc.asc,
                    type: SelectOptionType.Radio,
                    onClick: (e) => {
                        saveSort(sizeSortOptionDesc);
                    },
                });

                return superstate.ui.openMenu(offset, defaultMenu(superstate.ui, sortOptions), win);
            },
        });
    }

    // apply to all sub-items
    menuOptions.push({
        name: i18n.menu.applyItems,
        icon: "ui//apply-items",
        value: "apply-all",
        type: SelectOptionType.Submenu,
        onSubmenu: (offset) => showApplyItemsMenu(offset, superstate, space, win),
    });


    if (space.type != "vault") {
        menuOptions.push(menuSeparator);

        // duplicate
        menuOptions.push({
            name: i18n.menu.duplicate,
            icon: "ui//documents",
            onClick: (e) => {
                superstate.spaceManager.copyPath(path.path, `${path.parent}`);
            },
        });

        // rename
        menuOptions.push({
            name: i18n.menu.rename,
            icon: "ui//edit",
            onClick: (e) => {
                superstate.ui.openModal(i18n.labels.rename, <InputModal saveLabel={i18n.buttons.rename} value={space.type == "tag" ? stringFromTag(space.name) : space.name} saveValue={(v) => renamePathByName(superstate, space.path, v)}></InputModal>, win);
            },
        });
    }

    const parentSpaceCache = superstate.spacesIndex.get(parentSpace);

    // move to
    if (space.type == "folder") {
        menuOptions.push({
            name: i18n.menu.moveFile,
            icon: "ui//paper-plane",
            onClick: (e) => {
                const offset = (e.target as HTMLButtonElement).getBoundingClientRect();
                showSpacesMenu(offset, win, superstate, (link) => {
                    superstate.spaceManager.renameSpace(space.path, movePath(space.path, link));
                });
            },
        });
    }

    // link to
    if (space.type == "folder") {
        menuOptions.push({
            name: i18n.buttons.addToSpace,
            icon: "ui//link",
            onClick: (e) => {
                const offset = (e.target as HTMLButtonElement).getBoundingClientRect();
                showSpacesMenu(
                    offset,
                    win,
                    superstate,
                    (link) => {
                        const spaceCache = superstate.spacesIndex.get(link);
                        if (spaceCache) addPathToSpaceAtIndex(superstate, spaceCache, space.path, -1);
                    },
                    true,
                );
            },
        });
    }

    menuOptions.push(menuSeparator);

    // reveal in OS
    menuOptions.push({
        name: superstate.ui.getOS() == "mac" ? i18n.menu.revealInDefault : i18n.menu.revealInExplorer,
        icon: "ui//arrow-up-right",
        onClick: (e) => {
            superstate.ui.openPath((space.space as FilesystemSpaceInfo).folderPath, "system");
        },
    });

    // obsidian menu
    if (superstate.ui.hasNativePathMenu(space.path)) {
        menuOptions.push({
            name: i18n.menu.openNativeMenu,
            icon: "ui//options",
            onClick: (e) => {
                superstate.ui.nativePathMenu(e, space.path);
            },
        });
    }

    menuOptions.push(menuSeparator);

    // unlink item
    if (parentSpaceCache && (parentSpaceCache.type == "folder" || parentSpaceCache.type == "vault")) {
        if (parentSpace != path.parent) {
            const spaceCache = superstate.spacesIndex.get(parentSpace);
            if (spaceCache) {
                menuOptions.push({
                    name: i18n.menu.removeFromSpace.replace("${1}", spaceCache.name),
                    icon: "ui//pin-off",
                    onClick: (e) => {
                        removePathsFromSpace(superstate, spaceCache.path, [space.path]);
                    },
                });
            }
        }
    }

    if (onClose) {
        menuOptions.push({
            name: i18n.menu.closeSpace,
            icon: "ui//close",
            onClick: (e) => {
                onClose();
            },
        });
    }

    // hide item
    if (space.type == "folder") {
        menuOptions.push({
            name: i18n.menu.hide,
            icon: "ui//eye-off",
            onClick: (e) => {
                hidePath(superstate, space.path);
            },
        });
    }

    // delete item
    if (space.type == "folder" || space.type == "tag")
        menuOptions.push({
            name: i18n.menu.delete,
            icon: "ui//trash",
            onClick: (e) => {
                superstate.ui.openModal(i18n.labels.deleteSpace, <ConfirmationModal confirmAction={() => removeSpace(superstate, space.path)} confirmLabel={i18n.buttons.delete} message={i18n.descriptions.deleteSpace}></ConfirmationModal>, win);
            },
        });

    superstate.ui.openMenu(rect, defaultMenu(superstate.ui, menuOptions), win);

    return false;
};
