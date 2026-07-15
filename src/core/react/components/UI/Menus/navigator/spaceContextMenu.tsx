import React from "react";
import { savePathColor } from "core/utils/superstate/label";
import { renamePathByName } from "core/utils/superstate/path";
import { excludePathsFromCurrentFocus } from "core/utils/superstate/focus";
import { addSpaceSeparator, duplicatePathNextToOriginal, effectiveSpaceSort, isPathPinnedInSpace, linkPathToSpaceAtIndex, linkedTagSpaceUri, removePathsFromSpace, removeSpace, setLinkedTagSpaceFiltered, setPathPinnedInSpace, updateSpaceSort } from "core/utils/superstate/spaces";
import { openStickerPalette } from "core/react/components/PathSticker";
import { revealPathInSpaces } from "core/commands/revealPathInSpaces";
import { addTag, mergeTagSpaceMetadata } from "core/utils/superstate/tags";
import { SelectOption, SelectOptionType, Superstate } from "makemd-core";
import { default as i18n } from "shared/i18n";
import { PathState, FilesystemSpaceInfo } from "shared/types/PathState";
import { Rect } from "shared/types/Pos";
import { isFilteredTagSpaceLink, isTagSpacePath } from "schemas/builtin";
import { SpaceSort } from "shared/types/spaceDef";
import { savePathSticker } from "utils/sticker";
import { movePath } from "utils/uri";
import { stringFromTag } from "utils/tags";
import { ConfirmationModal, formatMessage } from "../../Modals/ConfirmationModal";
import { InputModal } from "../../Modals/InputModal";
import { defaultMenu, menuSeparator } from "../menu/SelectionMenu";
import { showColorPickerMenu } from "../modals/colorPickerMenu";
import { showFoldersMenu, showTagsMenu } from "../modals/selectSpaceMenu";
import { showApplyItemsMenu } from "./showApplyItemsMenu";
import { newNoteMenuOption, showSpaceAddMenu } from "./showSpaceAddMenu";


export const showSpaceContextMenu = (superstate: Superstate, path: PathState, rect: Rect, win: Window, parentSpace?: string, onClose?: () => void, depth = 0) => {
    const space = superstate.spacesIndex.get(path.path);
    if (!space) return;
    const isTagSpace = space.type == "tag" || isTagSpacePath(path.path);
    const menuOptions: SelectOption[] = [];

    if (!isTagSpace) {
        menuOptions.push(newNoteMenuOption(superstate, space));

        menuOptions.push({
            name: i18n.menu.new,
            icon: "ui//plus",
            type: SelectOptionType.Submenu,
            onSubmenu: (offset, onHide) => {
                return showSpaceAddMenu(superstate, offset, win, space, false, true, onHide);
            },
        });
    }
    else {
        menuOptions.push({
            name: i18n.buttons.createSeparator,
            icon: "lucide//separator-horizontal",
            onClick: () => addSpaceSeparator(superstate, space.path),
        });
    }

    menuOptions.push(menuSeparator);

    menuOptions.push({  // color
        name: i18n.menu.changeColor,
        icon: "ui//palette",
        type: SelectOptionType.Submenu,
        closeParentOnOpen: true,
        onSubmenu: (offset, onHide) => {
            return showColorPickerMenu(superstate, offset, win, "", (value) => savePathColor(superstate, space.path, value), false, true);
        },
    });

    if (space.path !== "/" && !isTagSpace) {
        menuOptions.push({  // sticker
            name: i18n.buttons.changeIcon,
            icon: "ui//sticker",
            showChevron: true,
            onClick: () => {
                setTimeout(() => openStickerPalette(superstate, win, (emoji) => savePathSticker(superstate, space.path, emoji)), 60);
            },
        });
    }

    menuOptions.push(menuSeparator);

    menuOptions.push({  // sort
        name: i18n.menu.sortBy,
        icon: "ui//sort-desc",
        type: SelectOptionType.Submenu,
        onSubmenu: (offset, onHide) => {
            const currentSpace = superstate.spacesIndex.get(space.path) ?? space;
            const sort = effectiveSpaceSort(currentSpace.metadata?.sort, superstate.settings);
            const saveSort = (sortOption: Partial<SpaceSort> | null) => updateSpaceSort(superstate, currentSpace.path, sortOption);
            const sortOptions: SelectOption[] = [];
            const sortFieldOptions: { name: string; sort: Pick<SpaceSort, "field" | "asc"> }[] = [
                { name: i18n.menu.customSort, sort: { field: "rank", asc: true } },
                { name: i18n.menu.fileNameSortAlphaAsc, sort: { field: "name", asc: true } },
                { name: i18n.menu.fileNameSortAlphaDesc, sort: { field: "name", asc: false } },
                { name: i18n.menu.createdTimeSortAsc, sort: { field: "ctime", asc: false } },
                { name: i18n.menu.createdTimeSortDesc, sort: { field: "ctime", asc: true } },
                { name: i18n.menu.modifiedTimeSortAsc, sort: { field: "mtime", asc: false } },
                { name: i18n.menu.modifiedTimeSortDesc, sort: { field: "mtime", asc: true } },
            ];
            sortOptions.push({
                name: i18n.menu.groupSpaces,
                icon: "lucide//folder-up",
                value: sort.group == true,
                type: SelectOptionType.Radio,
                onClick: () => saveSort({ group: !sort.group }),
            });
            if (isTagSpace) {
                sortOptions.push({
                    name: i18n.menu.groupSubtags,
                    icon: "lucide//tags",
                    value: sort.subtags == true,
                    type: SelectOptionType.Radio,
                    onClick: () => saveSort({ subtags: !sort.subtags }),
                });
            }
            sortOptions.push(menuSeparator);
            sortFieldOptions.forEach((option, index) => {
                if ([1, 3, 5, 7].includes(index)) sortOptions.push(menuSeparator);
                sortOptions.push({
                    name: option.name,
                    icon: "ui//arrow-up-down",
                    value: sort.field == option.sort.field && sort.asc == option.sort.asc,
                    type: SelectOptionType.Radio,
                    onClick: () => saveSort(option.sort),
                });
            });

            sortOptions.push(menuSeparator);
            sortOptions.push({
                name: isTagSpace ? i18n.menu.recursiveTagSort : i18n.menu.recursiveSort,
                icon: isTagSpace ? "lucide//git-branch" : "lucide//folder-tree",
                value: sort.recursive == true,
                type: SelectOptionType.Radio,
                onClick: () => saveSort({ recursive: !sort.recursive }),
            });

            sortOptions.push({
                name: i18n.menu.clearSort,
                icon: "lucide//filter-x",
                type: SelectOptionType.Radio,
                onClick: () => saveSort(null),
            });

            return superstate.ui.openMenu(offset, defaultMenu(superstate.ui, sortOptions), win, "right", onHide);
        },
    });

    if (!isTagSpace) {
        menuOptions.push({  // apply to all sub-items
            name: i18n.menu.applyItems,
            icon: "ui//apply-items",
            value: "apply-all",
            type: SelectOptionType.Submenu,
            onSubmenu: (offset, onHide) => showApplyItemsMenu(offset, superstate, space, win, onHide),
        });
    }

    menuOptions.push(menuSeparator);

    // pin / unpin
    const parentSpaceCache = superstate.spacesIndex.get(parentSpace);
    if (parentSpaceCache && depth > 0) {
        const pinned = isPathPinnedInSpace(parentSpaceCache, space.path);
        menuOptions.push({
            name: pinned ? i18n.menu.unpin : i18n.menu.pinToTop,
            icon: pinned ? "ui//pin-off" : "ui//pin",
            onClick: () => {
                setPathPinnedInSpace(superstate, parentSpaceCache.path, space.path, !pinned);
            },
        });
    }

    const linkedTagUri = isTagSpace && parentSpaceCache ? linkedTagSpaceUri(parentSpaceCache, space.path) : null;
    if (linkedTagUri) {
        const filtered = isFilteredTagSpaceLink(linkedTagUri);
        menuOptions.push({
            name: i18n.menu.useAsFilter,
            icon: "lucide//filter",
            value: filtered,
            type: SelectOptionType.Radio,
            onClick: () => setLinkedTagSpaceFiltered(superstate, parentSpaceCache.path, space.path, !filtered),
        });
    }

    if (isTagSpace) {
        // merge into
        menuOptions.push({
            name: i18n.buttons.mergeInto,
            icon: "lucide//merge",
            closeParentImmediately: true,
            onClick: (e) => {
                const offset = (e.target as HTMLButtonElement).getBoundingClientRect();
                showTagsMenu(offset, win, superstate, async (link, isNew) => {
                    const target = isNew ? await addTag(superstate, link) : superstate.spacesIndex.get(link);
                    if (!target) return;
                    if (target.path == space.path) {
                        superstate.ui.notify("The same tag-space: nothing changed");
                        return;
                    }
                    const sourceTag = `#${stringFromTag(space.name)}`;
                    const targetTag = `#${stringFromTag(target.name)}`;
                    superstate.ui.openModal(
                        i18n.labels.mergeTag,
                        <ConfirmationModal
                            confirmAction={() => mergeTagSpaceMetadata(superstate, space.path, target.path)}
                            confirmLabel={i18n.buttons.merge}
                            message={formatMessage(i18n.descriptions.mergeTag, [<i>{sourceTag}</i>, <i>{targetTag}</i>])}
                        />,
                        win,
                    );
                });
            },
        });
    }

    menuOptions.push(menuSeparator);

    if (space.type != "vault" && !isTagSpace) {
        menuOptions.push(menuSeparator);

        // duplicate
        menuOptions.push({
            name: i18n.menu.duplicate,
            icon: "ui//documents",
            onClick: () => {
                duplicatePathNextToOriginal(superstate, path.path, `${path.parent}`, undefined, parentSpace ?? path.parent);
            },
        });

        // rename
        menuOptions.push({
            name: i18n.menu.rename,
            icon: "ui//edit",
            closeParentImmediately: true,
            onClick: () => {
                superstate.ui.openModal(i18n.labels.rename, <InputModal saveLabel={i18n.buttons.rename} value={space.type == "tag" ? stringFromTag(space.name) : space.name} saveValue={(v) => renamePathByName(superstate, space.path, v)}></InputModal>, win);
            },
        });

        // move to
        menuOptions.push({
            name: i18n.menu.moveFile,
            icon: "ui//paper-plane",
            closeParentImmediately: true,
            onClick: (e) => {
                const offset = (e.target as HTMLButtonElement).getBoundingClientRect();
                showFoldersMenu(offset, win, superstate, (link) => {
                    superstate.spaceManager.renameSpace(space.path, movePath(space.path, link));
                }, e.shiftKey);
            },
        });
    }

    menuOptions.push({  // link to
        name: i18n.buttons.addToSpace,
        icon: "ui//link",
        closeParentImmediately: true,
        onClick: (e) => {
            const offset = (e.target as HTMLButtonElement).getBoundingClientRect();
            showFoldersMenu(
                offset,
                win,
                superstate,
                (link) => {
                    const spaceCache = superstate.spacesIndex.get(link);
                    if (spaceCache)
                        linkPathToSpaceAtIndex(superstate, spaceCache, space.path, -1);
                },
                e.shiftKey,
            );
        },
    });

    if (!isTagSpace) {
        menuOptions.push(menuSeparator);

        // reveal
        if (space.type != "vault" && parentSpace && parentSpace !== path.parent) {
            menuOptions.push({
                name: i18n.menu.revealInSpaces,
                icon: "ui//arrow-up-right",
                onClick: () => revealPathInSpaces(superstate, space.path),
            });
        }

        // reveal in OS
        menuOptions.push({
            name: superstate.ui.getOS() == "mac" ? i18n.menu.revealInDefault : i18n.menu.revealInExplorer,
            icon: "ui//arrow-up-right",
            onClick: () => {
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
    if (parentSpaceCache && (parentSpaceCache.type == "folder" || parentSpaceCache.type == "vault")) {
        if (parentSpace != path.parent) {
            const spaceCache = superstate.spacesIndex.get(parentSpace);
            if (spaceCache) {
                menuOptions.push({
                    name: i18n.menu.removeFromSpace,
                    icon: "ui//pin-off",
                    onClick: () => {
                        removePathsFromSpace(superstate, spaceCache.path, [space.path]);
                    },
                });
            }
        }
    }

    // Hide/Unhide (disabled in favor of per-focus exclusions).
    // if (space.type == "folder") {
    //     const directlyHidden = isPathDirectlyHidden(superstate, space.path);
    //     menuOptions.push({
    //         name: directlyHidden ? i18n.menu.unhide : i18n.menu.hide,
    //         icon: directlyHidden ? "ui//eye" : "ui//eye-off",
    //         onClick: () => directlyHidden ? unhidePath(superstate, space.path) : hidePath(superstate, space.path),
    //     });
    // }

    // exclude from focus
    if (depth > 0)
        menuOptions.push({
            name: i18n.menu.excludeFromFocus,
            icon: "ui//eye-off",
            onClick: () => excludePathsFromCurrentFocus(superstate, [space.path]),
        });

    // delete
    if (space.type == "folder" || isTagSpace)
        menuOptions.push({
            name: i18n.menu.delete,
            icon: "ui//trash",
            onClick: () => {
                const title = isTagSpace ? i18n.labels.deleteTag : i18n.labels.deleteFolder;
                const message = isTagSpace
                    ? formatMessage(i18n.descriptions.deleteTag, [<i>#{stringFromTag(space.name)}</i>])
                    : formatMessage(i18n.descriptions.deleteFolder, [<i>{space.name}</i>]);
                superstate.ui.openModal(title, <ConfirmationModal confirmAction={() => removeSpace(superstate, space.path)} confirmLabel={i18n.buttons.delete} message={message}></ConfirmationModal>, win);
            },
        });

    superstate.ui.openMenu(rect, defaultMenu(superstate.ui, menuOptions), win);

    return false;
};
