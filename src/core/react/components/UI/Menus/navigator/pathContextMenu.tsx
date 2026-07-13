import { InputModal } from "core/react/components/UI/Modals/InputModal";
import { savePathColor } from "core/utils/superstate/label";
import { renamePathByName } from "core/utils/superstate/path";
import { excludePathsFromCurrentFocus } from "core/utils/superstate/focus";
import { TreeNode, duplicatePathNextToOriginal, isPathPinnedInSpace, movePathToNewSpaceAtIndex, removePathsFromSpace, setPathPinnedInSpace } from "core/utils/superstate/spaces";
import { dropPathsInSpaceAtIndex } from "core/utils/dnd/dropPath";
import { saveColorForPaths, saveIconsForPaths } from "core/utils/emoji";
import React from "react";
import { openStickerPalette } from "core/react/components/PathSticker";
import { default as i18n } from "shared/i18n";

import { deletePath, movePathToSpace } from "core/utils/superstate/path";
import { SelectOption, SelectOptionType, Superstate } from "makemd-core";
import { Anchors, Rect } from "shared/types/Pos";
import { windowFromDocument } from "utils/dom";
import { ConfirmationModal, formatMessage } from "../../Modals/ConfirmationModal";
import { defaultMenu, menuSeparator } from "../menu/SelectionMenu";
import { showColorPickerMenu } from "../modals/colorPickerMenu";
import { showFoldersMenu } from "../modals/selectSpaceMenu";
import { showSpaceContextMenu } from "./spaceContextMenu";
import { isTagSpacePath } from "schemas/builtin";
import { revealPathInSpaces } from "core/commands/revealPathInSpaces";

function isLinkedFileMenuItem(item: any, space?: string) {
    return (
        !isTagSpacePath(space) && item?.type != "space" && space && item?.parent && space != item.parent
    )
}

export const triggerMultiPathMenu = (superstate: Superstate, selectedPaths: TreeNode[], e: React.MouseEvent | React.TouchEvent) => {
    const paths = selectedPaths.map((s) => s.item.path);

    const allUnderTagSpace = selectedPaths.every((s) => isTagSpacePath(s.space));
    if (allUnderTagSpace) {
        triggerMultiPathMenuForTagSpace(superstate, selectedPaths, e);
        return;
    }

    const menuOptions: SelectOption[] = [];

    // Open in a New Pane
    menuOptions.push({
        name: i18n.menu.openFilePane,
        icon: "ui//go-to-file",
        onClick: async () => {
            for (const path of paths) {
                await superstate.ui.openPath(path, "tab");
            }
        },
    });

    menuOptions.push(menuSeparator);

    const hasLinkedFile = selectedPaths.some((s) => isLinkedFileMenuItem(s.item, s.space));
    if (!hasLinkedFile) {
        // change color
        menuOptions.push({
            name: i18n.menu.changeColor,
            icon: "ui//palette",
            type: SelectOptionType.Submenu,
            closeParentOnOpen: true,
            onSubmenu: (offset) => {
                return showColorPickerMenu(superstate, offset, windowFromDocument(e.view.document), "", (value) => saveColorForPaths(superstate, selectedPaths.map((s) => ({ path: s.item.path, space: s.space })), value), false, true);
            },
        });
    }

    // change sticker
    const folderPaths = selectedPaths.filter((s) => s.item?.type == "space" && s.item.path != "/").map((s) => s.item.path);
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
        closeParentImmediately: true,
        onClick: (e) => {
            const offset = (e.target as HTMLButtonElement).getBoundingClientRect();
            showFoldersMenu(offset, windowFromDocument(e.view.document), superstate, (link) => {
                paths.forEach((f) => {
                    movePathToSpace(superstate, f, link);
                });
            }, e.shiftKey);
        },
    });

    // link to...
    menuOptions.push({
        name: i18n.buttons.addToSpace,
        icon: "ui//link",
        closeParentImmediately: true,
        onClick: (e) => {
            const offset = (e.target as HTMLButtonElement).getBoundingClientRect();
            showFoldersMenu(
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
                e.shiftKey,
            );
        },
    });

    menuOptions.push(menuSeparator);

    // Previous global Hide command (disabled in favor of per-focus exclusions).
    // menuOptions.push({
    //     name: i18n.menu.hide,
    //     icon: "ui//eye-off",
    //     onClick: () => hidePaths(superstate, paths),
    // });
    if (selectedPaths.every((item) => item.depth > 0))
        menuOptions.push({
            name: i18n.menu.excludeFromFocus,
            icon: "ui//eye-off",
            onClick: () => excludePathsFromCurrentFocus(superstate, paths),
        });

    // Delete Item
    menuOptions.push({
        name: i18n.menu.delete,
        icon: "ui//trash",
        onClick: (e) => {
            superstate.ui.openModal(
                i18n.labels.deleteFiles.replace("${1}", paths.length.toString()),
                <ConfirmationModal
                    confirmAction={() => {
                        paths.forEach((f) => {
                            deletePath(superstate, f);
                        });
                    }}
                    confirmLabel={i18n.buttons.delete}
                    message={<><div>{i18n.descriptions.deleteFiles}</div><div>{i18n.descriptions.deleteTags}</div></>}
                ></ConfirmationModal>,
                windowFromDocument(e.view.document),
            );
        },
    });

    superstate.ui.openMenu((e.target as HTMLElement).getBoundingClientRect(), defaultMenu(superstate.ui, menuOptions), windowFromDocument(e.view.document));

    return false;
};

export const triggerMultiPathMenuForTagSpace = (superstate: Superstate, selectedPaths: TreeNode[], e: React.MouseEvent | React.TouchEvent) => {
    const paths = selectedPaths.map((s) => s.item.path);

    const menuOptions: SelectOption[] = [];

    // Open in a New Pane
    menuOptions.push({
        name: i18n.menu.openFilePane,
        icon: "ui//go-to-file",
        onClick: async () => {
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

    menuOptions.push(menuSeparator);

    // link to...
    menuOptions.push({
        name: i18n.buttons.addToSpace,
        icon: "ui//link",
        closeParentImmediately: true,
        onClick: (e) => {
            const offset = (e.target as HTMLButtonElement).getBoundingClientRect();
            showFoldersMenu(
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
                e.shiftKey,
            );
        },
    });

    menuOptions.push(menuSeparator);

    // Previous global Hide command (disabled in favor of per-focus exclusions).
    // menuOptions.push({
    //     name: i18n.menu.hide,
    //     icon: "ui//eye-off",
    //     onClick: () => hidePaths(superstate, paths),
    // });
    if (selectedPaths.every((item) => item.depth > 0))
        menuOptions.push({
            name: i18n.menu.excludeFromFocus,
            icon: "ui//eye-off",
            onClick: () => excludePathsFromCurrentFocus(superstate, paths),
        });

    // Delete Item
    menuOptions.push({
        name: i18n.menu.delete,
        icon: "ui//trash",
        onClick: (e) => {
            superstate.ui.openModal(
                i18n.labels.deleteFiles.replace("${1}", paths.length.toString()),
                <ConfirmationModal
                    confirmAction={() => {
                        paths.forEach((f) => {
                            deletePath(superstate, f);
                        });
                    }}
                    confirmLabel={i18n.buttons.delete}
                    message={<><div>{i18n.descriptions.deleteFiles}</div><div>{i18n.descriptions.deleteTags}</div></>}
                ></ConfirmationModal>,
                windowFromDocument(e.view.document),
            );
        },
    });

    superstate.ui.openMenu((e.target as HTMLElement).getBoundingClientRect(), defaultMenu(superstate.ui, menuOptions), windowFromDocument(e.view.document));

    return false;
};

export const showPathContextMenu = (superstate: Superstate, path: string, space: string, rect: Rect, win: Window, anchor?: Anchors, onClose?: () => void, depth = 0) => {
    const cache = superstate.pathStateForPath?.(path) ?? superstate.pathsIndex.get(path);

    if (!cache) return;
    if (cache.type == "space") {
        showSpaceContextMenu(superstate, cache, rect, win, space, onClose, depth);
        return;
    }

    const menuOptions: SelectOption[] = [];

    // change color
    menuOptions.push({
        name: i18n.menu.changeColor,
        icon: "ui//palette",
        type: SelectOptionType.Submenu,
        closeParentOnOpen: true,
        onSubmenu: (offset) => {
            return showColorPickerMenu(superstate, offset, win, "", (value) => savePathColor(superstate, path, value, space), false, true);
        },
    });

    menuOptions.push(menuSeparator);

    const displaySpace = superstate.spacesIndex.get(space);
    if (displaySpace && depth > 0) {
        const pinned = isPathPinnedInSpace(displaySpace, path);
        menuOptions.push({
            name: pinned ? i18n.menu.unpin : i18n.menu.pinToTop,
            icon: pinned ? "ui//pin-off" : "ui//pin",
            onClick: () => {
                setPathPinnedInSpace(superstate, displaySpace.path, path, !pinned);
            },
        });
    }

    // duplicate
    menuOptions.push({
        name: i18n.menu.duplicate,
        icon: "ui//documents",
        onClick: () => {
            duplicatePathNextToOriginal(superstate, path, `${cache.parent}`, `${cache.name}`, space ?? cache.parent);
        },
    });

    // Rename Item
    menuOptions.push({
        name: i18n.menu.rename,
        icon: "ui//edit",
        closeParentImmediately: true,
        onClick: (e) => {
            const isExcalidraw = path.toLowerCase().endsWith(".excalidraw.md");
            const displayName = isExcalidraw ? cache.name.replace(/\.excalidraw$/i, "") : cache.name;
            superstate.ui.openModal(i18n.labels.rename, <InputModal saveLabel={i18n.buttons.rename} value={displayName} saveValue={(value) => renamePathByName(superstate, path, isExcalidraw ? value.replace(/\.excalidraw(?:\.md)?$/i, "") : value)}></InputModal>, windowFromDocument(e.view.document));
        },
    });

    // move to
    if (!isTagSpacePath(space))
        menuOptions.push({
            name: i18n.menu.moveFile,
            icon: "ui//paper-plane",
            closeParentImmediately: true,
            onClick: (e) => {
                const offset = (e.target as HTMLButtonElement).getBoundingClientRect();
                showFoldersMenu(offset, windowFromDocument(e.view.document), superstate, (link) => {
                    return movePathToNewSpaceAtIndex(superstate, cache, link);
                }, e.shiftKey);
            },
        });

    // link to
    menuOptions.push({
        name: i18n.buttons.addToSpace,
        icon: "ui//link",
        closeParentImmediately: true,
        onClick: (e) => {
            const offset = (e.target as HTMLButtonElement).getBoundingClientRect();
            showFoldersMenu(
                offset,
                windowFromDocument(e.view.document),
                superstate,
                (link) => {
                    dropPathsInSpaceAtIndex(superstate, [path], link, -1, "link");
                },
                e.shiftKey,
            );
        },
    });

    menuOptions.push(menuSeparator);

    if (isTagSpacePath(space) || isLinkedFileMenuItem(cache, space)) {
        menuOptions.push({
            name: i18n.menu.revealInSpaces,
            icon: "ui//arrow-up-right",
            onClick: () => revealPathInSpaces(superstate, path),
        });
    }

    // reveal in OS
    menuOptions.push({
        name: superstate.ui.getOS() == "mac" ? i18n.menu.revealInDefault : i18n.menu.revealInExplorer,
        icon: "ui//arrow-up-right",
        onClick: () => {
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
            onClick: () => {
                onClose();
            },
        });
    }

    // unlink item
    if (space && space != cache.parent && !isTagSpacePath(space)) {
        const spaceCache = superstate.spacesIndex.get(space);
        if (spaceCache) {
            menuOptions.push({
                name: i18n.menu.removeFromSpace.replace("${1}", spaceCache.name),
                icon: "ui//pin-off",
                onClick: () => {
                    removePathsFromSpace(superstate, spaceCache.path, [path]);
                },
            });
        }
    }

    // Previous global Hide command (disabled in favor of per-focus exclusions).
    // menuOptions.push({
    //     name: i18n.menu.hide,
    //     icon: "ui//eye-off",
    //     onClick: () => hidePath(superstate, path),
    // });
    if (depth > 0)
        menuOptions.push({
            name: i18n.menu.excludeFromFocus,
            icon: "ui//eye-off",
            onClick: () => excludePathsFromCurrentFocus(superstate, [path]),
        });

    // delete item
    menuOptions.push({
        name: i18n.menu.delete,
        icon: "ui//trash",
        onClick: (e) => {
            superstate.ui.openModal(
                i18n.labels.deleteFile,
                <ConfirmationModal
                    confirmAction={() => {
                        deletePath(superstate, path);
                    }}
                    confirmLabel={i18n.buttons.delete}
                    message={formatMessage(i18n.descriptions.deleteFile, [<i>{path.split("/").pop()}</i>])}
                ></ConfirmationModal>,
                windowFromDocument(e.view.document),
            );
        },
    });

    superstate.ui.openMenu(rect, defaultMenu(superstate.ui, menuOptions), win, anchor);

    return false;
};
