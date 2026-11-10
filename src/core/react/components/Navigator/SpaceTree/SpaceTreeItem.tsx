import classNames from "classnames";
import React, { CSSProperties, useCallback, useContext, useEffect, useRef, useState } from "react";

import { showPathContextMenu, triggerMultiPathMenu } from "core/react/components/UI/Menus/navigator/pathContextMenu";
import { targetLocationForEvent } from "core/utils/targetLocation";
import { NavigatorContext } from "core/react/context/SidebarContext";
import { PathStickerView } from "core/react/components/PathSticker";
import { Superstate } from "makemd-core";
import { Pos } from "shared/types/Pos";
import { PathState } from "shared/types/PathState";
import { TreeNode, spaceStickerLabel } from "core/utils/superstate/spaces";
import { windowFromDocument } from "utils/dom";
import { canOpenTreeItemPath, isTagTreeItemPath, isTagSpacePath } from "schemas/builtin";
import { CollapseToggle } from "../../UI/Toggles/CollapseToggle";
import { treeItemActiveColorVariables, treeItemColorVariables, treeItemDisplayColor, treeItemDisplayName } from "./treeItemStyles";
import { pathDisplayInfo } from "core/utils/pathDisplay";
import { isExternalFileDrag } from "core/utils/dnd/externalFileDrop";

export type DropModifiers = "copy" | "link" | "move";
type TreeItemStyle = React.CSSProperties & Record<string, string>;
export const FOLDER_NOTE_TREE_CLASS = "mk-has-folder-note";

export const shouldShowLinkedItemIcon = (data: TreeNode) => {
    if (data.depth <= 0 || isTagSpacePath(data.space)) return false;
    if (isTagTreeItemPath(data.item) && data.item?.path != data.space) return true;
    if (data.item?.linkedSpaces?.includes(data.space)) return true;
    return false
}

export const linkedItemIcon = (data: TreeNode) => data.filtered ? "lucide//filter" : "lucide//link-2";

export const shouldShowPinnedItemIcon = (data: TreeNode) => {
    if (data.depth == 0) return false;
    return !!data.pinned;
}

export const pathStateForTreeItem = (superstate: Superstate, data: TreeNode): PathState => {
    const indexedPathState = superstate.pathStateForPath(data.item.path) ?? data.item;
    const pathState = { ...indexedPathState, ...data.item } as PathState;
    if (pathState.type == "space" || !data.space) return pathState;

    const spaceMetadata = superstate.spacesIndex.get(data.space)?.metadata;
    return {
        ...pathState,
        color: spaceMetadata?.["file-colors"]?.[pathState.path] ?? spaceMetadata?.defaultColor ?? "",
    };
};

export const eventToModifier = (e: React.DragEvent, isDefaultSpace?: boolean) => (e.altKey ? "copy" : e.shiftKey || isDefaultSpace ? "link" : "move");
export interface TreeItemProps {
    id: string;
    disabled: boolean;
    collapsed?: boolean;
    depth: number;
    active: boolean;
    selected: boolean;
    highlighted: boolean;
    dimmed: boolean;
    onSelectRange?(id: string): void;
    indicator: boolean;
    indicatorVariant?: "line-top" | "line-bottom" | "box";
    indicatorDepth?: number | null;
    indentationWidth: number;
    data: TreeNode;
    superstate: Superstate;
    style: CSSProperties;
    onCollapse?(node: TreeNode, open: boolean): void;
    enableObsidianDragGhost: boolean;
    pointerDnd?: boolean;
    dragStarted: (activeId: string, source: HTMLElement) => void;
    dragOver: (e: React.DragEvent<HTMLElement>, overId: string, position: Pos) => void;
    dragEnded: (e: React.DragEvent<HTMLDivElement>, overId: string) => void;
    dragActive: boolean;
}

export const toggleSelectedPath = (selected: TreeNode[], path: TreeNode): TreeNode[] =>
    selected.some((f) => f.id == path.id) ? selected.filter((f) => f.id != path.id) : [...selected, path];

// A folder click never folds (that is the double click). An unselected folder gets selected and
// its folder note opened; the single selected folder ignores further clicks.
export const folderClickPlan = (selected: boolean, selectedCount: number, folderNotePath: string | null): { select: boolean; openPath: string | null } => {
    if (selected && selectedCount == 1) return { select: false, openPath: null };
    return { select: true, openPath: selected ? null : (folderNotePath ?? null) };
};

const TreeItemComponent = (props: TreeItemProps) => {
    const { id: _id, data, depth, dragActive, active, indentationWidth, indicator, indicatorVariant = "line-top", indicatorDepth = null, collapsed, selected, highlighted, dimmed, onCollapse, onSelectRange, style, superstate, disabled: _disabled, enableObsidianDragGhost, dragStarted, dragOver, dragEnded } = props;
    const { setActivePath: setActivePath, selectedPaths: selectedPaths, setSelectedPaths: setSelectedPaths, closeActiveSpace, treeOrderRef } = useContext(NavigatorContext);

    const innerRef = useRef(null);
    const [, refreshPathState] = useState(0);
    // The tree is rebuilt (new TreeNode objects) whenever the index changes, so `data` is a safe memo key.
    const pathState = React.useMemo(() => pathStateForTreeItem(superstate, data), [superstate, data]);
    const openAuxClick = (e: React.MouseEvent) => {
        if (e.button == 1 && canOpenTreeItemPath(pathState)) {
            superstate.ui.openPath(pathState.path, "tab");
            setActivePath(pathState.path);
            setSelectedPaths([data]);
        }
    };
    const openPathAtTarget = (path: TreeNode, e: React.MouseEvent) => {
        if (e.shiftKey) {
            onSelectRange(path.id as string);
            return;
        } else if (e.altKey) {
            setSelectedPaths((s) => toggleSelectedPath(s, path));
            return;
        }
        if (isTagSpace) {
            onCollapse?.(data, Boolean(collapsed));
        } else if (isSpace) {
            const plan = folderClickPlan(selected, selectedPaths.length, data.folderNotePath ?? null);
            if (!plan.select) return;
            if (plan.openPath) superstate.ui.openPath(plan.openPath, targetLocationForEvent(e));
            setActivePath(path.item.path);
            setSelectedPaths([path]);
            return;
        }
        if (canOpenTreeItemPath(path.item)) {
            superstate.ui.openPath(path.item.path, targetLocationForEvent(e));
        }
        setActivePath(path.item.path);
        setSelectedPaths([path]);
    };

    const toggleFolderOnDoubleClick = (e: React.MouseEvent) => {
        if (!isSpace || isTagSpace || e.shiftKey || e.altKey) return;
        onCollapse(data, false);
    };

    const onDragStarted = (e: React.DragEvent<HTMLDivElement>) => {
        if (selectedPaths.length > 1) {
            const paths = selectedPaths.map((f) => f.path);
            if (enableObsidianDragGhost) {
                superstate.ui.dragStarted(e, paths);
            }
            dragStarted(data.id, e.currentTarget);

            return;
        }
        if (enableObsidianDragGhost) {
            superstate.ui.dragStarted(e, [data.path]);
        }
        dragStarted(data.id, e.currentTarget);
    };
    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!innerRef.current) return;
        const rect = innerRef.current.getBoundingClientRect();
        const position = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };

        dragOver(e, data.id, position);
    };
    const onDragEnded = (e: React.DragEvent<HTMLDivElement>) => {
        // An OS-file drop must reach Obsidian's own drop handler: its file import is
        // async and bails out silently when it later finds propagation stopped, so
        // stopping here would swallow the copy and leave the highlight stuck.
        if (isExternalFileDrag(e)) return;
        e.stopPropagation();
        dragEnded(e, data.id);
    };
    const handleRightClick = (e: React.MouseEvent) => {
        if (selectedPaths.length > 1 && selectedPaths.some((f) => f.id == (data.id as string))) {
            triggerMultiPathMenu(superstate, selectedPaths, e, treeOrderRef.current);
            return;
        }
        // Select the item like a left click would, but without opening it or its folder note.
        if (data.item?.path) {
            setActivePath(data.item.path);
            setSelectedPaths([data]);
        }
        contextMenu(e);
    };
    const color = treeItemDisplayColor(pathState, pathState?.type == "space" ? superstate.spacesIndex.get(pathState.path)?.metadata?.defaultColor : "");
    const contextMenu = (e: React.MouseEvent) => {
        if (superstate.settings.overrideNativeMenu) {
            return superstate.ui.nativePathMenu(e, pathState.path);
        }

        showPathContextMenu(superstate, data.path, data.type == "group" ? null : data.space, (e.target as HTMLElement).getBoundingClientRect(), windowFromDocument(e.view.document), "right", data.type == "group" ? () => closeActiveSpace(data.path) : null, data.depth, data.expandKey);
    };
    const pathStateUpdated = (payload: { path: string }) => {
        if (superstate.spaceManager.isRenaming) return;
        if (payload.path == data.item.path) refreshPathState((version) => version + 1);
    };
    const spaceStateUpdated = (payload: { path: string }) => {
        if (superstate.spaceManager.isRenaming) return;
        if (payload.path == data.space) refreshPathState((version) => version + 1);
    };
    useEffect(() => {
        superstate.eventsDispatcher.addListener("pathStateUpdated", pathStateUpdated);
        superstate.eventsDispatcher.addListener("spaceStateUpdated", spaceStateUpdated);
        return () => {
            superstate.eventsDispatcher.removeListener("pathStateUpdated", pathStateUpdated);
            superstate.eventsDispatcher.removeListener("spaceStateUpdated", spaceStateUpdated);
        };
    }, [superstate, data.item.path, data.space]);
    const dropProps = {
        onDragOver: onDragOver,
    };
    const innerProps = {
        // In pointer-DnD mode internal drags are driven by pointer events in
        // SpaceTreeView; native dragstart must not fire for tree rows. Native
        // drop handlers stay attached so external drags (files, other panes)
        // are still accepted.
        draggable: !props.pointerDnd,
        onDragStart: onDragStarted,
        onDrop: onDragEnded,
        onDragEnd: onDragEnded,
    };
    const isSpace = pathState?.type == "space";
    const raisedIndicator = indicator && indicatorVariant != "box" && indicatorDepth != null && indicatorDepth < depth;
    const isTagSpace = isTagTreeItemPath(pathState ?? data.item);

    const hasFolderNote = isSpace && !isTagSpace && data.folderNotePath != null;

    const { displayInfo, displayName, stickerLabel } = React.useMemo(() => {
        const info = pathDisplayInfo(pathState.path);
        const name = isSpace ? treeItemDisplayName(pathState, data, superstate.spacesIndex) : info.title;
        return {
            displayInfo: info,
            displayName: name,
            stickerLabel: data.sort && isSpace ? spaceStickerLabel(name, data.sort, isTagSpace, data.folderCount, data.fileCount) : name,
        };
    }, [pathState, data, superstate, isSpace, isTagSpace]);

    const spacing = data.type == "group" ? -2 : indentationWidth * (depth - 1) + (data.type == "space" ? 0 : 20);

    return (
        <>
            <div
                className={classNames(
                    "mk-tree-wrapper",
                    data.type == "group" && !isTagSpace ? "mk-tree-section" : "",
                    data.type == "group" && isTagSpace ? "mk-tree-tag" : "",
                    indicator && indicatorVariant == "line-bottom" ? "mk-wrapper-indicator-bottom" : "",
                    highlighted ? "is-highlighted" : "",
                    dimmed ? "is-dimmed" : "",
                )}
                style={treeItemColorVariables(color, isSpace) as TreeItemStyle}
                data-depth={depth}
                data-tree-id={props.id}
                ref={innerRef}
                onAuxClick={openAuxClick}
                onClick={(e) => openPathAtTarget(data, e)}
                onDoubleClick={toggleFolderOnDoubleClick}
                onMouseDown={(e) => {
                    // Keep a double click from selecting the row text.
                    if (e.detail > 1) e.preventDefault();
                }}
                onContextMenu={(e) => handleRightClick(e)}
                {...dropProps}
                {...innerProps}
            >
                <div
                    className={classNames(isSpace ? "nav-folder" : "nav-file")}
                    style={{
                        ...style,
                        ...(dragActive ? { pointerEvents: "none" } : {}),
                    }}
                >
                    <div
                        className={classNames(
                            "mk-tree-item",
                            "tree-item-self",
                            isSpace ? "nav-folder-title" : "nav-file-title",
                            hasFolderNote ? FOLDER_NOTE_TREE_CLASS : "",
                            active ? "is-active" : "",
                            selected ? "is-selected" : "",

                            indicator ? "mk-indicator-row" : "",
                            indicator && indicatorVariant == "line-bottom" ? "mk-indicator-row-bottom" : "",
                            indicator && indicatorVariant == "box" ? "mk-indicator-row-box" : "",
                            raisedIndicator ? "mk-indicator-row-raised" : "",
                        )}
                        style={
                            {
                                "--spacing": `var(--indicator-spacing, ${spacing}px)`,
                                ...(raisedIndicator ? { "--indicator-spacing": `${indentationWidth * Math.max(0, indicatorDepth - 1) + 20}px` } : {}),
                                ...treeItemActiveColorVariables(color, isSpace),
                            } as TreeItemStyle
                        }
                        // Not data-path: Folder Notes treats any .nav-folder-title[data-path] as the file
                        // explorer and swallows title clicks before the row handler runs.
                        data-tree-path={pathState?.path}
                    >
                        {data.type == "space" && (
                            <CollapseToggle
                                superstate={props.superstate}
                                collapsed={collapsed}
                                onToggle={(_c, e) => {
                                    e.preventDefault();
                                    onCollapse(data, false);
                                    e.stopPropagation();
                                }}
                            ></CollapseToggle>
                        )}
                        {pathState && (
                            <PathStickerView
                                superstate={superstate}
                                pathState={pathState}
                                space={data.space}
                                editable={true}
                                useColorMenu={isTagSpace || pathState.type == "file" || (pathState.type == "space" && pathState.path == '/')}
                                keepBackgoundColor={pathState.type == "file"}
                                color={color}
                                ariaLabel={stickerLabel}
                            />
                        )}
                        <div className={`mk-tree-text ${isSpace ? "nav-folder-title-content" : "nav-file-title-content"}`}>{displayName}</div>

                        {data.type == "group" && data.childrenCount > 0 && (
                            <CollapseToggle
                                superstate={props.superstate}
                                collapsed={collapsed}
                                onToggle={(_c, e) => {
                                    e.preventDefault();
                                    onCollapse(data, false);
                                    e.stopPropagation();
                                }}
                            ></CollapseToggle>
                        )}

                        <div className="mk-tree-span"></div>
                        {!isSpace && displayInfo.extension && (
                            <span className="nav-file-tag">{displayInfo.extension.slice(1)}</span>
                        )}
                        {shouldShowLinkedItemIcon(data) && (
                            <div className="mk-linked-item-icon">
                                <PathStickerView
                                    superstate={superstate}
                                    pathState={{
                                        name: "linked",
                                        path: "",
                                        sticker: linkedItemIcon(data),
                                    }}
                                    space={data.space}
                                    editable={false}
                                />
                            </div>
                        )}
                        {shouldShowPinnedItemIcon(data) && (
                            <div className="mk-pinned-item-icon">
                                <PathStickerView
                                    superstate={superstate}
                                    pathState={{
                                        name: "pinned",
                                        path: "",
                                        sticker: "lucide//pin",
                                    }}
                                    space={data.space}
                                    editable={false}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

// Rows are rendered by a virtualized list that re-renders on every drag hover; skip rows whose props did not change.
export const TreeItem = React.memo(TreeItemComponent);
TreeItem.displayName = "TreeItem";
