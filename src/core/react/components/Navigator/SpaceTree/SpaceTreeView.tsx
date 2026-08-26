import { isEqual } from "lodash";
import i18n from "shared/i18n";

import { PathStickerView } from "core/react/components/PathSticker";
import { NavigatorContext } from "core/react/context/SidebarContext";
import { TreeNode, addSpaceSeparator, childSpaceSort, effectiveSpaceSort, isPathPinnedInSpace, isSpaceSortable, linkedTagSpaceUri, moveSpaceSeparator, pathStateToTreeNode, pinnedItemsFirst, removeSpaceSeparator, spaceRowHeight, spaceToTreeNode } from "core/utils/superstate/spaces";
import { CustomVaultChangeEvent, eventTypes } from "schemas/event";
import { DragAction, DragActionModel, DragActionVisual, DragInsertPosition, DragProjection, getProjection, verticalInsertionDepth, verticalInsertionZone } from "core/utils/dnd/dragPath";
import { dropPathsInTree } from "core/utils/dnd/dropPath";
import { EXTERNAL_DRAG_NODE, dropExternalFilesAtProjection, isExternalFileDrag } from "core/utils/dnd/externalFileDrop";
import { filterFolderNoteChildren } from "integrations/folderNotesPluginIntegration";
import { Superstate } from "makemd-core";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { PathState, SpaceState } from "shared/types/PathState";
import { Pos } from "shared/types/Pos";
import { SpaceSort } from "shared/types/spaceDef";
import { PathStateWithRank } from "shared/types/superstate";
import { FocusEditor } from "./NavigatorFocusEditor";
import { DropModifiers, shouldShowLinkedItemIcon } from "./SpaceTreeItem";
import { VirtualizedList } from "./SpaceTreeVirtualized";
import { isFilter, isSpaceSeparatorPath, isTagTreeItemPath, SPACE_SEPARATOR_PATH } from "schemas/builtin";
import { isPathExcludedFromFocus } from "core/utils/superstate/focus";

interface SpaceTreeComponentProps {
    superstate: Superstate;
}

export const isLinkedTreeItem = (item: TreeNode | null) => Boolean(item && !isTagTreeItemPath(item.item) && shouldShowLinkedItemIcon(item));
export const isParentDropNoOp = (activeItem: TreeNode | null, overId: string) => Boolean(activeItem && activeItem.parentId == overId);

// A drop that would land the item back in its own parent is a no-op. Judged by
// the projection's target container (not the hovered row): positional inserts
// around the parent row target the grandparent and are real moves out of the
// folder, and sortable reorders within the parent are real rank changes.
export const isProjectionParentNoOp = (activeItem: TreeNode | null, projection: DragProjection | null): boolean => {
    if (!activeItem || !projection) return false;
    const dropContainerId = projection.insert ? projection.overId : projection.parentId;
    return isParentDropNoOp(activeItem, dropContainerId as string) && !(projection.sortable && !projection.insert);
};

export const dragModifierForActiveItem = (activeItem: TreeNode | null, event: Pick<React.DragEvent, "altKey" | "shiftKey">): DropModifiers => {
    if (activeItem?.type == "separator") return event.altKey ? "copy" : "move";
    if (isTagTreeItemPath(activeItem?.item)) return "link";
    if (isLinkedTreeItem(activeItem)) return "link";
    if (activeItem?.parentId == null) return "move";
    return event.altKey ? "copy" : event.shiftKey ? "link" : "move";
};

export const resolveDragModifier = (activeItem: TreeNode | null, projection: DragProjection | null, requestedModifier: DropModifiers): DropModifiers => {
    if (isTagTreeItemPath(activeItem?.item)) return projection?.reorder ? "move" : "link";
    if (isLinkedTreeItem(activeItem)) return projection?.reorder ? "move" : "link";
    if (projection?.droppable && projection.parentId == null && activeItem?.parentId != null) return "link";
    return requestedModifier;
};

const ENABLE_OBSIDIAN_DRAG_GHOST = true;
const ENABLE_DRAG_ACTION_LABEL = true;
// Drive internal tree drags with pointer events instead of native HTML5 DnD.
// Pointer events are frame-coalesced by the browser, so trackpad drags stay
// smooth (native drag sessions throttle renderer frames to ~10/s — see the
// note in dragOver). Native drop handling stays in place for external drags
// INTO the tree (Finder files, other Obsidian panes).
//
// Deliberately sacrificed (a native drag session cannot be started from the
// middle of a pointer gesture, only from a dragstart event): dragging rows OUT
// of the navigator —
//   - into an editor pane (link insert), the tab bar, a pane split target
//   - onto a canvas
//   - into another Obsidian window (popout)
//   - into Finder / other applications
// If any of these come back, the viable hybrid is choosing the native path at
// gesture start (e.g. Cmd-drag sets row.draggable before the browser decides),
// not a mid-gesture switch.
const ENABLE_POINTER_DND = true;

export const constrainSeparatorProjection = (activeItem: TreeNode | null, projection: DragProjection | null): DragProjection | null => {
    if (activeItem?.type != "separator") return projection;
    if (!projection || projection.insert || !projection.sortable || projection.parentId != activeItem.parentId) return null;
    return projection;
};

export const filterLinkedTagSpaceItems = (items: PathStateWithRank[], parentFolderPath: string) => {
    const prefix = parentFolderPath == "/" ? "" : `${parentFolderPath}/`;
    return items.filter((item) => isTagTreeItemPath(item) || (item.path != parentFolderPath && (prefix == "" || item.path.startsWith(prefix))));
};

export const constrainTagSpaceProjection = (activeItem: TreeNode | null, projection: DragProjection | null, flattenedTree: TreeNode[]): DragProjection | null => {
    if (!projection || !isTagTreeItemPath(activeItem?.item)) return projection;
    // A line projection in the current container is a reorder, even when that
    // container is the tag space's parent. Only reject dropping into the parent.
    if (projection.reorder) return projection;
    const targetContainerId = projection.insert ? projection.overId : projection.parentId;
    const targetContainer = flattenedTree.find((node) => node.id == targetContainerId);
    if (!isTagTreeItemPath(targetContainer?.item)) return projection;
    return null;
};

export const constrainLinkedItemProjection = (activeItem: TreeNode | null, projection: DragProjection | null, flattenedTree: TreeNode[]): DragProjection | null => {
    if (!projection || !isLinkedTreeItem(activeItem)) return projection;
    if (projection.reorder && projection.parentId == activeItem.parentId) return projection;
    const targetContainerId = projection.insert ? projection.overId : projection.parentId;
    // Root is the current focus: linking there adds the item as a section.
    if (targetContainerId == null && !projection.insert) return projection;
    if (!targetContainerId || targetContainerId == activeItem.parentId) return null;
    const targetContainer = flattenedTree.find((node) => node.id == targetContainerId);
    return targetContainer?.item?.type == "space" ? projection : null;
};

export const separatorDropRank = (projection: DragProjection, target: TreeNode | undefined, flattenedTree: TreeNode[], destinationLength: number, destinationOrder?: string[]) => {
    if (projection.insert) return destinationLength;
    const targetPath = target?.item?.path ?? target?.path;
    const storedTargetRank = target?.type != "separator" && targetPath ? destinationOrder?.indexOf(targetPath) : -1;
    const targetRank = projection.parentId == null
        ? flattenedTree.filter((node) => node.parentId == null && node.type != "new").findIndex((node) => node.id == target?.id)
        : typeof storedTargetRank == "number" && storedTargetRank >= 0 ? storedTargetRank : target?.rank;
    const baseRank = typeof targetRank == "number" && targetRank >= 0 ? targetRank : destinationLength;
    return Math.max(0, baseRank + (projection.linePosition == "bottom" ? 1 : 0));
};

const treeForSpace = (superstate: Superstate, space: SpaceState, path: PathStateWithRank, depth: number, parentId: string, hideSectionChildren: boolean, sortable: boolean, section: boolean, parentPath: string, sort: SpaceSort, expandedSpaces: string[], excludedPaths: string[], pinned?: boolean, inheritedFilterFolderPath?: string) => {
    const tree: TreeNode[] = [];
    const id = parentId ? parentId + "/" + space.path : space.path;
    // Only check expandedSpaces - don't force collapse based on activeId
    // This fixes the issue where folders with folder notes couldn't be expanded
    const spaceCollapsed = !expandedSpaces.includes(id);
    const parentSort = effectiveSpaceSort(sort, superstate.settings);
    const spaceSort = childSpaceSort(space.metadata?.sort, parentSort, superstate.settings);
    const childrenSortable = isSpaceSortable(space, superstate.settings);
    const folderNotePath = space.space?.notePath || null;
    const parentSpace = superstate.spacesIndex.get(parentPath);
    const linkedTagUri = space.type == "tag" && parentSpace ? linkedTagSpaceUri(parentSpace, space.path) : null;
    const ownFilterFolderPath = linkedTagUri && isFilter(linkedTagUri, parentSpace) ? parentPath : undefined;
    const filterFolderPath = ownFilterFolderPath ?? inheritedFilterFolderPath;
    const filtered = Boolean(filterFolderPath);
    const spaceItems = filtered
        ? filterLinkedTagSpaceItems(superstate.getSpaceItems(space.path) ?? [], filterFolderPath)
        : superstate.getSpaceItems(space.path) ?? [];
    const children = filterFolderNoteChildren(superstate, folderNotePath, spaceItems)
        .filter((item) => !isPathExcludedFromFocus(item.path, excludedPaths));
    const folderCount = children.filter((item) => item.type == "space").length;
    const fileCount = children.length - folderCount;

    if (section) {
        const pathIndex = superstate.pathStateForPath(space.path);
        if (pathIndex) {
            tree.push({
                id: space.path,
                parentId: null,
                depth: 0,
                index: 0,
                space: space.path,
                path: space.path,
                item: pathIndex,
                rank: null,
                collapsed: spaceCollapsed,
                sortable: childrenSortable,
                childrenCount: children.length,
                folderCount,
                fileCount,
                type: "group",
                sort: spaceSort,
                folderNotePath,
            });
        }
    } else {
        tree.push({
            ...spaceToTreeNode(path, spaceCollapsed, sortable, depth, parentId, parentPath, children.length, spaceSort, pinned),
            folderCount,
            fileCount,
            folderNotePath,
            filtered,
        });
    }

    const showChildren = !spaceCollapsed && (!section || !hideSectionChildren);
    if (showChildren) {
        const sortedChildren = pinnedItemsFirst(children, space, spaceSort);
        const childrenByPath = new Map(sortedChildren.map((item) => [item.path, item]));
        const rankOrder = space.metadata?.["rank-order"] ?? [];
        const pinnedChildren = sortedChildren.filter((item) => isPathPinnedInSpace(space, item.path));
        const rankedChildren: (PathStateWithRank | string)[] = spaceSort.field == "rank"
            ? [
                ...pinnedChildren,
                ...rankOrder.reduce<(PathStateWithRank | string)[]>((items, itemPath) => {
                    if (isSpaceSeparatorPath(itemPath)) items.push(itemPath);
                    else if (childrenByPath.has(itemPath) && !isPathPinnedInSpace(space, itemPath)) items.push(childrenByPath.get(itemPath));
                    return items;
                }, []),
                ...sortedChildren.filter((item) => !isPathPinnedInSpace(space, item.path) && !rankOrder.includes(item.path)),
            ]
            : sortedChildren;
        const separatorRanks = rankOrder.reduce<number[]>((ranks, itemPath, index) => {
            if (isSpaceSeparatorPath(itemPath)) ranks.push(index);
            return ranks;
        }, []);
        let separatorOccurrence = 0;

        rankedChildren.forEach((item, rankIndex) => {
            const _parentId = parentId ? parentId + "/" + space.path : space.path;
            if (typeof item == "string") {
                if (!isSpaceSeparatorPath(item)) return;
                const separatorRank = separatorRanks[separatorOccurrence++] ?? rankIndex;
                tree.push({
                    id: `${_parentId}/${SPACE_SEPARATOR_PATH}/${separatorRank}`,
                    parentId: _parentId,
                    depth: depth + 1,
                    index: separatorRank,
                    space: space.path,
                    path: item,
                    rank: separatorRank,
                    collapsed: true,
                    sortable: false,
                    childrenCount: 0,
                    type: "separator",
                    sort: spaceSort,
                });
                return;
            }
            const pinned = isPathPinnedInSpace(space, item.path);
            const rankedItem = { ...item, rank: rankIndex };
            if (item.type != "space") {
                const itemCollapsed = section ? !expandedSpaces.includes(_parentId + "/" + item.path) : true;
                tree.push(pathStateToTreeNode(superstate, rankedItem, space.path, item.path, depth + 1, 0, itemCollapsed, childrenSortable, 0, _parentId, pinned));
            } else {
                if (superstate.spacesIndex.has(item.path)) {
                    tree.push(...treeForSpace(superstate, superstate.spacesIndex.get(item.path), rankedItem, depth + 1, _parentId, hideSectionChildren, childrenSortable, false, space.path, spaceSort, expandedSpaces, excludedPaths, pinned, filterFolderPath));
                }
            }
        });
    }
    return tree;
};

const treeForSection = (superstate: Superstate, space: SpaceState, path: PathStateWithRank, hideSectionChildren: boolean, expandedSpaces: string[], excludedPaths: string[]) => {
    const spaceSort = effectiveSpaceSort(space.metadata?.sort, superstate.settings);
    return treeForSpace(superstate, space, path, 0, null, hideSectionChildren, false, true, space.path, spaceSort, expandedSpaces, excludedPaths);
};

export const retrieveData = (superstate: Superstate, activeViewSpaces: PathState[], hideSectionChildren: boolean, expandedSpaces: string[], excludedPaths: string[]) => {
    const tree: TreeNode[] = [];
    activeViewSpaces
        .filter((f) => f)
        .forEach((item, index) => {
            if (isSpaceSeparatorPath(item.path)) {
                tree.push({
                    id: `focus/${SPACE_SEPARATOR_PATH}/${index}`,
                    parentId: null,
                    depth: 0,
                    index,
                    space: null,
                    path: item.path,
                    rank: index,
                    collapsed: true,
                    sortable: true,
                    childrenCount: 0,
                    type: "separator",
                });
            } else if (superstate.spacesIndex.has(item.path)) {
                tree.push(...treeForSection(superstate, superstate.spacesIndex.get(item.path), item, hideSectionChildren, expandedSpaces, excludedPaths));
            } else {
                tree.push({
                    ...pathStateToTreeNode(superstate, item, null, item.path, 0, 0, false, false, 0, null),
                    type: "group",
                });
            }
        });

    tree.push({
        id: "placeholder",
        parentId: null,
        depth: 0,
        index: 0,
        space: null,
        type: "new",
        path: null,
        childrenCount: 0,
        collapsed: false,
        rank: 0,
    });
    return tree;
};

export const revealTreePath = (path: string, sectionPaths: string[]) => {
    const sectionPath = sectionPaths
        .filter((candidate) => candidate == "/" || path === candidate || path.startsWith(`${candidate}/`))
        .sort((a, b) => b.length - a.length)[0];
    if (!path || !sectionPath) return;

    const folders = path.split("/");
    const pathLevel = sectionPath.split("/").filter((part) => part.length > 0).length;
    const openPaths = folders.reduce(
        (paths, _part, index) => [
            ...paths,
            ...(index < pathLevel
                ? []
                : [index == 0 ? `//${folders[0]}` : `${paths[paths.length - 1]}/${folders.slice(0, index + 1).join("/")}`]),
        ],
        [sectionPath],
    );

    return { openPaths, targetId: openPaths[openPaths.length - 1] };
};

export const SpaceTreeComponent = (props: SpaceTreeComponentProps) => {
    const { superstate } = props;
    const indentationWidth = 16;

    const [expandedSpaces, setExpandedSpaces] = useState<string[]>(superstate.settings.expandedSpaces);

    const {
        activePath: activePath,
        activeViewSpaces,
        setActivePath: setActivePath,
        selectedPaths: selectedPaths,
        setSelectedPaths: setSelectedPaths,
        activeFocus: activeFocus,
        focuses: focuses,
        setFocuses: setFocuses,
        dragPaths,
        setDragPaths,
        editFocus: editFocus,
        setEditFocus: setEditFocus,
    } = useContext(NavigatorContext);

    const [active, setActive] = useState<TreeNode>(null);
    const [overId, setOverId] = useState<string>(null);
    const [modifier, setModifier] = useState<DropModifiers>(null);
    const [treeVersion, setTreeVersion] = useState(0);
    const treeRef = useRef<HTMLDivElement>(null);
    const nextTreeScrollPath = useRef(null);
    const nextRevealResult = useRef<((found: boolean) => void) | null>(null);
    const [presetRowHeight, setPresetRowHeight] = useState<number>(props.superstate.settings.spaceRowHeight);

    const overIdRef = useRef<string>(null);
    const offsetRef = useRef({ x: 0, y: 0 });
    const modifierRef = useRef<DropModifiers>(null);
    const activeRef = useRef<TreeNode>(null);
    const compensatedDragSource = useRef<HTMLElement | null>(null);
    const dragPathsRef = useRef<string[]>([]);
    const dragActionRef = useRef<DragActionModel | null>(null);
    const hideSectionChildren = active != null && active.parentId == null;
    const excludedPaths = focuses[activeFocus]?.["excluded-paths"] ?? [];
    const computedFlattenedTree = useMemo(
        () => retrieveData(superstate, activeViewSpaces, hideSectionChildren, expandedSpaces, excludedPaths),
        [superstate, activeViewSpaces, hideSectionChildren, expandedSpaces, excludedPaths, treeVersion],
    );
    const stableFlattenedTree = useRef<TreeNode[]>(computedFlattenedTree);
    if (!superstate.spaceManager.isRenaming) stableFlattenedTree.current = computedFlattenedTree;
    const flattenedTree = superstate.spaceManager.isRenaming ? stableFlattenedTree.current : computedFlattenedTree;
    const listRef = useRef<{
        scrollToIndex: (index: number, options: { align: "start" | "center" | "end" | "auto" }) => void;
    }>(null);
    const reloadData = useCallback(() => {
        setTreeVersion((version) => version + 1);
    }, []);

    const refreshableSpaces = useMemo(() => [...activeViewSpaces.filter((f) => f).map((f) => f.path), ...flattenedTree.filter((f) => f.type == "space").map((f) => f.path)].filter((f) => f), [activeViewSpaces, flattenedTree]);

    useEffect(() => {
        if (selectedPaths.length <= 1) {
            if (!selectedPaths[0] || selectedPaths[0].item.path != activePath) setSelectedPaths([]);
            if (superstate.settings.revealActiveFile && activePath) revealPath(activePath);
        }

        props.superstate.ui.eventsDispatch.addListener("activePathChanged", changeActivePath);
        return () => {
            props.superstate.ui.eventsDispatch.removeListener("activePathChanged", changeActivePath);
        };
    }, [activePath]);

    useEffect(() => {
        const handleDragEnd = (event: DragEvent) => {
            const hasActiveDrag = activeRef.current != null || dragPathsRef.current.length > 0 || overIdRef.current != null || dragActionRef.current != null;
            // A handled drop clears these refs synchronously. Avoid a second
            // full tree reset when its trailing native dragend arrives.
            if (!isDropping.current && hasActiveDrag) {
                finishNativeDrag(event as any);
                resetState();
            }
        };
        window.addEventListener("dragend", handleDragEnd);
        return () => {
            window.removeEventListener("dragend", handleDragEnd);
        };
    });
    // Persistant Settings

    useEffect(() => {
        const settingsChanged = () => {
            setExpandedSpaces(superstate.settings.expandedSpaces);
            setPresetRowHeight(props.superstate.settings.spaceRowHeight);
        };
        superstate.eventsDispatcher.addListener("settingsChanged", settingsChanged);

        return () => {
            superstate.eventsDispatcher.removeListener("settingsChanged", settingsChanged);
        };
    }, []);

    const revealPath = useCallback(
        (path: string) => {
            const route = revealTreePath(path, activeViewSpaces.map((space) => space.path));
            if (!route) return false;

            const newOpenFolders = [
                ...expandedSpaces.filter((expandedPath) => !route.openPaths.includes(expandedPath)),
                ...route.openPaths.slice(0, -1),
            ];

            superstate.settings.expandedSpaces = newOpenFolders;
            setExpandedSpaces(newOpenFolders);
            nextTreeScrollPath.current = route.targetId;
            superstate.saveSettings(false);
            return true;
        },
        [expandedSpaces, activeViewSpaces],
    );

    useEffect(() => {
        const handleRevealPathEvent = (evt: CustomVaultChangeEvent) => {
            if (!evt.detail.path) return;
            nextRevealResult.current = evt.detail.onResult ?? null;
            const revealStarted = revealPath(evt.detail.path);
            if (!revealStarted) {
                nextRevealResult.current?.(false);
                nextRevealResult.current = null;
            }
        };
        window.addEventListener(eventTypes.revealPath, handleRevealPathEvent);
        return () => {
            window.removeEventListener(eventTypes.revealPath, handleRevealPathEvent);
        };
    }, [revealPath]);

    useEffect(() => {
        if (nextTreeScrollPath.current) {
            const index = flattenedTree.findIndex((node) => node.id == nextTreeScrollPath.current);
            if (index != -1) {
                listRef.current.scrollToIndex(index, { align: "center" });
                const node = flattenedTree[index];
                setActivePath(node.item.path);
                setSelectedPaths([node]);
                nextTreeScrollPath.current = null;
                nextRevealResult.current?.(true);
                nextRevealResult.current = null;
            } else {
                nextTreeScrollPath.current = null;
                nextRevealResult.current?.(false);
                nextRevealResult.current = null;
            }
        }
    }, [flattenedTree, setActivePath, setSelectedPaths]);
    useEffect(() => {
        const spaceUpdated = (payload: { path: string }) => {
            if (props.superstate.spaceManager.isRenaming) return;
            if (refreshableSpaces.some((f) => f == payload.path)) {
                if (isDropping.current) {
                    pendingDropReload.current = true;
                    return;
                }
                if (pendingReset.current) {
                    // Batch data reload with state reset to prevent intermediate render
                    pendingReset.current = false;
                    flushSync(() => {
                        reloadData();
                        resetState();
                    });
                    treeRef.current?.classList.remove("mk-dropping");
                } else {
                    reloadData();
                }
            }
        };

        props.superstate.eventsDispatcher.addListener("spaceStateUpdated", spaceUpdated);

        return () => {
            props.superstate.eventsDispatcher.removeListener("spaceStateUpdated", spaceUpdated);
        };
    }, [refreshableSpaces, reloadData]);
    useEffect(() => {
        const superstateUpdated = () => {
            if (!props.superstate.spaceManager.isRenaming) reloadData();
        };
        props.superstate.eventsDispatcher.addListener("superstateUpdated", superstateUpdated);

        return () => {
            props.superstate.eventsDispatcher.removeListener("superstateUpdated", superstateUpdated);
        };
    }, [reloadData]);

    const changeActivePath = (path: string) => {
        setActivePath(path);
    };

    const overIndex = useMemo(() => flattenedTree.findIndex((f) => f.id == overId), [overId, flattenedTree]);
    const activeIndex = useMemo(() => (active?.id ? flattenedTree.findIndex((f) => f.id == active.id) : -1), [active, flattenedTree]);

    const sortedIds = useMemo(() => flattenedTree.map(({ id }) => id), [flattenedTree]);

    const selectRange = useCallback(
        (fromId: string) => {
            const startIndex = sortedIds.findIndex((f) => f == fromId);
            const selectedPathsStartIndex = sortedIds.findIndex((f) => f == selectedPaths[0]?.id);
            const selectedPathsEndIndex = sortedIds.findIndex((f) => f == selectedPaths[selectedPaths.length - 1]?.id);

            if (startIndex < selectedPathsStartIndex) {
                setSelectedPaths(flattenedTree.slice(startIndex, selectedPathsEndIndex + 1).filter((f) => f.item));
            } else {
                setSelectedPaths(flattenedTree.slice(selectedPathsStartIndex, startIndex + 1).filter((f) => f.item));
            }
        },
        [sortedIds, selectedPaths, setSelectedPaths, flattenedTree],
    );

    const [dragAction, setDragAction] = useState<DragActionModel | null>(null);

    const dragStarted = (activeId: string, source: HTMLElement) => {
        nativeDragFinished.current = false;
        const activeItem = flattenedTree.find(({ id }) => id === activeId);
        //Dont drag vault
        activeRef.current = activeItem;
        if (activeItem?.parentId == null) {
            // Keep the source at its pre-collapse screen position until Chromium
            // establishes the native drag. The rest of the tree can still switch
            // immediately to the sections-only layout.
            const sourceNode = source.closest<HTMLElement>(".mk-tree-node");
            const sourceTop = sourceNode?.getBoundingClientRect().top;
            flushSync(() => setActive(activeItem));
            if (sourceNode && sourceTop != null) {
                const offset = sourceTop - sourceNode.getBoundingClientRect().top;
                if (offset != 0) {
                    sourceNode.style.transform = `translateY(calc(var(--node-offset) + ${offset}px))`;
                    compensatedDragSource.current = sourceNode;
                }
            }
        } else {
            setActive(activeItem);
        }
        overIdRef.current = activeId;
        setOverId(activeId);

        if (activeItem) {
            if (selectedPaths.length > 1) {
                const paths = selectedPaths.map((f) => f.path);
                dragPathsRef.current = paths;
                setDragPaths(paths);
            } else {
                const paths = [activeItem.path];
                dragPathsRef.current = paths;
                setDragPaths(paths);
            }
        }

        document.body.style.setProperty("cursor", "grabbing");
    };

    const focusName = focuses?.[activeFocus]?.name || "Spaces";
    const containerName = (containerId: string | null) => (containerId ? flattenedTree.find((f) => f.id == containerId)?.item?.name : null) ?? focusName;
    const dragActionLabel = (action: DragAction) => {
        if (action.type == "reorder") return `${i18n.labels.reorderIn} ${containerName(action.containerId)}`;
        if (action.type == "link" && action.containerId == null) return `${i18n.labels.addTo} ${containerName(null)}`;
        const actionLabel = action.type == "link" ? i18n.labels.linkTo : action.type == "copy" ? i18n.labels.copyTo : i18n.labels.moveTo;
        return `${actionLabel} ${containerName(action.containerId)}`;
    };
    const dragActionForProjection = (projection: DragProjection, currentModifier: DropModifiers): DragActionModel | null => {
        if (!projection?.droppable) return null;
        const overItem = flattenedTree.find((f) => f.id == projection.overId);
        const targetContainerId = projection.insert ? projection.overId : projection.parentId;
        const currentActive = activeRef.current ?? active;
        if (!projection.insert && !projection.sortable && overItem?.id != targetContainerId && currentActive?.parentId == targetContainerId) return null;
        const position: DragInsertPosition | undefined = projection.sortable
            ? {
                  kind: projection.linePosition == "bottom" ? "after" : "before",
                  itemId: projection.overId,
              }
            : undefined;
        const actionType = projection.reorder && position && currentModifier == "move" ? "reorder" : currentModifier == "link" ? "link" : currentModifier == "copy" ? "copy" : "move";
        const action: DragAction =
            actionType == "reorder"
                ? { type: "reorder", containerId: targetContainerId, position, projection }
                : {
                      type: actionType,
                      containerId: targetContainerId,
                      ...(position ? { position } : {}),
                      projection,
                  };
        const visual: DragActionVisual | null = position
            ? { kind: "line", itemId: position.itemId, position: position.kind, depth: projection.depth }
            : targetContainerId
              ? overItem?.id == targetContainerId && (overItem.collapsed || overItem.childrenCount == 0)
                  ? { kind: "box", containerId: targetContainerId }
                  : { kind: "folder", containerId: targetContainerId }
              : null;
        if (!visual) return null;
        return {
            action,
            visual,
            label: currentActive?.type != "separator" && ((ENABLE_OBSIDIAN_DRAG_GHOST && ENABLE_DRAG_ACTION_LABEL) || ENABLE_POINTER_DND) ? dragActionLabel(action) : null,
        };
    };

    const dragOver = (e: React.DragEvent<HTMLElement>, _overId: string, position: Pos) => {
        // NOTE (perf): trackpads emit 300-500 dragover events/s (native DnD
        // events are not frame-coalesced). Profiling showed the handler below
        // is not the bottleneck for drag jank: during a native drag session
        // Electron throttles renderer frames to ~10/s for trackpad drags
        // regardless of main-thread load, so caching/coalescing here does not
        // improve smoothness. Fixing the jank requires moving off native HTML5
        // DnD (e.g. pointer-event based dnd-kit).
        const isExternalDrag = isExternalFileDrag(e);
        if (compensatedDragSource.current) {
            compensatedDragSource.current.style.removeProperty("transform");
            compensatedDragSource.current = null;
        }
        const currentActive = isExternalDrag ? EXTERNAL_DRAG_NODE : (activeRef.current ?? active);
        const requestedModifier = isExternalDrag ? "copy" : dragModifierForActiveItem(currentActive, e);
        const x = offsetRef.current.x;
        const y = offsetRef.current.y;
        const nextOverId = _overId ?? overIdRef.current;
        const currentDragPaths = isExternalDrag ? [EXTERNAL_DRAG_NODE.path] : dragPathsRef.current.length > 0 ? dragPathsRef.current : dragPaths;
        const nextOverIndex = flattenedTree.findIndex((f) => f.id == nextOverId);
        const overItem = nextOverIndex == -1 ? null : flattenedTree[nextOverIndex];
        const rowHeight = overItem?.type == "separator" ? 10 : spaceRowHeight(superstate, presetRowHeight, false);
        const previousRow = nextOverIndex <= 0 ? null : flattenedTree[nextOverIndex - 1];
        const followingRow = nextOverIndex == -1 ? null : flattenedTree.slice(nextOverIndex + 1).find((node) => node.type != "new");
        const newY = verticalInsertionZone(position.y, rowHeight, overItem, previousRow, followingRow);

        const rowDepth = overItem?.depth ?? 0;
        const nextDepth = verticalInsertionDepth(position.y, rowHeight, rowDepth, followingRow?.depth ?? 0);
        const newX = rowDepth * indentationWidth;
        const nextActiveIndex = currentActive?.id ? flattenedTree.findIndex((f) => f.id == currentActive.id) : -1;
        const nextProjection = constrainLinkedItemProjection(
            currentActive,
            constrainTagSpaceProjection(
                currentActive,
                constrainSeparatorProjection(
                    currentActive,
                    currentActive && nextOverId && nextOverIndex != -1 ? getProjection(currentActive, flattenedTree, currentDragPaths, nextOverIndex, nextDepth, newY, nextActiveIndex < nextOverIndex, requestedModifier, currentActive.space) : null,
                ),
                flattenedTree,
            ),
            flattenedTree,
        );
        const modifier = isExternalDrag ? "copy" : resolveDragModifier(currentActive, nextProjection, requestedModifier);
        if (modifierRef.current != modifier) {
            modifierRef.current = modifier;
            setModifier(modifier);
        }
        const isSelfDrop = currentActive?.id == overItem?.id;
        const isParentNoOpDrop = currentActive?.parentId == overItem?.id;
        const acceptRejectedSeparatorDrop = currentActive?.type == "separator";
        const acceptRejectedTagSpaceDrop = isTagTreeItemPath(currentActive?.item);
        // Accept self/parent no-ops at the native DnD layer. Using `none` makes
        // Chromium animate the ghost back to its origin for ~400 ms.
        e.dataTransfer.dropEffect = nextProjection || isSelfDrop || isParentNoOpDrop || acceptRejectedSeparatorDrop || acceptRejectedTagSpaceDrop ? modifier : "none";
        const nextDragAction = dragActionForProjection(nextProjection, modifier);
        if (!isEqual(dragActionRef.current, nextDragAction)) {
            dragActionRef.current = nextDragAction;
            setDragAction(nextDragAction);
        }
        // Obsidian's dragManager clears the action on every dragover, so the
        // label must be re-applied each event — do not dedupe this call. In
        // pointer mode there is no dragManager ghost; the label renders on the
        // pointer ghost instead.
        if (nextDragAction?.label && !ENABLE_POINTER_DND && !isExternalDrag) {
            superstate.ui.setDragLabel(nextDragAction.label);
        }
        if (currentDragPaths.length > 1) {
            if (_overId && _overId != overIdRef.current) {
                overIdRef.current = _overId;
                setOverId(_overId);
            }
            if (x != newX || y != newY) {
                offsetRef.current = { x: newX, y: newY };
            }
            return;
        }
        if (_overId && _overId != overIdRef.current) {
            overIdRef.current = _overId;
            setOverId(_overId);
        }
        if (x != newX || y != newY) {
            offsetRef.current = { x: newX, y: newY };
        }
    };
    useEffect(() => {
        // `resetState` clears the ref synchronously before its `setDragPaths([])`
        // causes this effect, so normal drag completion is not reset twice.
        if (dragPaths.length == 0 && dragPathsRef.current.length > 0) resetState();
    }, [dragPaths]);

    const finishNativeDrag = (e: React.DragEvent<HTMLDivElement>) => {
        if (nativeDragFinished.current) return;
        nativeDragFinished.current = true;
        superstate.ui.dragEnded(e);
    };

    const finishNoOpDrop = (e: React.DragEvent<HTMLDivElement>) => {
        // The tree state and Obsidian's native drag ghost are separate. A no-op
        // must synchronously finish both instead of waiting for a later dragend.
        finishNativeDrag(e);
        resetState();
    };

    const dragEnded = async (e: React.DragEvent<HTMLDivElement>, overId: string) => {
        // The source row also receives dragend after a successful target drop.
        // In that case the target handler already owns completion.
        if (isDropping.current) return;
        const currentActive = activeRef.current ?? active;
        if (currentActive && overId == currentActive.id) {
            finishNoOpDrop(e);
            return;
        }
        const actionModifier = dragActionRef.current?.action.type == "link" ? "link" : dragActionRef.current?.action.type == "copy" ? "copy" : "move";
        const fallbackOverIndex = flattenedTree.findIndex((node) => node.id == overId);
        const fallbackOverItem = fallbackOverIndex == -1 ? null : flattenedTree[fallbackOverIndex];
        const projection = constrainLinkedItemProjection(
            currentActive,
            constrainTagSpaceProjection(
                currentActive,
                constrainSeparatorProjection(currentActive, dragActionRef.current?.action.projection ?? (
                    currentActive && fallbackOverItem
                        ? getProjection(
                            currentActive,
                            flattenedTree,
                            dragPathsRef.current.length > 0 ? dragPathsRef.current : dragPaths,
                            fallbackOverIndex,
                            fallbackOverItem.depth,
                            offsetRef.current.y,
                            activeIndex < fallbackOverIndex,
                            modifierRef.current ?? "move",
                            currentActive.space,
                        )
                        : null
                )),
                flattenedTree,
            ),
            flattenedTree,
        );
        if (!currentActive || !projection) {
            finishNoOpDrop(e);
            return;
        }
        if (isProjectionParentNoOp(currentActive, projection)) {
            finishNoOpDrop(e);
            return;
        }
        // Finish Obsidian's native drag synchronously. Persistence below can
        // await filesystem writes, while the native ghost must disappear at drop.
        finishNativeDrag(e);
        isDropping.current = true;
        pendingReset.current = true;
        treeRef.current?.classList.add("mk-dropping");
        if (currentActive.type == "separator") {
            const separatorPath = currentActive.path;
            const target = flattenedTree.find((node) => node.id == (projection.overId ?? overId));
            const targetContainer = flattenedTree.find((node) => node.id == (projection.insert ? projection.overId : projection.parentId));
            const newSpacePath = projection.insert ? target?.item?.path : targetContainer?.item?.path;
            const destinationSpace = newSpacePath ? superstate.spacesIndex.get(newSpacePath) : null;
            const destinationLength = destinationSpace?.metadata?.["rank-order"]?.length ?? 0;
            const newRank = separatorDropRank(projection, target, flattenedTree, destinationLength, destinationSpace?.metadata?.["rank-order"]);
            if (currentActive.space && newSpacePath) {
                await moveSpaceSeparator(superstate, currentActive.space, currentActive.rank, newSpacePath, newRank, actionModifier == "copy");
            } else if (!currentActive.space && newSpacePath) {
                await addSpaceSeparator(superstate, newSpacePath, newRank);
                if (actionModifier != "copy") {
                    setFocuses(focuses.map((focus, index) => index == activeFocus ? { ...focus, paths: focus.paths.filter((_path, pathIndex) => pathIndex != currentActive.rank) } : focus));
                }
            } else if (currentActive.space && projection.parentId == null) {
                setFocuses(focuses.map((focus, index) => {
                    if (index != activeFocus) return focus;
                    const paths = [...focus.paths];
                    paths.splice(Math.max(0, Math.min(newRank, paths.length)), 0, separatorPath);
                    return { ...focus, paths };
                }));
                if (actionModifier != "copy") await removeSpaceSeparator(superstate, currentActive.space, currentActive.rank);
            } else if (projection.parentId == null) {
                setFocuses(focuses.map((focus, index) => {
                    if (index != activeFocus) return focus;
                    const paths = [...focus.paths];
                    if (actionModifier != "copy") paths.splice(currentActive.rank, 1);
                    const adjustedRank = actionModifier != "copy" && currentActive.rank < newRank ? newRank - 1 : newRank;
                    paths.splice(Math.max(0, Math.min(adjustedRank, paths.length)), 0, separatorPath);
                    return { ...focus, paths };
                }));
            }
        } else {
            await dropPathsInTree(superstate, dragPathsRef.current.length > 0 ? dragPathsRef.current : dragPaths, currentActive?.id, projection.overId ?? overId, projection, flattenedTree, activeViewSpaces, actionModifier);
        }
        if (pendingDropReload.current) {
            pendingDropReload.current = false;
            pendingReset.current = false;
            flushSync(() => {
                reloadData();
                resetState();
            });
            treeRef.current?.classList.remove("mk-dropping");
        }
        isDropping.current = false;
        if (pendingReset.current) {
            pendingReset.current = false;
            flushSync(() => {
                resetState();
            });
            treeRef.current?.classList.remove("mk-dropping");
        }
    };

    const handleCollapse = useCallback(
        (folder: TreeNode, open: boolean) => {
            const folderOpen = expandedSpaces?.includes(folder.id);
            const newOpenFolders: string[] = !folderOpen || open ? ([...expandedSpaces, folder.id] as string[]) : (expandedSpaces.filter((openFolder) => folder.id !== openFolder) as string[]);
            setExpandedSpaces(newOpenFolders);
            superstate.settings.expandedSpaces = newOpenFolders;
            superstate.saveSettings(false);
        },
        [superstate, expandedSpaces],
    );

    function resetState() {
        if (compensatedDragSource.current) {
            compensatedDragSource.current.style.removeProperty("transform");
            compensatedDragSource.current = null;
        }
        setDragPaths([]);
        setOverId(null);
        setActive(null);
        setModifier(null);
        setDragAction(null);
        activeRef.current = null;
        dragPathsRef.current = [];
        dragActionRef.current = null;
        overIdRef.current = null;
        offsetRef.current = { x: 0, y: 0 };
        modifierRef.current = null;
        document.body.style.setProperty("cursor", "");
    }

    const isDropping = useRef(false);
    const nativeDragFinished = useRef(false);
    const pendingReset = useRef(false);
    const pendingDropReload = useRef(false);

    const dragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return;
        setOverId(null);
        setDragAction(null);
        dragActionRef.current = null;
        overIdRef.current = null;
        offsetRef.current = { x: 0, y: 0 };
    };
    const rowHeights = useMemo(
        () => flattenedTree.map((f) => f.type == "separator" ? 10 : spaceRowHeight(superstate, presetRowHeight, f.type == "group" && !isTagTreeItemPath(f.item))),
        [flattenedTree, presetRowHeight, superstate],
    );

    const pointerGhostRef = useRef<HTMLDivElement>(null);
    const pointerDragRef = useRef<{
        pointerId: number;
        sourceEl: HTMLElement;
        id: string;
        startX: number;
        startY: number;
        x: number;
        y: number;
        active: boolean;
        cleanup: () => void;
    } | null>(null);

    // dragOver/dragEnded only read modifier keys and write dropEffect; pointer
    // events carry the former and a stub absorbs the latter.
    const pointerDragEventShim = (e: PointerEvent) => ({ altKey: e.altKey, shiftKey: e.shiftKey, dataTransfer: { dropEffect: "move" } }) as unknown as React.DragEvent<HTMLDivElement>;

    // Focus tab currently targeted by a pointer drag (pin-to-focus drop).
    const pointerFocusRef = useRef<number | null>(null);
    const [pointerFocusTarget, setPointerFocusTarget] = useState<number | null>(null);

    const clearTreeDropTarget = () => {
        setOverId(null);
        setDragAction(null);
        dragActionRef.current = null;
        overIdRef.current = null;
        offsetRef.current = { x: 0, y: 0 };
    };

    const onTreePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!ENABLE_POINTER_DND) return;
        if (e.button != 0 || pointerDragRef.current) return;
        const row = (e.target as HTMLElement).closest<HTMLElement>("[data-tree-id]");
        if (!row) return;
        const id = row.dataset.treeId;
        const node = flattenedTree.find((f) => f.id == id);
        if (!node || node.type == "new") return;
        const doc = row.ownerDocument;
        const win = doc.defaultView;
        // The virtualized scroller (overflow-y: auto ancestor) for edge
        // auto-scroll during the drag.
        let scroller: HTMLElement | null = row.parentElement;
        while (scroller && scroller != doc.body) {
            if (/(auto|scroll)/.test(win?.getComputedStyle(scroller).overflowY ?? "")) break;
            scroller = scroller.parentElement;
        }
        if (scroller == doc.body) scroller = null;
        const state = { pointerId: e.pointerId, sourceEl: row, id, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, altKey: false, shiftKey: false, active: false, focusEl: null as HTMLElement | null, cleanup: () => {} };
        const setFocusTarget = (focusEl: HTMLElement | null) => {
            if (focusEl == state.focusEl) return;
            state.focusEl?.classList.remove("mk-focus-drop");
            state.focusEl = focusEl;
            focusEl?.classList.add("mk-focus-drop");
            const index = focusEl ? Number(focusEl.dataset.focusIndex) : null;
            pointerFocusRef.current = index;
            setPointerFocusTarget(index);
            if (focusEl) clearTreeDropTarget();
        };
        const hitTest = () => {
            const under = doc.elementFromPoint(state.x, state.y);
            // Focus tabs are pin-to-focus drop targets: no tree projection,
            // only the tab highlight and an "Add to" ghost label.
            setFocusTarget(node.type == "separator" ? null : (under?.closest<HTMLElement>("[data-focus-index]") ?? null));
            if (state.focusEl) return;
            const overRow = under?.closest<HTMLElement>("[data-tree-id]");
            if (overRow?.dataset.treeId) {
                const rect = overRow.getBoundingClientRect();
                dragOver(
                    { altKey: state.altKey, shiftKey: state.shiftKey, dataTransfer: { dropEffect: "move" } } as unknown as React.DragEvent<HTMLDivElement>,
                    overRow.dataset.treeId,
                    { x: state.x - rect.left, y: state.y - rect.top },
                );
            }
        };
        // Edge auto-scroll: while the pointer hovers near the scroller's top or
        // bottom edge, keep scrolling and re-hit-testing even when the pointer
        // itself is not moving.
        let scrollLoop: number | null = null;
        const autoScrollTick = () => {
            scrollLoop = null;
            if (!state.active || !scroller || !win) return;
            const rect = scroller.getBoundingClientRect();
            const EDGE = 32;
            const MAX_SPEED = 14;
            let delta = 0;
            if (state.y < rect.top + EDGE) delta = -Math.ceil(((rect.top + EDGE - state.y) / EDGE) * MAX_SPEED);
            else if (state.y > rect.bottom - EDGE) delta = Math.ceil(((state.y - (rect.bottom - EDGE)) / EDGE) * MAX_SPEED);
            if (delta != 0) {
                const before = scroller.scrollTop;
                scroller.scrollTop = before + delta;
                if (scroller.scrollTop != before) hitTest();
            }
            scrollLoop = win.requestAnimationFrame(autoScrollTick);
        };
        const onMove = (ev: PointerEvent) => {
            if (!state.active) {
                if (Math.abs(ev.clientX - state.startX) + Math.abs(ev.clientY - state.startY) < 5) return;
                state.active = true;
                doc.body.style.userSelect = "none";

                try {
                    row.setPointerCapture(state.pointerId);
                } catch {
                    // capture is an optimization (keeps events flowing outside
                    // the window); the drag still works from the document
                    // listeners
                }
                dragStarted(state.id, state.sourceEl);
                // There is no native drag session behind a pointer drag, so the
                // Obsidian dragManager must not be notified on completion.
                nativeDragFinished.current = true;
                if (scrollLoop == null && win) scrollLoop = win.requestAnimationFrame(autoScrollTick);
            }
            state.x = ev.clientX;
            state.y = ev.clientY;
            state.altKey = ev.altKey;
            state.shiftKey = ev.shiftKey;
            if (pointerGhostRef.current) {
                pointerGhostRef.current.style.transform = `translate3d(${ev.clientX + 14}px, ${ev.clientY + 10}px, 0)`;
            }
            hitTest();
        };
        const onUp = (ev: PointerEvent) => {
            const wasActive = state.active;
            const focusIndex = pointerFocusRef.current;
            state.cleanup();
            if (!wasActive) return;
            // The row underneath still receives a click after pointerup; swallow
            // it so finishing a drag does not open the path.
            const suppressClick = (ce: Event) => {
                ce.stopPropagation();
                ce.preventDefault();
            };
            doc.defaultView?.addEventListener("click", suppressClick, true);
            setTimeout(() => doc.defaultView?.removeEventListener("click", suppressClick, true), 0);
            if (focusIndex != null) {
                const droppedPaths = dragPathsRef.current;
                setFocuses(focuses.map((focus, index) => (index == focusIndex ? { ...focus, paths: [...focus.paths, ...droppedPaths.filter((path) => !focus.paths.includes(path))] } : focus)));
                resetState();
                return;
            }
            if (overIdRef.current) {
                dragEnded(pointerDragEventShim(ev), overIdRef.current);
            } else {
                resetState();
            }
        };
        const onCancel = () => {
            const wasActive = state.active;
            state.cleanup();
            if (wasActive) resetState();
        };
        const onKey = (ev: KeyboardEvent) => {
            if (ev.key == "Escape") onCancel();
        };
        state.cleanup = () => {
            setFocusTarget(null);
            // Listeners live on the document so the drag survives the source
            // row being re-rendered or unmounted mid-drag (multi-select drags
            // dim/re-render rows; external updates can rebuild the tree).
            doc.removeEventListener("pointermove", onMove);
            doc.removeEventListener("pointerup", onUp);
            doc.removeEventListener("pointercancel", onCancel);
            doc.defaultView?.removeEventListener("keydown", onKey, true);
            if (scrollLoop != null) {
                win?.cancelAnimationFrame(scrollLoop);
                scrollLoop = null;
            }
            try {
                row.releasePointerCapture(state.pointerId);
            } catch {
                // pointer may already be released
            }
            doc.body.style.removeProperty("user-select");
            pointerDragRef.current = null;
        };
        doc.addEventListener("pointermove", onMove);
        doc.addEventListener("pointerup", onUp);
        doc.addEventListener("pointercancel", onCancel);
        doc.defaultView?.addEventListener("keydown", onKey, true);
        // TODO(rare): if the source row unmounts mid-drag its pointer capture
        // is silently released; the document listeners keep the drag alive
        // inside the window, but events outside the window are then lost until
        // pointerup. Not handled — the case is rare enough (external tree
        // rebuild mid-drag while the cursor is outside the window).
        pointerDragRef.current = state;
    };

    const dragOverTree = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();


        const currentActive = isExternalFileDrag(e) ? EXTERNAL_DRAG_NODE : (activeRef.current ?? active);
        if (currentActive?.parentId != null) return;
        if ((e.target as HTMLElement).closest('[draggable="true"]')) return;

        // Treat the Open row and the empty area below it as the end of the root
        // section list. Without a concrete TreeItem handling this dragover,
        // Obsidian clears the action label and falls back to its green copy badge.
        const lastSection = [...flattenedTree].reverse().find((node) => node.type != "new" && node.parentId == null);
        if (!lastSection) return;
        dragOver(e, lastSection.id, {
            x: 0,
            y: spaceRowHeight(superstate, presetRowHeight, false),
        });
    };

    return (
        <div
            ref={treeRef}
            className="mk-path-tree"
            onDragLeave={dragLeave}
            onDragOver={dragOverTree}
            onPointerDown={onTreePointerDown}
            style={
                {
                    "--spaceRowHeight": spaceRowHeight(superstate, presetRowHeight, false) + "px",
                    "--spaceSectionHeight": spaceRowHeight(superstate, presetRowHeight, true) + "px",
                } as React.CSSProperties
            }
            onDrop={(e) => {
                if (isExternalFileDrag(e)) {
                    e.preventDefault();
                    const files = Array.from(e.dataTransfer?.files ?? []);
                    dropExternalFilesAtProjection(superstate, files, dragActionRef.current?.action.projection ?? null, flattenedTree);
                    resetState();
                    return;
                }
                if (overId) {
                    dragEnded(e, overId);
                } else {
                    resetState();
                }
            }}
        >
            {flattenedTree.length == 1 || editFocus != null ? (
                <FocusEditor
                    superstate={superstate}
                    focus={focuses[editFocus ?? activeFocus]}
                    saveFocus={(focus) => {
                        const focusIndex = editFocus ?? activeFocus;
                        setEditFocus(null);
                        setFocuses(
                            focuses.map((f, i) => {
                                return i == focusIndex ? focus : f;
                            }),
                        );
                    }}
                ></FocusEditor>
            ) : (
                <VirtualizedList
                    vRef={listRef}
                    rowHeights={rowHeights}
                    flattenedTree={flattenedTree}
                    dragAction={dragAction}
                    handleCollapse={handleCollapse}
                    activePath={activePath}
                    superstate={superstate}
                    selectedPaths={selectedPaths}
                    selectRange={selectRange}
                    indentationWidth={indentationWidth}
                    enableObsidianDragGhost={ENABLE_OBSIDIAN_DRAG_GHOST}
                    pointerDnd={ENABLE_POINTER_DND}
                    dragStarted={dragStarted}
                    dragOver={dragOver}
                    dragEnded={dragEnded}
                    overIndex={overIndex}
                    activeIndex={activeIndex}
                ></VirtualizedList>
            )}
            {ENABLE_POINTER_DND &&
                active &&
                pointerDragRef.current?.active &&
                createPortal(
                    // Obsidian's own drag-ghost markup so the theme styles it;
                    // portaled to body because fixed positioning breaks inside
                    // the transformed/clipped virtualized list ancestors.
                    <div
                        ref={pointerGhostRef}
                        className="drag-ghost mk-drag-ghost"
                        style={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            transform: `translate3d(${pointerDragRef.current.x + 14}px, ${pointerDragRef.current.y + 10}px, 0)`,
                            pointerEvents: "none",
                            willChange: "transform",
                        }}
                    >
                        <div className="drag-ghost-self" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            {active.type == "separator" ? (
                                <div className="mk-path-icon" dangerouslySetInnerHTML={{ __html: superstate.ui.getSticker("lucide//separator-horizontal") }}></div>
                            ) : (
                                <>
                                    {dragPaths.length == 1 && active.item && (
                                        <PathStickerView superstate={superstate} pathState={superstate.pathStateForPath(active.item.path) ?? active.item} space={active.space} editable={false} />
                                    )}
                                    <span>{dragPaths.length > 1 ? i18n.labels.filesCount.replace("{$1}", dragPaths.length.toString()) : (active.item?.name ?? active.path)}</span>
                                </>
                            )}
                        </div>
                        {pointerFocusTarget != null ? (
                            <div className="drag-ghost-action">{`${i18n.labels.addTo} ${focuses[pointerFocusTarget]?.name || i18n.labels.focus}`}</div>
                        ) : (
                            dragAction?.label && <div className="drag-ghost-action">{dragAction.label}</div>
                        )}
                    </div>,
                    (treeRef.current?.ownerDocument ?? document).body,
                )}
            {modifier && active?.parentId != null && !isTagTreeItemPath(active?.item) && !isLinkedTreeItem(active) && !(dragAction?.action.type == "link" && dragAction.action.containerId == null) && (
                <div
                    className="mk-hint-dnd"
                    style={{
                        position: "absolute",
                        bottom: "10px",
                        left: "10px",
                        background: "var(--mk-ui-active)",
                        boxShadow: "var(--background-modifier-box-shadow)",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        color: "var(--text-on-accent)",
                        fontSize: "12px",
                    }}
                >
                    <div>{i18n.hintText.dragDropCopyModifierKey}</div>
                    {active?.type != "separator" && <div>{i18n.hintText.dragDropLinkModifierKey}</div>}
                </div>
            )}
        </div>
    );
};
