import { isEqual } from "lodash";
import i18n from "shared/i18n";

import { NavigatorContext } from "core/react/context/SidebarContext";
import { TreeNode, childSpaceSort, effectiveSpaceSort, isSpaceSortable, pathStateToTreeNode, pinnedItemsFirst, spaceRowHeight, spaceToTreeNode } from "core/utils/superstate/spaces";
import { CustomVaultChangeEvent, eventTypes } from "schemas/event";
import { DragAction, DragActionModel, DragActionVisual, DragInsertPosition, DragProjection, getProjection } from "core/utils/dnd/dragPath";
import { dropPathsInTree } from "core/utils/dnd/dropPath";
import { hideFolderNoteFileFromItems } from "integrations/folderNotesPluginIntegration";
import { Superstate } from "makemd-core";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { PathState, SpaceState } from "shared/types/PathState";
import { Pos } from "shared/types/Pos";
import { SpaceSort } from "shared/types/spaceDef";
import { PathStateWithRank } from "shared/types/superstate";
import { FocusEditor } from "./NavigatorFocusEditor";
import { DropModifiers, eventToModifier } from "./SpaceTreeItem";
import { VirtualizedList } from "./SpaceTreeVirtualized";
import { isTagTreeItemPath } from "schemas/builtin";

interface SpaceTreeComponentProps {
    superstate: Superstate;
}

const ENABLE_OBSIDIAN_DRAG_GHOST = true;
const ENABLE_DRAG_ACTION_LABEL = true;

const treeForSpace = (superstate: Superstate, space: SpaceState, path: PathStateWithRank, depth: number, parentId: string, activeId: string, sortable: boolean, root: boolean, parentPath: string, sort: SpaceSort, expandedSpaces: string[], pinned?: boolean) => {
    const tree: TreeNode[] = [];
    const id = parentId ? parentId + "/" + space.path : space.path;
    // Only check expandedSpaces - don't force collapse based on activeId
    // This fixes the issue where folders with folder notes couldn't be expanded
    const spaceCollapsed = !expandedSpaces.includes(id);
    const parentSort = effectiveSpaceSort(sort, superstate.settings);
    const spaceSort = childSpaceSort(space.metadata?.sort, parentSort, superstate.settings);
    const childrenSortable = isSpaceSortable(space, superstate.settings);
    let children = superstate.getSpaceItems(space.path) ?? [];
    children = hideFolderNoteFileFromItems(superstate, space.path, children);
    if (!spaceCollapsed || root) {
        pinnedItemsFirst(children, space, spaceSort).forEach((item) => {
            const _parentId = parentId ? parentId + "/" + space.path : space.path;
            const pinned = item.pinnedSpaces?.includes(space.path);
            if (item.type != "space") {
                tree.push(pathStateToTreeNode(superstate, item, space.path, item.path, depth + 1, 0, true, childrenSortable, 0, _parentId, pinned));
            } else {
                if (superstate.spacesIndex.has(item.path)) {
                    tree.push(...treeForSpace(superstate, superstate.spacesIndex.get(item.path), item, depth + 1, _parentId, activeId, childrenSortable, false, space.path, spaceSort, expandedSpaces, pinned));
                }
            }
        });
    }
    if (!root) tree.splice(0, 0, spaceToTreeNode(path, spaceCollapsed, sortable, depth, parentId, parentPath, children.length, spaceSort, pinned));
    return tree;
};

const treeForRoot = (superstate: Superstate, space: SpaceState, active: TreeNode, expandedSpaces: string[]) => {
    const tree: TreeNode[] = [];

    const pathIndex = superstate.pathStateForPath(space.path);
    const spaceSort = effectiveSpaceSort(space.metadata?.sort, superstate.settings);
    const childrenSortable = isSpaceSortable(space, superstate.settings);
    let children = superstate.getSpaceItems(space.path) ?? [];
    children = hideFolderNoteFileFromItems(superstate, space.path, children);
    if (pathIndex)
        tree.push({
            id: space.path,
            parentId: null,
            depth: 0,
            index: 0,
            space: space.path,
            path: space.path,
            item: pathIndex,
            rank: null,
            collapsed: expandedSpaces.includes(space.path) ? false : true,
            sortable: childrenSortable,
            childrenCount: children.length,
            type: "group",
            sort: spaceSort,
        });

    if (!expandedSpaces.includes(space.path) || (active && !active.parentId)) {
        return tree;
    }
    pinnedItemsFirst(children, space, spaceSort).forEach((item) => {
        const _parentId = space.path;
        const pinned = item.pinnedSpaces?.includes(space.path);
        if (item.type != "space") {
            const id = _parentId + "/" + item.path;
            const itemCollapsed = !expandedSpaces.includes(id);
            tree.push(pathStateToTreeNode(superstate, item, space.path, item.path, 1, 0, itemCollapsed, childrenSortable, 0, _parentId, pinned));
        } else {
            if (superstate.spacesIndex.has(item.path)) tree.push(...treeForSpace(superstate, superstate.spacesIndex.get(item.path), item, 1, _parentId, active?.id, childrenSortable, false, space.path, spaceSort, expandedSpaces, pinned));
        }
    });
    return tree;
};

const retrieveData = (superstate: Superstate, activeViewSpaces: PathState[], active: TreeNode, expandedSpaces: string[]) => {
    const tree: TreeNode[] = [];
    activeViewSpaces
        .filter((f) => f)
        .forEach((item) => {
            if (superstate.spacesIndex.has(item.path)) {
                tree.push(...treeForRoot(superstate, superstate.spacesIndex.get(item.path), active, expandedSpaces));
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
        modifier,
        setModifier,
        editFocus: editFocus,
        setEditFocus: setEditFocus,
    } = useContext(NavigatorContext);

    const [active, setActive] = useState<TreeNode>(null);
    const [overId, setOverId] = useState<string>(null);
    const [flattenedTree, setFlattenedTree] = useState<TreeNode[]>([]);
    const treeRef = useRef<HTMLDivElement>(null);
    const nextTreeScrollPath = useRef(null);
    const [presetRowHeight, setPresetRowHeight] = useState<number>(props.superstate.settings.spaceRowHeight);

    const [offset, setOffset] = useState<{
        x: number;
        y: number;
    }>({ x: 0, y: 0 });
    const overIdRef = useRef<string>(null);
    const offsetRef = useRef({ x: 0, y: 0 });
    const modifierRef = useRef<DropModifiers>(null);
    const activeRef = useRef<TreeNode>(null);
    const dragPathsRef = useRef<string[]>([]);
    const dragActionRef = useRef<DragActionModel | null>(null);
    const listRef = useRef<{
        scrollToIndex: (index: number, options: { align: "start" | "center" | "end" | "auto" }) => void;
    }>(null);
    const reloadData = useCallback(() => {
        setFlattenedTree(retrieveData(superstate, activeViewSpaces, active, expandedSpaces));
    }, [superstate, activeViewSpaces, active, expandedSpaces]);

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
        const handleDragEnd = () => {
            // Don't reset if we're in the middle of a drop operation
            if (!isDropping.current) {
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
            let parentSpaces = activeViewSpaces?.filter((f) => path?.startsWith(f?.path) || f?.path == "/") ?? [];

            // If file not in current focus's spaces, check if "/" space is available
            // and add it to allow revealing files from any focus
            if (parentSpaces.length == 0) {
                const rootSpace = superstate.pathsIndex.get("/");
                if (rootSpace) {
                    parentSpaces = [rootSpace];
                }
            }
            if (!path || parentSpaces.length == 0) return;

            let newOpenFolders = expandedSpaces;
            let newScrollToSpace = null;
            parentSpaces.forEach((space) => {
                const folders = path.split("/");
                const pathLevel = space.path.split("/").filter((f) => f.length > 0).length;
                const openPaths = folders.reduce(
                    (p, c, index) => {
                        return [...p, ...(index < pathLevel ? [] : [index == 0 ? "//" + c : p[p.length - 1] + "/" + folders.slice(0, index + 1).join("/")])];
                    },
                    [space.path],
                );
                newScrollToSpace = openPaths[openPaths.length - 1];
                newOpenFolders = [...(newOpenFolders.filter((f) => !openPaths.find((g) => g == f)) ?? []), ...openPaths.slice(0, -1)];
            });

            superstate.settings.expandedSpaces = newOpenFolders;
            nextTreeScrollPath.current = newScrollToSpace;
            superstate.saveSettings();
        },
        [expandedSpaces, activeViewSpaces],
    );

    useEffect(() => {
        const handleRevealPathEvent = (evt: CustomVaultChangeEvent) => {
            if (evt.detail.path) revealPath(evt.detail.path);
        };
        window.addEventListener(eventTypes.revealPath, handleRevealPathEvent);
        return () => {
            window.removeEventListener(eventTypes.revealPath, handleRevealPathEvent);
        };
    }, [revealPath]);

    useEffect(() => {
        if (nextTreeScrollPath.current) {
            const index = flattenedTree.findIndex((f) => f.id == nextTreeScrollPath.current);
            if (index != -1) {
                listRef.current.scrollToIndex(index, { align: "center" });
                nextTreeScrollPath.current = null;
            }
        }
    }, [flattenedTree]);
    useEffect(() => {
        const spaceUpdated = (payload: { path: string }) => {
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
        const tree = retrieveData(superstate, activeViewSpaces, active, expandedSpaces);
        setFlattenedTree(tree);
    }, [expandedSpaces, activeViewSpaces, active]);

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

    const dragStarted = (activeId: string) => {
        const activeItem = flattenedTree.find(({ id }) => id === activeId);
        //Dont drag vault
        activeRef.current = activeItem;
        setActive(activeItem);
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
            ? { kind: "line", itemId: position.itemId, position: position.kind }
            : targetContainerId
              ? overItem?.id == targetContainerId && (overItem.collapsed || overItem.childrenCount == 0)
                  ? { kind: "box", containerId: targetContainerId }
                  : { kind: "folder", containerId: targetContainerId }
              : null;
        if (!visual) return null;
        return {
            action,
            visual,
            label: ENABLE_OBSIDIAN_DRAG_GHOST && ENABLE_DRAG_ACTION_LABEL ? dragActionLabel(action) : null,
        };
    };

    const dragOver = (e: React.DragEvent<HTMLElement>, _overId: string, position: Pos) => {
        const currentActive = activeRef.current ?? active;
        const modifier = currentActive?.parentId == null ? "move" : eventToModifier(e);
        if (modifierRef.current != modifier) {
            modifierRef.current = modifier;
            setModifier(modifier);
        }
        e.dataTransfer.dropEffect = modifier;
        const x = offsetRef.current.x;
        const y = offsetRef.current.y;
        const rowHeight = spaceRowHeight(superstate, presetRowHeight, false);
        const newY = position.y <= rowHeight / 3 ? 0 : position.y >= (rowHeight * 2) / 3 ? rowHeight : 13;
        const nextOverId = _overId ?? overIdRef.current;
        const currentDragPaths = dragPathsRef.current.length > 0 ? dragPathsRef.current : dragPaths;
        const nextOverIndex = flattenedTree.findIndex((f) => f.id == nextOverId);
        const overItem = nextOverIndex == -1 ? null : flattenedTree[nextOverIndex];
        const nextDepth = overItem?.depth ?? 0;
        const newX = nextDepth * indentationWidth;
        const nextActiveIndex = currentActive?.id ? flattenedTree.findIndex((f) => f.id == currentActive.id) : -1;
        const nextProjection = currentActive && nextOverId && nextOverIndex != -1 ? getProjection(currentActive, flattenedTree, currentDragPaths, nextOverIndex, nextDepth, newY, nextActiveIndex < nextOverIndex, modifier, currentActive.space) : null;
        const nextDragAction = dragActionForProjection(nextProjection, modifier);
        if (!isEqual(dragActionRef.current, nextDragAction)) {
            dragActionRef.current = nextDragAction;
            setDragAction(nextDragAction);
        }
        if (nextDragAction?.label) {
            superstate.ui.setDragLabel(nextDragAction.label);
        }
        if (currentDragPaths.length > 1) {
            if (_overId && _overId != overIdRef.current) {
                overIdRef.current = _overId;
                setOverId(_overId);
            }
            if (x != newX || y != newY) {
                offsetRef.current = { x: newX, y: newY };
                setOffset({
                    x: newX,
                    y: newY,
                });
            }
            return;
        }
        if (_overId && _overId != overIdRef.current) {
            overIdRef.current = _overId;
            setOverId(_overId);
        }
        if (x != newX || y != newY) {
            offsetRef.current = { x: newX, y: newY };
            setOffset({
                x: newX,
                y: newY,
            });
        }
    };
    useEffect(() => {
        if (dragPaths.length == 0) {
            setOverId(null);
            setActive(null);
            setOffset({ x: 0, y: 0 });
            setModifier(null);
            setDragAction(null);
            activeRef.current = null;
            dragPathsRef.current = [];
            dragActionRef.current = null;
            overIdRef.current = null;
            offsetRef.current = { x: 0, y: 0 };
            modifierRef.current = null;
            dragCounter.current = 0;
            document.body.style.setProperty("cursor", "");
        }
    }, [dragPaths]);

    const dragEnded = async (e: React.DragEvent<HTMLDivElement>, overId: string) => {
        isDropping.current = true;
        pendingReset.current = true;
        treeRef.current?.classList.add("mk-dropping");
        const currentActive = activeRef.current ?? active;
        const actionModifier = dragActionRef.current?.action.type == "link" ? "link" : dragActionRef.current?.action.type == "copy" ? "copy" : "move";
        await dropPathsInTree(superstate, dragPathsRef.current.length > 0 ? dragPathsRef.current : dragPaths, currentActive?.id, dragActionRef.current?.action.projection.overId ?? overId, dragActionRef.current?.action.projection, flattenedTree, activeViewSpaces, actionModifier);
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
        // Fallback reset in case spaceStateUpdated doesn't fire
        setTimeout(() => {
            if (pendingReset.current) {
                pendingReset.current = false;
                flushSync(() => {
                    resetState();
                });
                treeRef.current?.classList.remove("mk-dropping");
            }
        }, 200);
    };

    const handleCollapse = useCallback(
        (folder: TreeNode, open: boolean) => {
            const folderOpen = expandedSpaces?.includes(folder.id);
            const newOpenFolders: string[] = !folderOpen || open ? ([...expandedSpaces, folder.id] as string[]) : (expandedSpaces.filter((openFolder) => folder.id !== openFolder) as string[]);
            setExpandedSpaces(newOpenFolders);
            superstate.settings.expandedSpaces = newOpenFolders;
            superstate.saveSettings();
        },
        [superstate, expandedSpaces],
    );

    function resetState() {
        setDragPaths([]);
        setOverId(null);
        setActive(null);
        setOffset({ x: 0, y: 0 });
        setModifier(null);
        setDragAction(null);
        activeRef.current = null;
        dragPathsRef.current = [];
        dragActionRef.current = null;
        overIdRef.current = null;
        offsetRef.current = { x: 0, y: 0 };
        modifierRef.current = null;
        dragCounter.current = 0;
        document.body.style.setProperty("cursor", "");
    }

    const dragCounter = useRef(0);
    const isDropping = useRef(false);
    const pendingReset = useRef(false);
    const pendingDropReload = useRef(false);

    const dragEnter = () => {
        dragCounter.current++;
    };
    const dragLeave = () => {
        dragCounter.current--;
        if (dragCounter.current == 0) {
            setOverId(null);
            setOffset({ x: 0, y: 0 });
            setDragAction(null);
            dragActionRef.current = null;
            overIdRef.current = null;
            offsetRef.current = { x: 0, y: 0 };
            dragCounter.current = 0;
        }
    };
    const rowHeights = useMemo(() => flattenedTree.map((f) => spaceRowHeight(superstate, presetRowHeight, f.type == "group" && !isTagTreeItemPath(f.item))), [flattenedTree]);

    return (
        <div
            ref={treeRef}
            className="mk-path-tree"
            onDragEnter={() => dragEnter()}
            onDragLeave={() => dragLeave()}
            onDragOver={(e) => e.preventDefault()}
            style={
                {
                    "--spaceRowHeight": spaceRowHeight(superstate, presetRowHeight, false) + "px",
                    "--spaceSectionHeight": spaceRowHeight(superstate, presetRowHeight, true) + "px",
                } as React.CSSProperties
            }
            onDrop={(e) => {
                if (overId) {
                    dragEnded(e, overId);
                } else {
                    resetState();
                }
            }}
        >
            {flattenedTree.length == 1 || editFocus ? (
                <FocusEditor
                    superstate={superstate}
                    focus={focuses[activeFocus]}
                    saveFocus={(focus) => {
                        setEditFocus(false);
                        setFocuses(
                            focuses.map((f, i) => {
                                return i == activeFocus ? focus : f;
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
                    dragStarted={dragStarted}
                    dragOver={dragOver}
                    dragEnded={dragEnded}
                    overIndex={overIndex}
                    activeIndex={activeIndex}
                ></VirtualizedList>
            )}
            {modifier && active?.parentId != null && (
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
                    <div>{i18n.hintText.dragDropLinkModifierKey}</div>
                </div>
            )}
        </div>
    );
};
