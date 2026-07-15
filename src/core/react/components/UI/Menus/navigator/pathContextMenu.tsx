import React from "react";
import { InputModal } from "core/react/components/UI/Modals/InputModal";
import { openStickerPalette } from "core/react/components/PathSticker";
import { savePathColor } from "core/utils/superstate/label";
import { renamePathByName } from "core/utils/superstate/path";
import { excludePathsFromCurrentFocus } from "core/utils/superstate/focus";
import { TreeNode, createSpace, duplicatePathNextToOriginal, isPathPinnedInSpace, movePathToNewSpaceAtIndex, removePathsFromSpace, setPathPinnedInSpace } from "core/utils/superstate/spaces";
import { dropPathsInSpaceAtIndex } from "core/utils/dnd/dropPath";
import { saveColorForPaths, saveIconsForPaths } from "core/utils/emoji";
import { deletePath, movePathToSpace } from "core/utils/superstate/path";
import { revealPathInSpaces } from "core/commands/revealPathInSpaces";
import { pathDisplayInfo } from "core/react/components/UI/pathDisplay";

import { SelectOption, SelectOptionType, Superstate } from "makemd-core";
import { default as i18n } from "shared/i18n";
import { Anchors, Rect } from "shared/types/Pos";
import { windowFromDocument } from "utils/dom";
import { isTagSpacePath } from "schemas/builtin";
import { ConfirmationModal, formatMessage } from "../../Modals/ConfirmationModal";
import { defaultMenu, menuSeparator } from "../menu/SelectionMenu";
import { showColorPickerMenu } from "../modals/colorPickerMenu";
import { showFoldersMenu } from "../modals/selectSpaceMenu";
import { showSpaceContextMenu } from "./spaceContextMenu";
import { PathStateWithRank } from "shared/types/superstate";

function isLinkedFileMenuItem(item: PathStateWithRank, space?: string) {
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

    // open in a new tab
    menuOptions.push({
        name: i18n.menu.openInATab,
        icon: "ui//go-to-file",
        onClick: async () => {
            for (const path of paths)
                await superstate.ui.openPath(path, "tab");
        },
    });

    menuOptions.push(menuSeparator);

    // change color
    const hasLinkedFile = selectedPaths.some((s) => isLinkedFileMenuItem(s.item, s.space));
    if (!hasLinkedFile) {
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

    // pin / unpin
    const displaySpace = selectedPaths[0]?.space;
    const displaySpaceCache = displaySpace && selectedPaths.every((item) => item.space == displaySpace && item.depth > 0)
        ? superstate.spacesIndex.get(displaySpace)
        : null;
    if (displaySpaceCache) {
        const pinned = selectedPaths.every((item) => isPathPinnedInSpace(displaySpaceCache, item.path));
        menuOptions.push({
            name: pinned ? i18n.menu.unpin : i18n.menu.pinToTop,
            icon: pinned ? "ui//pin-off" : "ui//pin",
            onClick: async () => {
                for (const path of paths)
                    await setPathPinnedInSpace(superstate, displaySpaceCache.path, path, !pinned);
            },
        });
    }

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

    // move to
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

    // wrap to folder
    const parentPath = selectedPaths[0]?.item?.parent;
    if (parentPath != null && selectedPaths.every((item) => item.item?.parent == parentPath))
        menuOptions.push({
            name: i18n.menu.wrapToFolder,
            icon: "lucide//folder-symlink",
            closeParentImmediately: true,
            onClick: (e) => {
                const normalizedParentPath = parentPath != "/" ? parentPath : "";
                const folderPathForName = (value: string) => {
                    const folderName = value.replace(/\//g, "").trim();
                    return {
                        folderName,
                        folderPath: normalizedParentPath ? `${normalizedParentPath}/${folderName}` : folderName,
                    };
                };
                superstate.ui.openModal(
                    i18n.menu.wrapToFolder,
                    <InputModal
                        saveLabel={i18n.buttons.wrap}
                        value=""
                        saveValue={async (value) => {
                            const { folderPath } = folderPathForName(value);
                            if (await superstate.spaceManager.pathExists(folderPath)) {
                                superstate.ui.notify(i18n.notice.fileExists);
                                return;
                            }
                            await createSpace(superstate, folderPath);
                            for (const path of paths)
                                await superstate.spaceManager.renamePath(path, `${folderPath}/${path.split("/").pop()}`);
                        }}
                        validateValue={(value) => {
                            const { folderName, folderPath } = folderPathForName(value);
                            if (!folderName) return i18n.notice.emptyfolderName;
                            if (superstate.spacesIndex.has(folderPath)) return i18n.notice.duplicateFolderName;
                        }}
                    />,
                    windowFromDocument(e.view.document),
                );
            },
        });

    menuOptions.push(menuSeparator);

    // hide (disabled in favor of per-focus exclusions).
    // menuOptions.push({
    //     name: i18n.menu.hide,
    //     icon: "ui//eye-off",
    //     onClick: () => hidePaths(superstate, paths),
    // });

    // exclude from focus
    if (selectedPaths.every((item) => item.depth > 0))
        menuOptions.push({
            name: i18n.menu.excludeFromFocus,
            icon: "ui//eye-off",
            onClick: () => excludePathsFromCurrentFocus(superstate, paths),
        });

    // delete
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

    // open in a new tab
    menuOptions.push({
        name: i18n.menu.openInATab,
        icon: "ui//go-to-file",
        onClick: async () => {
            for (const path of paths) {
                await superstate.ui.openPath(path, "tab");
            }
        },
    });

    menuOptions.push(menuSeparator);

    // color
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

    // hide (disabled in favor of per-focus exclusions).
    // menuOptions.push({
    //     name: i18n.menu.hide,
    //     icon: "ui//eye-off",
    //     onClick: () => hidePaths(superstate, paths),
    // });

    // exclude from focus
    if (selectedPaths.every((item) => item.depth > 0))
        menuOptions.push({
            name: i18n.menu.excludeFromFocus,
            icon: "ui//eye-off",
            onClick: () => excludePathsFromCurrentFocus(superstate, paths),
        });

    // delete
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
    const pathCache = superstate.pathStateForPath?.(path) ?? superstate.pathsIndex.get(path);

    if (!pathCache) return;
    if (pathCache.type == "space") {
        showSpaceContextMenu(superstate, pathCache, rect, win, space, onClose, depth);
        return;
    }

    const parentIsTag = isTagSpacePath(space);
    const isSection = depth == 0;

    const parent = superstate.spacesIndex.get(space);
    const hasParent = !!parent;
    const isLink = hasParent && parent.path != pathCache.parent;

    const menuOptions: SelectOption[] = [];

    // color
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

    // pin / unpin
    if (hasParent && !isSection) {
        const pinned = isPathPinnedInSpace(parent, path);
        menuOptions.push({
            name: pinned ? i18n.menu.unpin : i18n.menu.pinToTop,
            icon: pinned ? "ui//pin-off" : "ui//pin",
            onClick: () => {
                setPathPinnedInSpace(superstate, parent.path, path, !pinned);
            },
        });
    }

    // wrap to folder
    if (!isSection) {
        menuOptions.push({
            name: i18n.menu.wrapToFolder,
            icon: "lucide//folder-symlink",
            closeParentImmediately: true,
            onClick: (e) => {
                const parentPath = pathCache.parent && pathCache.parent != "/" ? pathCache.parent : "";
                const folderPathForName = (value: string) => {
                    const folderName = value.replace(/\//g, "").trim();
                    return {
                        folderName,
                        folderPath: parentPath ? `${parentPath}/${folderName}` : folderName,
                    };
                };
                superstate.ui.openModal(
                    i18n.menu.wrapToFolder,
                    <InputModal
                        saveLabel={i18n.buttons.wrap}
                        value={pathDisplayInfo(path).title}
                        saveValue={async (value) => {
                            const { folderPath } = folderPathForName(value);
                            if (await superstate.spaceManager.pathExists(folderPath)) {
                                superstate.ui.notify(i18n.notice.fileExists);
                                return;
                            }
                            await createSpace(superstate, folderPath);
                            await superstate.spaceManager.renamePath(path, `${folderPath}/${path.split("/").pop()}`);
                        }}
                        validateValue={(value) => {
                            const { folderName, folderPath } = folderPathForName(value);
                            if (!folderName) return i18n.notice.emptyfolderName;
                            if (superstate.spacesIndex.has(folderPath)) return i18n.notice.duplicateFolderName;
                        }}
                    />,
                    windowFromDocument(e.view.document),
                );
            },
        });
    }

    menuOptions.push(menuSeparator);

    // duplicate
    menuOptions.push({
        name: i18n.menu.duplicate,
        icon: "ui//documents",
        onClick: () => {
            duplicatePathNextToOriginal(superstate, path, `${pathCache.parent}`, `${pathCache.name}`, space ?? pathCache.parent);
        },
    });

    // rename
    menuOptions.push({
        name: i18n.menu.rename,
        icon: "ui//edit",
        closeParentImmediately: true,
        onClick: (e) => {
            const isExcalidraw = path.toLowerCase().endsWith(".excalidraw.md");
            const displayName = isExcalidraw ? pathCache.name.replace(/\.excalidraw$/i, "") : pathCache.name;
            superstate.ui.openModal(i18n.labels.rename, <InputModal saveLabel={i18n.buttons.rename} value={displayName} saveValue={(value) => renamePathByName(superstate, path, isExcalidraw ? value.replace(/\.excalidraw(?:\.md)?$/i, "") : value)}></InputModal>, windowFromDocument(e.view.document));
        },
    });

    // move to
    if (!parentIsTag) {
        menuOptions.push({
            name: i18n.menu.moveFile,
            icon: "ui//paper-plane",
            closeParentImmediately: true,
            onClick: (e) => {
                const offset = (e.target as HTMLButtonElement).getBoundingClientRect();
                showFoldersMenu(offset, windowFromDocument(e.view.document), superstate, (link) => {
                    return movePathToNewSpaceAtIndex(superstate, pathCache, link);
                }, e.shiftKey);
            },
        });
    }

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

    // reveal
    if (parentIsTag || isLink) {
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

    // remove from focus
    if (onClose) {
        menuOptions.push({
            name: i18n.menu.closeSpace,
            icon: "ui//close",
            onClick: () => {
                onClose();
            },
        });
    }

    // unlink
    if (isLink && !parentIsTag)
        menuOptions.push({
            name: i18n.menu.removeFromSpace,
            icon: "ui//pin-off",
            onClick: () => {
                removePathsFromSpace(superstate, parent.path, [path]);
            },
        });

    // Hide (disabled in favor of per-focus exclusions).
    // menuOptions.push({
    //     name: i18n.menu.hide,
    //     icon: "ui//eye-off",
    //     onClick: () => hidePath(superstate, path),
    // });

    // exclude from focus
    if (!isSection && !isLink)
        menuOptions.push({
            name: i18n.menu.excludeFromFocus,
            icon: "ui//eye-off",
            onClick: () => excludePathsFromCurrentFocus(superstate, [path]),
        });

    // delete
    if (!isLink) {
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
    }

    superstate.ui.openMenu(rect, defaultMenu(superstate.ui, menuOptions), win, anchor);

    return false;
};
