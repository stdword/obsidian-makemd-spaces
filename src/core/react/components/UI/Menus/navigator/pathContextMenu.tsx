import React from "react";
import { savePathColor } from "core/utils/superstate/label";
import { renamePathByName } from "core/utils/superstate/path";
import { TreeNode, duplicatePathNextToOriginal, movePathToNewSpaceAtIndex, removePathsFromSpace, removeSpace } from "core/utils/superstate/spaces";
import { dropPathsInSpaceAtIndex } from "core/utils/dnd/dropPath";
import { saveColorForPaths, saveIconsForPaths } from "core/utils/emoji";
import { deletePath, movePathToSpace } from "core/utils/superstate/path";
import { pathDisplayInfo } from "core/utils/pathDisplay";

import { Superstate } from "makemd-core";
import { default as i18n } from "shared/i18n";
import { Anchors, Rect } from "shared/types/Pos";
import { windowFromDocument } from "utils/dom";
import { isTagSpacePath } from "schemas/builtin";
import { formatMessage } from "../../Modals/ConfirmationModal";
import { defaultMenu } from "../menu/SelectionMenu";
import { showSpaceContextMenu } from "./spaceContextMenu";
import { PathStateWithRank } from "shared/types/superstate";
import { ContextMenuTarget, buildContextMenu, menuItems } from "./contextMenuItems";
import { FocusModeSource } from "core/utils/superstate/focusMode";

function isLinkedFileMenuItem(item: PathStateWithRank, space?: string) {
    return (
        !isTagSpacePath(space) && item?.type != "space" && space && item?.parent && space != item.parent
    )
}

const deleteManyMessage = <><div>{i18n.descriptions.deleteFiles}</div><div>{i18n.descriptions.deleteTags}</div></>;

// Focus Mode sections follow the order the tree shows, not the order the rows were clicked in.
const focusModeSources = (selectedPaths: TreeNode[], treeOrder?: string[]): FocusModeSource[] => {
    const position = new Map((treeOrder ?? []).map((id, index) => [id, index]));
    return selectedPaths
        .map((node, index) => ({ node, order: position.get(node.id) ?? treeOrder?.length ?? index, index }))
        .sort((a, b) => a.order - b.order || a.index - b.index)
        .map(({ node }) => ({ path: node.item.path, originId: node.id }));
};

export const triggerMultiPathMenu = (superstate: Superstate, selectedPaths: TreeNode[], e: React.MouseEvent | React.TouchEvent, treeOrder?: string[]) => {
    const paths = selectedPaths.map((s) => s.item.path);

    const allUnderTagSpace = selectedPaths.every((s) => isTagSpacePath(s.space));
    if (allUnderTagSpace) {
        triggerMultiPathMenuForTagSpace(superstate, selectedPaths, e, treeOrder);
        return;
    }

    const win = windowFromDocument(e.view.document);
    const hasLinkedFile = selectedPaths.some((s) => isLinkedFileMenuItem(s.item, s.space));
    const folderPaths = selectedPaths.filter((s) => s.item?.type == "space" && s.item.path != "/").map((s) => s.item.path);
    const displaySpace = selectedPaths[0]?.space;
    const displaySpaceCache = displaySpace && selectedPaths.every((item) => item.space == displaySpace && item.depth > 0)
        ? superstate.spacesIndex.get(displaySpace)
        : null;
    const parentPath = selectedPaths[0]?.item?.parent;
    const sameParent = parentPath != null && selectedPaths.every((item) => item.item?.parent == parentPath);

    const target: ContextMenuTarget = {
        superstate,
        win,
        paths,
        parent: displaySpaceCache,
        saveColor: hasLinkedFile ? undefined : (value) => saveColorForPaths(superstate, selectedPaths.map((s) => ({ path: s.item.path, space: s.space })), value),
        saveSticker: folderPaths.length > 0 ? (emoji) => saveIconsForPaths(superstate, folderPaths, emoji) : undefined,
        wrap: sameParent ? { parentPath, initialName: "", each: selectedPaths.map((s) => s.item) } : undefined,
        moveTo: (link) => {
            paths.forEach((f) => {
                movePathToSpace(superstate, f, link);
            });
        },
        linkTo: (link) => dropPathsInSpaceAtIndex(superstate, selectedPaths.map((f) => f.path), link, -1, "link"),
        excludeFromFocus: selectedPaths.every((item) => item.depth > 0),
        focusMode: focusModeSources(selectedPaths, treeOrder),
        remove: {
            title: i18n.labels.deleteFiles.replace("${1}", paths.length.toString()),
            message: deleteManyMessage,
            action: () => {
                paths.forEach((path) => {
                    deletePath(superstate, path);
                });
            },
        },
    };

    const menuOptions = buildContextMenu(target, [
        [menuItems.openInTab, menuItems.focusMode],
        [menuItems.changeColor, menuItems.changeSticker],
        [menuItems.pin, menuItems.wrapToFolder, menuItems.wrapEachToFolder],
        [menuItems.moveTo, menuItems.linkTo],
        // hide (disabled in favor of per-focus exclusions).
        [menuItems.excludeFromFocus, menuItems.delete],
    ]);

    superstate.ui.openMenu((e.target as HTMLElement).getBoundingClientRect(), defaultMenu(superstate.ui, menuOptions), win);

    return false;
};

export const triggerMultiPathMenuForTagSpace = (superstate: Superstate, selectedPaths: TreeNode[], e: React.MouseEvent | React.TouchEvent, treeOrder?: string[]) => {
    const paths = selectedPaths.map((s) => s.item.path);
    const win = windowFromDocument(e.view.document);

    const target: ContextMenuTarget = {
        superstate,
        win,
        paths,
        saveColor: (value) => saveColorForPaths(superstate, paths, value),
        linkTo: (link) => dropPathsInSpaceAtIndex(superstate, selectedPaths.map((f) => f.path), link, -1, "link"),
        excludeFromFocus: selectedPaths.every((item) => item.depth > 0),
        focusMode: focusModeSources(selectedPaths, treeOrder),
        remove: {
            title: i18n.labels.deleteFiles.replace("${1}", paths.length.toString()),
            message: deleteManyMessage,
            action: () => Promise.all(paths.map((path) => (isTagSpacePath(path) ? removeSpace(superstate, path) : deletePath(superstate, path)))),
        },
    };

    const menuOptions = buildContextMenu(target, [
        [menuItems.openInTab, menuItems.focusMode],
        [menuItems.changeColor],
        [menuItems.linkTo],
        // hide (disabled in favor of per-focus exclusions).
        [menuItems.excludeFromFocus, menuItems.delete],
    ]);

    superstate.ui.openMenu((e.target as HTMLElement).getBoundingClientRect(), defaultMenu(superstate.ui, menuOptions), win);

    return false;
};

export const showPathContextMenu = (superstate: Superstate, path: string, space: string, rect: Rect, win: Window, anchor?: Anchors, onClose?: () => void, depth = 0, nodeId?: string) => {
    const pathCache = superstate.pathStateForPath?.(path) ?? superstate.pathsIndex.get(path);

    if (!pathCache) return;
    if (pathCache.type == "space") {
        showSpaceContextMenu(superstate, pathCache, rect, win, space, onClose, depth, nodeId);
        return;
    }

    const parentIsTag = isTagSpacePath(space);
    const isSection = depth == 0;

    const parent = superstate.spacesIndex.get(space);
    const hasParent = !!parent;
    const isLink = hasParent && parent.path != pathCache.parent;

    const isExcalidraw = path.toLowerCase().endsWith(".excalidraw.md");
    const displayName = isExcalidraw ? pathCache.name.replace(/\.excalidraw$/i, "") : pathCache.name;

    const target: ContextMenuTarget = {
        superstate,
        win,
        paths: [path],
        parent,
        isSection,
        isLink,
        parentIsTag,
        onClose,
        saveColor: (value) => savePathColor(superstate, path, value, space),
        copyPath: true,
        wrap: !isSection ? { parentPath: pathCache.parent, initialName: pathDisplayInfo(path).title } : undefined,
        duplicate: () => duplicatePathNextToOriginal(superstate, path, `${pathCache.parent}`, `${pathCache.name}`, space ?? pathCache.parent),
        rename: { value: displayName, save: (value) => renamePathByName(superstate, path, isExcalidraw ? value.replace(/\.excalidraw(?:\.md)?$/i, "") : value) },
        moveTo: !parentIsTag ? (link) => movePathToNewSpaceAtIndex(superstate, pathCache, link) : undefined,
        linkTo: (link) => dropPathsInSpaceAtIndex(superstate, [path], link, -1, "link"),
        revealInSpaces: parentIsTag || isLink,
        systemPath: path,
        nativeMenuPath: path,
        unlink: isLink && !parentIsTag ? () => removePathsFromSpace(superstate, parent.path, [path]) : undefined,
        excludeFromFocus: !isSection && !isLink,
        focusMode: [{ path, originId: nodeId }],
        remove: !isLink
            ? {
                  title: i18n.labels.deleteFile,
                  message: formatMessage(i18n.descriptions.deleteFile, [<i>{path.split("/").pop()}</i>]),
                  action: () => deletePath(superstate, path),
              }
            : undefined,
    };

    const menuOptions = buildContextMenu(target, [
        [menuItems.focusMode],
        [menuItems.changeColor],
        [menuItems.copyPath, menuItems.pin, menuItems.wrapToFolder],
        [menuItems.duplicate, menuItems.rename, menuItems.moveTo, menuItems.linkTo],
        [menuItems.revealInSpaces, menuItems.revealInSystem, menuItems.nativeMenu],
        // Hide (disabled in favor of per-focus exclusions).
        [menuItems.closeSpace, menuItems.unlink, menuItems.excludeFromFocus, menuItems.delete],
    ]);

    superstate.ui.openMenu(rect, defaultMenu(superstate.ui, menuOptions), win, anchor);

    return false;
};
