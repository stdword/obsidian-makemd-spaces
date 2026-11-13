import { useVirtualizer } from "@tanstack/react-virtual";
import { DragActionModel } from "core/utils/dnd/dragPath";
import { Pos } from "shared/types/Pos";

import { NavigatorContext } from "core/react/context/SidebarContext";
import { createSpace, moveSpaceSeparator, removeSpaceSeparator, setSpaceSeparatorVisible, TreeNode } from "core/utils/superstate/spaces";
import { addTag } from "core/utils/superstate/tags";
import { isSpaceSeparatorPath, SPACE_HIDDEN_SEPARATOR_PATH, SPACE_SEPARATOR_PATH, tagSpacePathFromTag } from "schemas/builtin";
import { SelectOption, SelectOptionType, Superstate } from "makemd-core";
import i18n from "shared/i18n";
import React, { CSSProperties, useContext } from "react";
import { windowFromDocument } from "utils/dom";
import { showOpenMenu } from "../../UI/Menus/modals/selectSpaceMenu";
import { TreeItem } from "./SpaceTreeItem";
import { ensureTag } from "utils/tags";
import { isTagSpacePath } from "schemas/builtin";
import { defaultMenu, menuSeparator } from "../../UI/Menus/menu/SelectionMenu";


// Shared empty style: TreeItem is memoized, and a fresh `{}` per render would defeat that.
const EMPTY_ROW_STYLE: CSSProperties = {};

export type TreeLine = { id: string; left: number; top: number; height: number };

/**
 * Vertical guide lines for expanded containers, in one pass over the flattened tree:
 * children directly follow their parent, so a container has children iff the next row is
 * one level deeper, and its subtree ends right before the next row at its depth or above.
 */
export const treeLinesForTree = (flattenedTree: TreeNode[], rowHeights: number[], rowOffsets: number[], rowSpacing: (node: TreeNode) => number): TreeLine[] => {
    const subtreeEnd = new Array<number>(flattenedTree.length);
    const open: number[] = [];
    for (let i = 0; i < flattenedTree.length; i++) {
        const depth = flattenedTree[i]?.depth ?? 0;
        while (open.length && (flattenedTree[open[open.length - 1]]?.depth ?? 0) >= depth) subtreeEnd[open.pop()] = i - 1;
        open.push(i);
    }
    while (open.length) subtreeEnd[open.pop()] = flattenedTree.length - 1;

    const lines: TreeLine[] = [];
    for (let index = 0; index < flattenedTree.length; index++) {
        const node = flattenedTree[index];
        if (!node || node.depth == 0 || (node.type != "group" && node.type != "space") || node.collapsed) continue;
        const next = flattenedTree[index + 1];
        if (!next || next.depth != node.depth + 1) continue;
        const last = subtreeEnd[index];
        const top = (rowOffsets[index] ?? 0) + (rowHeights[index] ?? 0);
        const bottom = (rowOffsets[last] ?? 0) + (rowHeights[last] ?? 0);
        const height = bottom - top - 4;
        if (height <= 0) continue;
        lines.push({ id: node.id, left: 6 + rowSpacing(node) + 10 - 1, top, height });
    }
    return lines;
};

/** Only the lines that intersect the rendered scroll window are mounted. */
export const visibleTreeLines = (lines: TreeLine[], rangeStart: number, rangeEnd: number): TreeLine[] => lines.filter((line) => line.top < rangeEnd && line.top + line.height > rangeStart);

export const highlightContainerIdForDrag = (flattenedTree: TreeNode[], activeIndex: number, overIndex: number, dragAction: DragActionModel | null) => {
    const activeNode = flattenedTree[activeIndex];
    const activeContainerId = activeNode?.parentId;
    if (activeNode?.type == "separator") return activeContainerId;
    if (!dragAction) {
        const hoverNode = overIndex == -1 ? null : flattenedTree[overIndex];
        if (!hoverNode || overIndex == activeIndex) return activeContainerId;
        if (hoverNode.id == activeContainerId || hoverNode.parentId == activeContainerId) return activeContainerId;
        if (isTagSpacePath(hoverNode.item?.path)) return hoverNode.parentId ?? null;
        if (hoverNode.item?.type == "space") return hoverNode.id;
        return hoverNode.parentId ?? null;
    }
    if (dragAction.visual.kind == "box") {
        const boxContainerId = dragAction.visual.containerId;
        const boxTarget = flattenedTree.find((node) => node.id == boxContainerId);
        return boxTarget?.parentId ?? boxContainerId;
    }
    return dragAction.action.containerId;
};

const ensureTagSpaceLoaded = (superstate: Superstate, tagPath: string) => {
    if (superstate.spacesIndex.has(tagPath)) {
        return Promise.resolve(superstate.spacesIndex.get(tagPath));
    }
    return Promise.resolve(superstate.reloadSpace(superstate.spaceManager.spaceInfoForPath(tagPath), null, true));
};

export function showOpenMenuInRect(rect: DOMRect, document: Document, superstate: Superstate, saveActiveSpace: (path: string) => void, showHidden?: boolean) {
    showOpenMenu(
        rect,
        windowFromDocument(document),
        superstate,
        (link, isNewOption, type) => {
            const missingSpace = !superstate.spacesIndex.has(link);
            if (isNewOption && type == "tags") {
                const tagPath = tagSpacePathFromTag(ensureTag(link));
                Promise.resolve(addTag(superstate, link)).then(() => {
                    saveActiveSpace(tagPath);
                    superstate.ui.openPath(tagPath, false);
                });
                return;
            }
            if (isTagSpacePath(link)) {
                ensureTagSpaceLoaded(superstate, link).then(() => {
                    saveActiveSpace(link);
                });
                return;
            }
            if (isNewOption && type == "refs") {
                saveActiveSpace(link);
                return;
            }
            if (missingSpace) {
                createSpace(superstate, link, {}).then(() => {
                    saveActiveSpace(link);
                    superstate.ui.openPath(link, false);
                });
                return;
            }
            saveActiveSpace(link);
        },
        showHidden,
    );
}

export const VirtualizedList = React.memo(function VirtualizedList(props: {
    flattenedTree: TreeNode[];
    rowHeights: number[];
    dragAction: DragActionModel | null;
    handleCollapse: any;
    superstate: Superstate;
    selectedPaths: TreeNode[];
    vRef: any;
    activePath: string;
    selectRange: any;
    indentationWidth: number;
    overIndex: number;
    activeIndex: number;
    enableObsidianDragGhost: boolean;
    pointerDnd?: boolean;
    dragStarted: (activeId: string, source: HTMLElement) => void;
    dragOver: (e: React.DragEvent<HTMLElement>, overId: string, position: Pos) => void;
    dragEnded: (e: React.DragEvent<HTMLElement>, overId: string) => void;
}) {
    const { flattenedTree, rowHeights, dragAction, vRef, selectedPaths: selectedPaths, activePath: activePath, selectRange, handleCollapse, superstate, overIndex, activeIndex, indentationWidth } = props;

    const parentRef = React.useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: flattenedTree.length,
        paddingEnd: 24,
        getScrollElement: () => parentRef.current,
        estimateSize: React.useCallback((index) => rowHeights[index], [rowHeights]),
        overscan: 0,
    });
    const previousRowHeights = React.useRef(rowHeights);
    React.useLayoutEffect(() => {
        const previous = previousRowHeights.current;
        rowHeights.forEach((height, index) => {
            if (previous[index] != height) rowVirtualizer.resizeItem(index, height);
        });
        previousRowHeights.current = rowHeights;
    }, [rowHeights, rowVirtualizer]);
    vRef.current = rowVirtualizer;
    const { saveActiveSpace, updateCurrentFocus } = useContext(NavigatorContext);
    const updateFocusSeparator = (rank: number, duplicate: boolean) => {
        updateCurrentFocus((focus) => {
            const paths = [...focus.paths];
            if (!isSpaceSeparatorPath(paths[rank])) return focus;
            if (duplicate) paths.splice(rank + 1, 0, paths[rank]);
            else paths.splice(rank, 1);
            return { ...focus, paths };
        });
    };
    const setFocusSeparatorVisible = (rank: number, visible: boolean) => {
        updateCurrentFocus((focus) => {
            if (!isSpaceSeparatorPath(focus.paths[rank])) return focus;
            const paths = [...focus.paths];
            paths[rank] = visible ? SPACE_SEPARATOR_PATH : SPACE_HIDDEN_SEPARATOR_PATH;
            return { ...focus, paths };
        });
    };
    const dropIndicatorVariant = (index: number): "line-top" | "line-bottom" | "box" | null => {
        if (dragAction?.visual.kind == "box" && flattenedTree[index]?.id == dragAction.visual.containerId) return "box";
        if (dragAction?.visual.kind == "line" && flattenedTree[index]?.id == dragAction.visual.itemId) return dragAction.visual.position == "after" ? "line-bottom" : "line-top";
        return null;
    };
    const draggedSourceSubtreeHighlighted = (index: number) => {
        if (activeIndex == -1 || index < activeIndex) return false;
        const activeNode = flattenedTree[activeIndex];
        const node = flattenedTree[index];
        if (!activeNode || !node) return false;
        if (activeNode.type != "space" && activeNode.type != "group") return false;
        if (activeNode.collapsed) return false;
        return node.id == activeNode.id || node.id.startsWith(`${activeNode.id}/`);
    };
    // Per-render lookups shared by every visible row instead of O(n) scans per row.
    const nodeIndexById = React.useMemo(() => new Map(flattenedTree.map((node, index) => [node.id, index] as const)), [flattenedTree]);
    const selectedIds = React.useMemo(() => new Set(selectedPaths.map((node) => node.id)), [selectedPaths]);
    const highlightContainerId = React.useMemo(
        () => (activeIndex == -1 && !dragAction ? null : (highlightContainerIdForDrag(flattenedTree, activeIndex, overIndex, dragAction) ?? null)),
        [flattenedTree, activeIndex, overIndex, dragAction],
    );
    const containerSubtreeHighlighted = (containerId: string | null, index: number) => {
        if (!containerId) return false;
        const containerIndex = nodeIndexById.get(containerId);
        const container = containerIndex == null ? undefined : flattenedTree[containerIndex];
        const node = flattenedTree[index];
        if (!container || !node) return false;
        if (container.type == "file" || container.collapsed) return false;
        return node.id == containerId || node.id.startsWith(`${containerId}/`);
    };
    const dragContextContainerHighlighted = (index: number) => {
        // External-file drags have no active row in the tree (activeIndex -1)
        // but do carry a dragAction; only bail when neither marks a live drag.
        if (activeIndex == -1 && !dragAction) return false;
        const activeNode = flattenedTree[activeIndex];
        if (!dragAction && overIndex == activeIndex && activeNode && (activeNode.type == "space" || activeNode.type == "group") && !activeNode.collapsed) return false;
        return containerSubtreeHighlighted(highlightContainerId, index);
    };
    const isDraggedActiveRow = (index: number) => activeIndex != -1 && index == activeIndex;
    const isHighlighted = (index: number) => draggedSourceSubtreeHighlighted(index) || dragContextContainerHighlighted(index);
    const isDimmed = (index: number) => {
        if (isDraggedActiveRow(index)) return true;
        if (activeIndex == -1 || index < activeIndex) return false;
        const activeNode = flattenedTree[activeIndex];
        const node = flattenedTree[index];
        if (!activeNode || !node) return false;
        if (activeNode.type != "space" && activeNode.type != "group") return false;
        if (activeNode.collapsed) return false;
        return node.id.startsWith(`${activeNode.id}/`);
    };
    const rowSpacing = (node: TreeNode) => node.type == "group" ? 0 : indentationWidth * (node.depth - 1) + (node.type == "space" ? 0 : 20);
    const rowOffsets = React.useMemo(() => {
        let offset = 0;
        return rowHeights.map((height) => {
            const start = offset;
            offset += height;
            return start;
        });
    }, [rowHeights]);
    const treeLines = React.useMemo(() => treeLinesForTree(flattenedTree, rowHeights, rowOffsets, rowSpacing), [flattenedTree, indentationWidth, rowHeights, rowOffsets]);
    const virtualItems = rowVirtualizer.getVirtualItems();
    const renderedLines = visibleTreeLines(treeLines, virtualItems[0]?.start ?? 0, virtualItems[virtualItems.length - 1]?.end ?? 0);
    return (
        <div
            ref={parentRef}
            style={
                {
                    width: `100%`,
                    height: `100%`,
                    overflow: "auto",
                } as React.CSSProperties
            }
        >
            <div
                style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                }}
            >
                <div className="mk-tree-lines-layer">
                    {renderedLines.map((line) => (
                        <div
                            key={line.id}
                            className="mk-tree-line"
                            style={
                                {
                                    "--vline-top": `${line.top}px`,
                                    "--vline-left": `${line.left}px`,
                                    "--vline-height": `${line.height}px`,
                                } as CSSProperties
                            }
                        ></div>
                    ))}
                </div>
                {virtualItems.map((virtualRow) => {
                    const node = flattenedTree[virtualRow.index];
                    const indicatorVariant = dropIndicatorVariant(virtualRow.index);
                    const separatorVisible = node.path != SPACE_HIDDEN_SEPARATOR_PATH;
                    return (
                        <div
                            key={node.id}
                            data-index={virtualRow.index}
                            className={`mk-tree-node${node.type == "separator" ? " mk-tree-node-separator" : ""}${indicatorVariant ? " mk-tree-node-indicator" : ""}`}
                            style={
                                {
                                    "--row-height": `${rowHeights[virtualRow.index]}px`,
                                    "--node-offset": `${virtualRow.start}px`,
                                } as CSSProperties
                            }
                        >
                            {node.type == "separator" ? (
                                <div
                                    className={`mk-tree-separator${isHighlighted(virtualRow.index) ? " is-highlighted" : ""}${indicatorVariant ? ` mk-tree-separator-indicator-${indicatorVariant}` : ""}`}
                                    style={{
                                        "--separator-spacing": `${node.depth == 0 ? 4 : 20 + indentationWidth * Math.max(0, node.depth - 1)}px`,
                                    } as CSSProperties}
                                    draggable={!props.pointerDnd}
                                    data-tree-id={node.id}
                                    data-space={node.space ?? "focus"}
                                    data-rank={node.rank}
                                    onClick={(e) => e.stopPropagation()}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const options: SelectOption[] = [
                                            {
                                                name: i18n.menu.visible,
                                                icon: "lucide//minus",
                                                type: SelectOptionType.Radio,
                                                value: separatorVisible,
                                                onClick: () => node.space
                                                    ? setSpaceSeparatorVisible(superstate, node.space, node.rank, !separatorVisible)
                                                    : setFocusSeparatorVisible(node.rank, !separatorVisible),
                                            },
                                            menuSeparator,
                                            {
                                                name: i18n.menu.duplicate,
                                                icon: "ui//documents",
                                                onClick: () => node.space ? moveSpaceSeparator(superstate, node.space, node.rank, node.space, node.rank + 1, true) : updateFocusSeparator(node.rank, true),
                                            },
                                            menuSeparator,
                                            {
                                                name: i18n.menu.delete,
                                                icon: "ui//trash",
                                                onClick: () => node.space ? removeSpaceSeparator(superstate, node.space, node.rank) : updateFocusSeparator(node.rank, false),
                                            },
                                        ];
                                        superstate.ui.openMenu((e.target as HTMLElement).getBoundingClientRect(), defaultMenu(superstate.ui, options), windowFromDocument(e.view.document));
                                    }}
                                    onDragStart={(e) => {
                                        const ownerDocument = e.currentTarget.ownerDocument;
                                        let cleanedUp = false;
                                        const cleanupGhost = (event: DragEvent) => {
                                            if (cleanedUp) return;
                                            cleanedUp = true;
                                            ownerDocument.removeEventListener("drop", cleanupGhost, true);
                                            ownerDocument.removeEventListener("dragend", cleanupGhost, true);
                                            superstate.ui.dragEnded(event as any);
                                        };
                                        ownerDocument.addEventListener("drop", cleanupGhost, true);
                                        ownerDocument.addEventListener("dragend", cleanupGhost, true);
                                        superstate.ui.dragStarted(e, [SPACE_SEPARATOR_PATH]);
                                        props.dragStarted(node.id, e.currentTarget);
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        props.dragOver(e, node.id, { x: e.clientX - rect.left, y: e.clientY - rect.top });
                                    }}
                                    onDrop={(e) => {
                                        e.stopPropagation();
                                        props.dragEnded(e, node.id);
                                    }}
                                >
                                    {separatorVisible && <div className="mk-tree-separator-line"></div>}
                                </div>
                            ) : node.type == "new" ? (
                                <div
                                    className={"mk-tree-wrapper mk-tree-section"}
                                    data-tree-id={node.id}
                                    onClick={(e) => {
                                        const rect = (e.target as HTMLElement).getBoundingClientRect();
                                        showOpenMenuInRect(rect, e.view.document, props.superstate, saveActiveSpace, e.shiftKey);
                                    }}
                                >
                                    <div className={`mk-tree-item tree-item-self nav-folder-title mk-tree-new${indicatorVariant ? " mk-indicator-row" : ""}`}>
                                        <div
                                            className={`mk-path-icon mk-path-icon-placeholder`}
                                            dangerouslySetInnerHTML={{
                                                __html: props.superstate.ui.getSticker("ui//plus"),
                                            }}
                                        ></div>
                                        <div className="mk-tree-text nav-folder-title-content">{i18n.menu.openSpace}</div>
                                    </div>
                                </div>
                            ) : (
                                <TreeItem
                                    key={node.id}
                                    id={node.id}
                                    data={node}
                                    disabled={false}
                                    depth={node.depth}
                                    indentationWidth={indentationWidth}
                                    enableObsidianDragGhost={props.enableObsidianDragGhost}
                                    pointerDnd={props.pointerDnd}
                                    dragStarted={props.dragStarted}
                                    dragOver={props.dragOver}
                                    dragEnded={props.dragEnded}
                                    dragActive={activeIndex != -1}
                                    indicator={indicatorVariant != null}
                                    indicatorVariant={indicatorVariant ?? "line-top"}
                                    indicatorDepth={dragAction?.visual.kind == "line" ? (dragAction.visual.depth ?? null) : null}
                                    superstate={superstate}
                                    style={EMPTY_ROW_STYLE}
                                    onSelectRange={selectRange}
                                    active={activePath == node.item?.path}
                                    highlighted={isHighlighted(virtualRow.index)}
                                    dimmed={isDimmed(virtualRow.index)}
                                    selected={selectedIds.has(node.id)}
                                    collapsed={node.collapsed}
                                    onCollapse={handleCollapse}
                                ></TreeItem>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
