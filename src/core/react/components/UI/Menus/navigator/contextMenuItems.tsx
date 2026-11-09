import React from "react";
import { InputModal } from "core/react/components/UI/Modals/InputModal";
import { openStickerPalette } from "core/react/components/PathSticker";
import { excludePathsFromCurrentFocus } from "core/utils/superstate/focus";
import { FocusModeSource, enterFocusMode } from "core/utils/superstate/focusMode";
import { isPathPinnedInSpace, setPathPinnedInSpace } from "core/utils/superstate/spaces";
import { revealPathInSpaces } from "core/commands/revealPathInSpaces";
import { validateWrapFolderName, wrapEachPathInOwnFolder, wrapFolderPathForName, wrapPathsInFolder } from "core/utils/superstate/wrapToFolder";
import { SelectOption, SelectOptionType, Superstate } from "makemd-core";
import { default as i18n } from "shared/i18n";
import { PathStateWithRank } from "shared/types/superstate";
import { SpaceState } from "shared/types/PathState";
import { windowFromDocument } from "utils/dom";
import { ConfirmationModal } from "../../Modals/ConfirmationModal";
import { menuSeparator } from "../menu/SelectionMenu";
import { showColorPickerMenu } from "../modals/colorPickerMenu";
import { showFoldersMenu } from "../modals/selectSpaceMenu";
import { copyPathMenuOption } from "./copyPathMenu";

/**
 * What a navigator context menu acts on. The four menus (single path, folder/tag space,
 * multi-select, multi-select under a tag) only differ in how these callbacks are wired;
 * the option labels, icons and flags live once in `menuItems` below.
 *
 * A behaviour left undefined means "this menu has no such item".
 */
export type ContextMenuTarget = {
    superstate: Superstate;
    win: Window;
    /** Paths the menu acts on; single-target menus pass one. */
    paths: string[];
    /** Space containing the item (for pin / unlink). */
    parent?: SpaceState | null;
    isSection?: boolean;
    isLink?: boolean;
    /** The containing space is a tag space. */
    parentIsTag?: boolean;
    onClose?: () => void;

    saveColor?: (value: string) => unknown;
    saveSticker?: (emoji: string) => unknown;
    copyPath?: boolean;
    wrap?: { parentPath: string; initialName: string; each?: PathStateWithRank[] };
    duplicate?: () => unknown;
    rename?: { value: string; save: (value: string) => unknown };
    moveTo?: (link: string) => unknown;
    linkTo?: (link: string) => unknown;
    revealInSpaces?: boolean;
    systemPath?: string;
    nativeMenuPath?: string;
    unlink?: () => unknown;
    excludeFromFocus?: boolean;
    /** Tree rows that become the sections of a temporary focus. */
    focusMode?: FocusModeSource[];
    remove?: { title: string; message: React.ReactNode; action: () => unknown };
};

export type MenuItemSpec = {
    when?: (target: ContextMenuTarget) => boolean;
    build: (target: ContextMenuTarget) => SelectOption | SelectOption[];
};

/** A menu is a list of groups; groups are separated by one separator each. */
export type MenuGroup = (MenuItemSpec | SelectOption | null | undefined | false)[];

// Handlers may be invoked from a real click (use its window) or programmatically.
const windowFor = (e: React.MouseEvent | undefined, target: ContextMenuTarget): Window => (e?.view?.document ? windowFromDocument(e.view.document) : target.win);
const anchorFor = (e: React.MouseEvent) => (e.target as HTMLElement).getBoundingClientRect();

export const openWrapToFolderModal = (superstate: Superstate, parentPath: string | undefined, initialName: string, paths: string[], win: Window) => {
    superstate.ui.openModal(
        i18n.menu.wrapToFolder,
        <InputModal
            saveLabel={i18n.buttons.wrap}
            value={initialName}
            saveValue={(value) => wrapPathsInFolder(superstate, wrapFolderPathForName(parentPath, value).folderPath, paths)}
            validateValue={(value) => validateWrapFolderName(superstate, parentPath, value)}
        />,
        win,
    );
};

export const menuItems = {
    openInTab: {
        build: (t) => ({
            name: i18n.menu.openInATab,
            icon: "ui//go-to-file",
            onClick: async () => {
                for (const path of t.paths) await t.superstate.ui.openPath(path, "tab");
            },
        }),
    },
    focusMode: {
        when: (t) => !!t.focusMode?.length,
        build: (t) => ({
            name: i18n.menu.focusMode,
            icon: "lucide//focus",
            onClick: () => enterFocusMode(t.superstate, t.focusMode),
        }),
    },
    changeColor: {
        when: (t) => !!t.saveColor,
        build: (t) => ({
            name: i18n.menu.changeColor,
            icon: "ui//palette",
            type: SelectOptionType.Submenu,
            closeParentOnOpen: true,
            onSubmenu: (offset) => showColorPickerMenu(t.superstate, offset, t.win, "", (value) => t.saveColor(value), false, true),
        }),
    },
    changeSticker: {
        when: (t) => !!t.saveSticker,
        build: (t) => ({
            name: i18n.buttons.changeIcon,
            icon: "ui//sticker",
            showChevron: true,
            onClick: (e) => {
                const win = windowFor(e, t);
                setTimeout(() => openStickerPalette(t.superstate, win, (emoji) => t.saveSticker(emoji)), 60);
            },
        }),
    },
    copyPath: {
        when: (t) => t.copyPath == true,
        build: (t) => copyPathMenuOption(t.superstate, t.paths[0], t.win),
    },
    pin: {
        when: (t) => !!t.parent && !t.isSection,
        build: (t) => {
            const pinned = t.paths.every((path) => isPathPinnedInSpace(t.parent, path));
            return {
                name: pinned ? i18n.menu.unpin : i18n.menu.pinToTop,
                icon: pinned ? "ui//pin-off" : "ui//pin",
                onClick: async () => {
                    for (const path of t.paths) await setPathPinnedInSpace(t.superstate, t.parent.path, path, !pinned);
                },
            };
        },
    },
    wrapToFolder: {
        when: (t) => !!t.wrap,
        build: (t) => ({
            name: i18n.menu.wrapToFolder,
            icon: "lucide//folder-symlink",
            closeParentImmediately: true,
            onClick: (e) => openWrapToFolderModal(t.superstate, t.wrap.parentPath, t.wrap.initialName, t.paths, windowFor(e, t)),
        }),
    },
    wrapEachToFolder: {
        when: (t) => !!t.wrap?.each,
        build: (t) => ({
            name: i18n.menu.wrapEachToFolder,
            icon: "lucide//folder-symlink",
            onClick: () => wrapEachPathInOwnFolder(t.superstate, t.wrap.each),
        }),
    },
    duplicate: {
        when: (t) => !!t.duplicate,
        build: (t) => ({
            name: i18n.menu.duplicate,
            icon: "ui//documents",
            onClick: () => t.duplicate(),
        }),
    },
    rename: {
        when: (t) => !!t.rename,
        build: (t) => ({
            name: i18n.menu.rename,
            icon: "ui//edit",
            closeParentImmediately: true,
            onClick: (e) => {
                t.superstate.ui.openModal(i18n.labels.rename, <InputModal saveLabel={i18n.buttons.rename} value={t.rename.value} saveValue={(value) => t.rename.save(value)}></InputModal>, windowFor(e, t));
            },
        }),
    },
    moveTo: {
        when: (t) => !!t.moveTo,
        build: (t) => ({
            name: i18n.menu.moveFile,
            icon: "ui//paper-plane",
            closeParentImmediately: true,
            onClick: (e) => showFoldersMenu(anchorFor(e), windowFor(e, t), t.superstate, (link) => t.moveTo(link), e.shiftKey),
        }),
    },
    linkTo: {
        when: (t) => !!t.linkTo,
        build: (t) => ({
            name: i18n.buttons.addToSpace,
            icon: "ui//link",
            closeParentImmediately: true,
            onClick: (e) => showFoldersMenu(anchorFor(e), windowFor(e, t), t.superstate, (link) => t.linkTo(link), e.shiftKey),
        }),
    },
    revealInSpaces: {
        when: (t) => t.revealInSpaces == true,
        build: (t) => ({
            name: i18n.menu.revealInSpaces,
            icon: "ui//arrow-up-right",
            onClick: () => revealPathInSpaces(t.superstate, t.paths[0]),
        }),
    },
    revealInSystem: {
        when: (t) => t.systemPath != null,
        build: (t) => ({
            name: t.superstate.ui.getOS() == "mac" ? i18n.menu.revealInDefault : i18n.menu.revealInExplorer,
            icon: "ui//arrow-up-right",
            onClick: () => {
                t.superstate.ui.openPath(t.systemPath, "system");
            },
        }),
    },
    nativeMenu: {
        when: (t) => !!t.nativeMenuPath && t.superstate.ui.hasNativePathMenu(t.nativeMenuPath),
        build: (t) => ({
            name: i18n.menu.openNativeMenu,
            icon: "ui//options",
            onClick: (e) => {
                t.superstate.ui.nativePathMenu(e, t.nativeMenuPath);
            },
        }),
    },
    closeSpace: {
        when: (t) => !!t.onClose,
        build: (t) => ({
            name: i18n.menu.closeSpace,
            icon: "ui//close",
            onClick: () => {
                t.onClose();
            },
        }),
    },
    unlink: {
        when: (t) => !!t.unlink,
        build: (t) => ({
            name: i18n.menu.removeFromSpace,
            icon: "ui//pin-off",
            onClick: () => t.unlink(),
        }),
    },
    excludeFromFocus: {
        when: (t) => t.excludeFromFocus == true,
        build: (t) => ({
            name: i18n.menu.excludeFromFocus,
            icon: "ui//eye-off",
            onClick: () => excludePathsFromCurrentFocus(t.superstate, t.paths),
        }),
    },
    delete: {
        when: (t) => !!t.remove,
        build: (t) => ({
            name: i18n.menu.delete,
            icon: "ui//trash",
            onClick: (e) => {
                t.superstate.ui.openModal(
                    t.remove.title,
                    <ConfirmationModal confirmAction={() => t.remove.action()} confirmLabel={i18n.buttons.delete} message={t.remove.message}></ConfirmationModal>,
                    windowFor(e, t),
                );
            },
        }),
    },
} satisfies Record<string, MenuItemSpec>;

const isSpec = (entry: MenuItemSpec | SelectOption): entry is MenuItemSpec => typeof (entry as MenuItemSpec).build == "function";

/** Resolves the groups for a target: skipped specs and empty groups vanish, one separator joins the rest. */
export const buildContextMenu = (target: ContextMenuTarget, groups: MenuGroup[]): SelectOption[] => {
    const resolved = groups
        .map((group) =>
            group
                .filter((entry): entry is MenuItemSpec | SelectOption => !!entry)
                .flatMap((entry) => (isSpec(entry) ? (entry.when && !entry.when(target) ? [] : [entry.build(target)].flat()) : [entry])),
        )
        .filter((group) => group.length > 0);
    return resolved.flatMap((group, index) => (index == 0 ? group : [menuSeparator, ...group]));
};
