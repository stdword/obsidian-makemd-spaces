import { InputModal } from "core/react/components/UI/Modals/InputModal";
import { savePathColor } from "core/superstate/utils/label";
import { hidePath, hidePaths, renamePathByName } from "core/superstate/utils/path";
import { TreeNode, removePathsFromSpace } from "core/superstate/utils/spaces";
import { dropPathsInSpaceAtIndex } from "core/utils/dnd/dropPath";
import { saveColorForPaths, saveIconsForPaths } from "core/utils/emoji";
import React from "react";
import { openStickerPalette } from "shared/components/PathSticker";
import { default as i18n } from "shared/i18n";

import { deletePath, movePathToSpace } from "core/superstate/utils/path";
import { SelectOption, SelectOptionType, Superstate } from "makemd-core";
import { Anchors, Rect } from "shared/types/Pos";
import { windowFromDocument } from "shared/utils/dom";
import { movePath } from "shared/utils/uri";
import { ConfirmationModal } from "../../Modals/ConfirmationModal";
import { defaultMenu, menuSeparator } from "../menu/SelectionMenu";
import { showColorPickerMenu } from "../properties/colorPickerMenu";
import { showSpacesMenu } from "../properties/selectSpaceMenu";
import { showSpaceContextMenu } from "./spaceContextMenu";

export const triggerMultiPathMenu = (superstate: Superstate, selectedPaths: TreeNode[], e: React.MouseEvent | React.TouchEvent) => {
    const paths = selectedPaths.map((s) => s.item.path);
    const folderPaths = selectedPaths.filter((s) => s.item?.type == "space" && s.item.path != "/").map((s) => s.item.path);
    const menuOptions: SelectOption[] = [];

    // Open in a New Pane
    menuOptions.push({
        name: i18n.menu.openFilePane,
        icon: "ui//go-to-file",
        onClick: async (e) => {
            for (const path of paths) {
                await superstate.ui.openPath(path, "tab");
            }
        },
    });

    menuOptions.push(menuSeparator);

    // change color
    menuOptions.push({
        name: i18n.menu.changeColor,
        icon: "ui//palette",
        type: SelectOptionType.Submenu,
        closeParentOnOpen: true,
        onSubmenu: (offset) => {
            return showColorPickerMenu(superstate, offset, windowFromDocument(e.view.document), "", (value) => saveColorForPaths(superstate, paths, value), false, true);
        },
    });

    // change sticker
    if (folderPaths.length > 0) {
        menuOptions.push({
            name: i18n.buttons.changeIcon,
            icon: "ui//sticker",
            showChevron: true,
            onClick: (e) => {
                const win = windowFromDocument(e.view.document);
                setTimeout(() => openStickerPalette(superstate, win, (emoji) => saveIconsForPaths(superstate, folderPaths, emoji)), 60);
            },
        });
    }

    menuOptions.push(menuSeparator);

    // Move Item
    menuOptions.push({
        name: i18n.menu.moveFile,
        icon: "ui//paper-plane",
        onClick: (e) => {
            const offset = (e.target as HTMLButtonElement).getBoundingClientRect();
            showSpacesMenu(offset, windowFromDocument(e.view.document), superstate, (link) => {
                paths.forEach((f) => {
                    movePathToSpace(superstate, f, link);
                });
            });
        },
    });

    // link to...
    menuOptions.push({
        name: i18n.buttons.addToSpace,
        icon: "ui//link",
        onClick: (e) => {
            const offset = (e.target as HTMLButtonElement).getBoundingClientRect();
            showSpacesMenu(
                offset,
                windowFromDocument(e.view.document),
                superstate,
                (link) => {
                    dropPathsInSpaceAtIndex(
                        superstate,
                        selectedPaths.map((f) => f.path),
                        link,
                        -1,
                        "link",
                    );
                },
                true,
            );
        },
    });

    menuOptions.push(menuSeparator);

    // hide item
    menuOptions.push({
        name: i18n.menu.hide,
        icon: "ui//eye-off",
        onClick: (e) => {
            hidePaths(superstate, paths);
        },
    });

    // Delete Item
    menuOptions.push({
        name: i18n.menu.delete,
        icon: "ui//trash",
        onClick: (e) => {
            superstate.ui.openModal(
                i18n.labels.deleteFiles,
                <ConfirmationModal
                    confirmAction={() => {
                        paths.forEach((f) => {
                            deletePath(superstate, f);
                        });
                    }}
                    confirmLabel={i18n.buttons.delete}
                    message={i18n.descriptions.deleteFiles.replace("${1}", paths.length.toString())}
                ></ConfirmationModal>,
                windowFromDocument(e.view.document),
            );
        },
    });

    superstate.ui.openMenu((e.target as HTMLElement).getBoundingClientRect(), defaultMenu(superstate.ui, menuOptions), windowFromDocument(e.view.document));

    return false;
};

export const showPathContextMenu = (superstate: Superstate, path: string, space: string, rect: Rect, win: Window, anchor?: Anchors, onClose?: () => void) => {
    const cache = superstate.pathsIndex.get(path);

    if (cache.type == "space") {
        showSpaceContextMenu(superstate, cache, rect, win, space, onClose);
        return;
    }
    if (!cache) return;

    const menuOptions: SelectOption[] = [];

    // change color
    menuOptions.push({
        name: i18n.menu.changeColor,
        icon: "ui//palette",
        type: SelectOptionType.Submenu,
        closeParentOnOpen: true,
        onSubmenu: (offset) => {
            return showColorPickerMenu(superstate, offset, win, "", (value) => savePathColor(superstate, path, value), false, true);
        },
    });

    menuOptions.push(menuSeparator);

    // duplicate
    menuOptions.push({
        name: i18n.menu.duplicate,
        icon: "ui//documents",
        onClick: (e) => {
            superstate.spaceManager.copyPath(path, `${cache.parent}`, `${cache.name}`);
        },
    });

    // Rename Item
    menuOptions.push({
        name: i18n.menu.rename,
        icon: "ui//edit",
        onClick: (e) => {
            const isExcalidraw = path.toLowerCase().endsWith(".excalidraw.md");
            const displayName = isExcalidraw ? cache.name.replace(/\.excalidraw$/i, "") : cache.name;
            superstate.ui.openModal(i18n.labels.rename, <InputModal saveLabel={i18n.buttons.rename} value={displayName} saveValue={(value) => renamePathByName(superstate, path, isExcalidraw ? value.replace(/\.excalidraw(?:\.md)?$/i, "") : value)}></InputModal>, windowFromDocument(e.view.document));
        },
    });

    // move to
    menuOptions.push({
        name: i18n.menu.moveFile,
        icon: "ui//paper-plane",
        onClick: (e) => {
            const offset = (e.target as HTMLButtonElement).getBoundingClientRect();
            showSpacesMenu(offset, windowFromDocument(e.view.document), superstate, (link) => {
                const item = superstate.pathsIndex.get(path);
                superstate.spaceManager.renamePath(path, movePath(path, link));
            });
        },
    });

    // link to
    menuOptions.push({
        name: i18n.buttons.addToSpace,
        icon: "ui//link",
        onClick: (e) => {
            const offset = (e.target as HTMLButtonElement).getBoundingClientRect();
            showSpacesMenu(
                offset,
                windowFromDocument(e.view.document),
                superstate,
                (link) => {
                    dropPathsInSpaceAtIndex(superstate, [path], link, -1, "link");
                },
                true,
            );
        },
    });

    menuOptions.push(menuSeparator);

    // reveal in OS
    menuOptions.push({
        name: superstate.ui.getOS() == "mac" ? i18n.menu.revealInDefault : i18n.menu.revealInExplorer,
        icon: "ui//arrow-up-right",
        onClick: (e) => {
            superstate.ui.openPath(path, "system");
        },
    });

    // obsidian menu
    if (superstate.ui.hasNativePathMenu(path)) {
        menuOptions.push({
            name: i18n.menu.openNativeMenu,
            icon: "ui//options",
            onClick: (e) => {
                superstate.ui.nativePathMenu(e, path);
            },
        });
    }

    menuOptions.push(menuSeparator);

    if (onClose) {
        menuOptions.push({
            name: i18n.menu.closeSpace,
            icon: "ui//close",
            onClick: (e) => {
                onClose();
            },
        });
    }

    // unlink item
    if (space && space != cache.parent) {
        const spaceCache = superstate.spacesIndex.get(space);
        if (spaceCache) {
            menuOptions.push({
                name: i18n.menu.removeFromSpace.replace("${1}", spaceCache.name),
                icon: "ui//pin-off",
                onClick: (e) => {
                    removePathsFromSpace(superstate, spaceCache.path, [path]);
                },
            });
        }
    }

    // hide item
    menuOptions.push({
        name: i18n.menu.hide,
        icon: "ui//eye-off",
        onClick: (e) => {
            hidePath(superstate, path);
        },
    });

    // delete item
    menuOptions.push({
        name: i18n.menu.delete,
        icon: "ui//trash",
        onClick: (e) => {
            deletePath(superstate, path);
        },
    });

    superstate.ui.openMenu(rect, defaultMenu(superstate.ui, menuOptions), win, anchor);

    return false;
};
