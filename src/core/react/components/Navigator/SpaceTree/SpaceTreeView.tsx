import { isEqual } from "lodash";
import i18n from "shared/i18n";

import { NavigatorContext } from "core/react/context/SidebarContext";
import { TreeNode, childSpaceSort, effectiveSpaceSort, isPathPinnedInSpace, pathStateToTreeNode, pinnedItemsFirst, spaceRowHeight, spaceToTreeNode } from "core/superstate/utils/spaces";
import { CustomVaultChangeEvent, eventTypes } from "core/types/types";
import { DragProjection, getDragDepth, getProjection } from "core/utils/dnd/dragPath";
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
import { eventToModifier } from "./SpaceTreeItem";
import { VirtualizedList } from "./SpaceTreeVirtualized";
import { isTagTreeItemPath } from "shared/schemas/builtin";

interface SpaceTreeComponentProps {
    superstate: Superstate;
}

const treeForSpace = (superstate: Superstate, space: SpaceState, path: PathStateWithRank, depth: number, parentId: string, activeId: string, sortable: boolean, root: boolean, parentPath: string, sort: SpaceSort, expandedSpaces: string[], pinned?: boolean) => {
    const tree: TreeNode[] = [];
    const id = parentId ? parentId + "/" + space.path : space.path;
    // Only check expandedSpaces - don't force collapse based on activeId
    // This fixes the issue where folders with folder notes couldn't be expanded
    const spaceCollapsed = !expandedSpaces.includes(id);
    const parentSort = effectiveSpaceSort(sort, superstate.settings);
    const spaceSort = childSpaceSort(space.metadata?.sort, parentSort, superstate.settings);
    let children = superstate.getSpaceItems(space.path) ?? [];
    children = hideFolderNoteFileFromItems(superstate, space.path, children);
    if (!spaceCollapsed || root) {
        pinnedItemsFirst(children, space, spaceSort).forEach((item) => {
            const _parentId = parentId ? parentId + "/" + space.path : space.path;
            const pinned = isPathPinnedInSpace(space, item.path);
            if (item.type != "space") {
                tree.push(pathStateToTreeNode(superstate, item, space.path, item.path, depth + 1, 0, true, space.sortable, 0, _parentId, pinned));
            } else {
                if (superstate.spacesIndex.has(item.path)) {
                    tree.push(...treeForSpace(superstate, superstate.spacesIndex.get(item.path), item, depth + 1, _parentId, activeId, space.sortable, false, space.path, spaceSort, expandedSpaces, pinned));
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
            sortable: space.sortable,
            childrenCount: children.length,
            type: "group",
            sort: spaceSort,
        });

    if (!expandedSpaces.includes(space.path) || (active && !active.parentId)) {
        return tree;
    }
    pinnedItemsFirst(children, space, spaceSort).forEach((item) => {
        const _parentId = space.path;
        const pinned = isPathPinnedInSpace(space, item.path);
        if (item.type != "space") {
            const id = _parentId + "/" + item.path;
            const itemCollapsed = !expandedSpaces.includes(id);
            tree.push(pathStateToTreeNode(superstate, item, space.path, item.path, 1, 0, itemCollapsed, space.sortable, 0, _parentId, pinned));
        } else {
            if (superstate.spacesIndex.has(item.path)) tree.push(...treeForSpace(superstate, superstate.spacesIndex.get(item.path), item, 1, _parentId, active?.id, space.sortable, false, space.path, spaceSort, expandedSpaces, pinned));
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

    // const [dropPlaceholderItem, setDropPlaceholderItem] = useState<[Record<string, string>, number] | null>(null);
    const [offset, setOffset] = useState<{
        x: number;
        y: number;
    }>({ x: 0, y: 0 });
    const listRef = useRef<{
        scrollToIndex: (index: number, options: { align: "start" | "center" | "end" | "auto" }) => void;
    }>(null);

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
        const reloadData = () => {
            setFlattenedTree(retrieveData(superstate, activeViewSpaces, active, expandedSpaces));
        };
        const spaceUpdated = (payload: { path: string }) => {
            if (refreshableSpaces.some((f) => f == payload.path)) {
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
    }, [expandedSpaces, activeViewSpaces, active, expandedSpaces, refreshableSpaces, setFlattenedTree]);

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

    const [projected, setProjected] = useState<DragProjection>(null);
    useEffect(() => {
        const dragDepth = getDragDepth(offset.x, indentationWidth);
        const _projected = overId ? getProjection(active, flattenedTree, dragPaths, overIndex, dragDepth, offset.y, activeIndex < overIndex, modifier, active?.space) : null;
        setProjected((p) => (!isEqual(p, _projected) ? _projected : p));
    }, [active, flattenedTree, overId, overIndex, dragPaths, offset, activeIndex, modifier, indentationWidth, activeViewSpaces]);

    const dragStarted = (activeId: string) => {
        const activeItem = flattenedTree.find(({ id }) => id === activeId);
        //Dont drag vault
        setActive(activeItem);
        setOverId(activeId);

        if (activeItem) {
            if (selectedPaths.length > 1) {
                setDragPaths(selectedPaths.map((f) => f.path));
            } else {
                setDragPaths([activeItem.path]);
            }
        }

        document.body.style.setProperty("cursor", "grabbing");
    };

    const parentName = useMemo(() => (projected ? flattenedTree.find((f) => f.id == projected.parentId)?.item?.name : null), [flattenedTree, projected]);
    const overName = useMemo(() => projected && flattenedTree.find((f) => f.id == projected.overId)?.item?.name, [flattenedTree, projected]);

    const dragOver = (e: React.DragEvent<HTMLElement>, _overId: string, position: Pos) => {
        const modifier = eventToModifier(e);
        setModifier(modifier);
        e.dataTransfer.dropEffect = modifier;
        if (projected) {
            superstate.ui.setDragLabel(`${projected.reorder && !projected.insert ? i18n.labels.reorderIn : modifier == "move" || !modifier ? i18n.labels.moveTo : modifier == "link" ? i18n.labels.linkTo : i18n.labels.copyTo} ${projected.insert ? overName : (parentName ?? "Spaces")}`);
        }
        if (dragPaths.length > 1) {
            if (_overId && _overId != overId) setOverId(_overId);
            return;
        }
        if (_overId && _overId != overId) setOverId(_overId);
        const x = offset.x;
        const y = offset.y;
        const newX = 2 * Math.round(Math.max(1, position.x - indentationWidth - 20));
        const newY = 2 * Math.round(position.y / 2);
        if (x != newX || y != newY) {
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
            setProjected(null);
            dragCounter.current = 0;
            // setDropPlaceholderItem(null);
            document.body.style.setProperty("cursor", "");
        }
    }, [dragPaths]);

    const dragEnded = async (e: React.DragEvent<HTMLDivElement>, overId: string) => {
        isDropping.current = true;
        pendingReset.current = true;
        treeRef.current?.classList.add("mk-dropping");
        const modifiers = eventToModifier(e);
        await dropPathsInTree(superstate, dragPaths, active?.id, overId, projected, flattenedTree, activeViewSpaces, modifiers);
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
        setProjected(null);
        dragCounter.current = 0;
        // setDropPlaceholderItem(null);
        document.body.style.setProperty("cursor", "");
    }

    const dragCounter = useRef(0);
    const isDropping = useRef(false);
    const pendingReset = useRef(false);

    const dragEnter = () => {
        dragCounter.current++;
    };
    const dragLeave = () => {
        dragCounter.current--;
        if (dragCounter.current == 0) {
            setOverId(null);
            setOffset({ x: 0, y: 0 });
            setProjected(null);
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
                    projected={projected}
                    handleCollapse={handleCollapse}
                    activePath={activePath}
                    superstate={superstate}
                    selectedPaths={selectedPaths}
                    selectRange={selectRange}
                    indentationWidth={indentationWidth}
                    dragStarted={dragStarted}
                    dragOver={dragOver}
                    dragEnded={dragEnded}
                    overIndex={overIndex}
                    activeIndex={activeIndex}
                ></VirtualizedList>
            )}
            {modifier && (
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
                    <div>{i18n.hintText.dragDropModifierKeys}</div>
                </div>
            )}
        </div>
    );
};
