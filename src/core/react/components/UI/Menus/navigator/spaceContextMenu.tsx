import React from "react";
import { savePathColor } from "core/utils/superstate/label";
import { renamePathByName } from "core/utils/superstate/path";
import { addSpaceSeparator, duplicatePathNextToOriginal, effectiveSpaceSort, linkPathToSpaceAtIndex, removePathsFromSpace, removeSpace, setLinkedTagSpaceFiltered, updateSpaceSort } from "core/utils/superstate/spaces";
import { addTag, mergeTagSpaceMetadata } from "core/utils/superstate/tags";
import { SelectOption, SelectOptionType, Superstate } from "makemd-core";
import { default as i18n } from "shared/i18n";
import { PathState, FilesystemSpaceInfo, SpaceState } from "shared/types/PathState";
import { Rect } from "shared/types/Pos";
import { isFilter } from "schemas/builtin";
import { SpaceSort } from "shared/types/spaceDef";
import { savePathSticker } from "utils/stickerActions";
import { movePath } from "utils/uri";
import { stringFromTag } from "utils/tags";
import { ConfirmationModal, formatMessage } from "../../Modals/ConfirmationModal";
import { defaultMenu, menuSeparator } from "../menu/SelectionMenu";
import { showTagsMenu } from "../modals/selectSpaceMenu";
import { showApplyItemsMenu } from "./showApplyItemsMenu";
import { newNoteMenuOption, showSpaceAddMenu } from "./showSpaceAddMenu";
import { ContextMenuTarget, buildContextMenu, menuItems } from "./contextMenuItems";

const sortMenuOption = (superstate: Superstate, space: SpaceState, win: Window, isTag: boolean): SelectOption => ({
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
        if (isTag) {
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
            name: isTag ? i18n.menu.recursiveTagSort : i18n.menu.recursiveSort,
            icon: isTag ? "lucide//git-branch" : "lucide//folder-tree",
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

const mergeIntoMenuOption = (superstate: Superstate, space: SpaceState, win: Window): SelectOption => ({
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

export const showSpaceContextMenu = (superstate: Superstate, path: PathState, rect: Rect, win: Window, parentSpace?: string, onClose?: () => void, depth = 0, nodeId?: string) => {
    const space = superstate.spacesIndex.get(path.path);
    if (!space)
        return;

    const isTag = space.type == "tag";
    const isHome = space.type == "vault";
    const isSection = depth == 0;

    const parent = superstate.spacesIndex.get(parentSpace);
    const hasParent = !!parent;
    const isLink = hasParent && parent.path != path.parent;
    const editable = !isHome && !isTag;

    const target: ContextMenuTarget = {
        superstate,
        win,
        paths: [space.path],
        parent,
        isSection,
        isLink,
        parentIsTag: parent?.type == "tag",
        onClose,
        saveColor: (value) => savePathColor(superstate, space.path, value),
        saveSticker: editable ? (emoji) => savePathSticker(superstate, space.path, emoji) : undefined,
        copyPath: !isTag,
        duplicate: editable ? () => duplicatePathNextToOriginal(superstate, path.path, `${path.parent}`, undefined, parentSpace ?? path.parent) : undefined,
        rename: editable ? { value: space.name, save: (value) => renamePathByName(superstate, space.path, value) } : undefined,
        moveTo: editable ? (link) => superstate.spaceManager.renameSpace(space.path, movePath(space.path, link)) : undefined,
        linkTo: (link) => {
            const spaceCache = superstate.spacesIndex.get(link);
            if (spaceCache) linkPathToSpaceAtIndex(superstate, spaceCache, space.path, -1);
        },
        revealInSpaces: !isTag && !isHome && isLink,
        systemPath: !isTag ? (space.space as FilesystemSpaceInfo).folderPath : undefined,
        nativeMenuPath: !isTag ? space.path : undefined,
        unlink: isLink && parent.type != "tag" ? () => removePathsFromSpace(superstate, parent.path, [space.path]) : undefined,
        excludeFromFocus: !isSection && !isLink,
        focusMode: [{ path: space.path, originId: nodeId }],
        remove:
            !isLink && !isHome
                ? {
                      title: isTag ? i18n.labels.deleteTag : i18n.labels.deleteFolder,
                      message: isTag
                          ? formatMessage(i18n.descriptions.deleteTag, [<i>#{stringFromTag(space.name)}</i>])
                          : formatMessage(i18n.descriptions.deleteFolder, [<i>{space.name}</i>]),
                      action: () => removeSpace(superstate, space.path),
                  }
                : undefined,
    };

    const newItems: SelectOption[] = isTag
        ? [{ name: i18n.buttons.createSeparator, icon: "lucide//separator-horizontal", onClick: () => addSpaceSeparator(superstate, space.path) }]
        : [
              newNoteMenuOption(superstate, space),
              {
                  name: i18n.menu.new,
                  icon: "ui//plus",
                  type: SelectOptionType.Submenu,
                  onSubmenu: (offset, onHide) => showSpaceAddMenu(superstate, offset, win, space, false, true, onHide),
              },
          ];

    const useAsFilter: SelectOption | null =
        isTag && isLink
            ? (() => {
                  const filtered = isFilter(space.path, parent);
                  return {
                      name: i18n.menu.useAsFilter,
                      icon: "lucide//filter",
                      value: filtered,
                      type: SelectOptionType.Radio,
                      onClick: () => setLinkedTagSpaceFiltered(superstate, parent.path, space.path, !filtered),
                  };
              })()
            : null;

    const menuOptions = buildContextMenu(target, [
        [...newItems, menuItems.focusMode],
        [menuItems.changeColor, menuItems.changeSticker],
        [
            sortMenuOption(superstate, space, win, isTag),
            !isTag && {
                name: i18n.menu.applyItems,
                icon: "ui//apply-items",
                value: "apply-all",
                type: SelectOptionType.Submenu,
                onSubmenu: (offset, onHide) => showApplyItemsMenu(offset, superstate, space, win, onHide),
            },
        ],
        [menuItems.copyPath, menuItems.pin, useAsFilter],
        [isTag && mergeIntoMenuOption(superstate, space, win)],
        [menuItems.duplicate, menuItems.rename, menuItems.moveTo, menuItems.linkTo],
        [menuItems.revealInSpaces, menuItems.revealInSystem, menuItems.nativeMenu],
        // Hide/Unhide (disabled in favor of per-focus exclusions).
        [menuItems.closeSpace, menuItems.unlink, menuItems.excludeFromFocus, menuItems.delete],
    ]);

    superstate.ui.openMenu(rect, defaultMenu(superstate.ui, menuOptions), win);

    return false;
};
