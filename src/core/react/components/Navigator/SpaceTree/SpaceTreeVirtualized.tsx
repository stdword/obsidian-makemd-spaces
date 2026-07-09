import { useVirtualizer } from "@tanstack/react-virtual";
import { DragActionModel } from "core/utils/dnd/dragPath";
import { Pos } from "shared/types/Pos";

import { NavigatorContext } from "core/react/context/SidebarContext";
import { createSpace, TreeNode } from "core/utils/superstate/spaces";
import { addTag } from "core/utils/superstate/tags";
import { tagSpacePathFromTag } from "schemas/builtin";
import { Superstate } from "makemd-core";
import i18n from "shared/i18n";
import React, { CSSProperties, useContext } from "react";
import { windowFromDocument } from "utils/dom";
import { showOpenMenu } from "../../UI/Menus/modals/selectSpaceMenu";
import { TreeItem } from "./SpaceTreeItem";
import { ensureTag } from "utils/tags";
import { isTagSpacePath } from "schemas/builtin";


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
    dragStarted: (activeId: string) => void;
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
    vRef.current = rowVirtualizer;
    const { saveActiveSpace } = useContext(NavigatorContext);
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
    const containerSubtreeHighlighted = (containerId: string | null, index: number) => {
        if (!containerId) return false;
        const container = flattenedTree.find((node) => node.id == containerId);
        const node = flattenedTree[index];
        if (!container || !node) return false;
        if (container.type == "file" || container.collapsed) return false;
        return node.id == containerId || node.id.startsWith(`${containerId}/`);
    };
    const highlightContainerId = () => {
        const activeContainerId = flattenedTree[activeIndex]?.parentId;
        if (!dragAction) {
            const hoverNode = overIndex == -1 ? null : flattenedTree[overIndex];
            if (!hoverNode || overIndex == activeIndex) return activeContainerId;
            if (hoverNode.id == activeContainerId) return activeContainerId;
            return hoverNode.parentId ?? activeContainerId;
        }
        if (dragAction.visual.kind == "box") {
            const boxContainerId = dragAction.visual.containerId;
            return flattenedTree.find((node) => node.id == boxContainerId)?.parentId ?? activeContainerId;
        }
        return dragAction.action.containerId;
    };
    const dragContextContainerHighlighted = (index: number) => {
        if (activeIndex == -1) return false;
        const activeNode = flattenedTree[activeIndex];
        if (!dragAction && overIndex == activeIndex && activeNode && activeNode.type != "file") return false;
        return containerSubtreeHighlighted(highlightContainerId() ?? null, index);
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
    const treeLines = React.useMemo(() => {
        return flattenedTree.flatMap((node, index) => {
            if (!node || node.depth == 0 || !["group", "space"].includes(node.type) || node.collapsed) return [];

            let firstDirectChildIndex = -1;
            let lastDirectChildIndex = -1;
            for (let i = index + 1; i < flattenedTree.length; i++) {
                const descendant = flattenedTree[i];
                if (descendant.depth <= node.depth) break;
                if (descendant.depth == node.depth + 1) {
                    if (firstDirectChildIndex == -1) {
                        firstDirectChildIndex = i;
                    }
                    lastDirectChildIndex = i;
                }
            }

            if (firstDirectChildIndex == -1 || lastDirectChildIndex == -1) return [];

            let lastVisibleBranchIndex = lastDirectChildIndex;
            for (let i = lastDirectChildIndex + 1; i < flattenedTree.length; i++) {
                const descendant = flattenedTree[i];
                if (descendant.depth <= node.depth) break;
                lastVisibleBranchIndex = i;
            }

            const top = (rowOffsets[index] ?? 0) + (rowHeights[index] ?? 0);
            const bottom = (rowOffsets[lastVisibleBranchIndex] ?? 0) + (rowHeights[lastVisibleBranchIndex] ?? 0);
            const height = bottom - top - 4;
            if (height <= 0) return [];

            return [{
                id: node.id,
                left: 6 + rowSpacing(node) + 10 - 1,
                top,
                height,
            }];
        });
    }, [flattenedTree, indentationWidth, rowHeights, rowOffsets]);
    const pinnedSeparators = React.useMemo(() => {
        return flattenedTree.flatMap((node, index) => {
            if (!node?.pinned) return [];

            let lastVisibleIndex = index;
            for (let i = index + 1; i < flattenedTree.length; i++) {
                const descendant = flattenedTree[i];
                if (descendant.depth <= node.depth) break;
                lastVisibleIndex = i;
            }

            const nextSibling = flattenedTree[lastVisibleIndex + 1];
            if (nextSibling?.parentId == node.parentId && nextSibling?.pinned) return [];

            const left = 6 + indentationWidth * (node.depth - 1);
            const top = (rowOffsets[lastVisibleIndex] ?? 0) + (rowHeights[lastVisibleIndex] ?? 0) - 1;
            return [{
                id: `${node.id}-pinned-separator`,
                left,
                top,
            }];
        });
    }, [flattenedTree, rowHeights, rowOffsets]);
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
                    {treeLines.map((line) => (
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
                    {superstate.settings.pinnedSeparatorLine && pinnedSeparators.map((separator) => (
                        <div
                            key={separator.id}
                            className="mk-tree-pinned-separator"
                            style={
                                {
                                    "--pinned-line-top": `${separator.top}px`,
                                    "--pinned-line-left": `${separator.left}px`,
                                } as CSSProperties
                            }
                        ></div>
                    ))}
                </div>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const node = flattenedTree[virtualRow.index];
                    const indicatorVariant = dropIndicatorVariant(virtualRow.index);
                    return (
                        <div
                            key={node.id}
                            data-index={virtualRow.index}
                            className={`mk-tree-node${indicatorVariant ? " mk-tree-node-indicator" : ""}`}
                            style={
                                {
                                    "--row-height": `${rowHeights[virtualRow.index]}px`,
                                    "--node-offset": `${virtualRow.start}px`,
                                } as CSSProperties
                            }
                        >
                            {node.type == "new" ? (
                                <div
                                    className={"mk-tree-wrapper mk-tree-section"}
                                    onClick={(e) => {
                                        const rect = (e.target as HTMLElement).getBoundingClientRect();
                                        showOpenMenuInRect(rect, e.view.document, props.superstate, saveActiveSpace, e.shiftKey);
                                    }}
                                >
                                    <div className="mk-tree-item tree-item-self nav-folder-title mk-tree-new">
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
                                    dragStarted={props.dragStarted}
                                    dragOver={props.dragOver}
                                    dragEnded={props.dragEnded}
                                    dragActive={activeIndex != -1}
                                    indicator={indicatorVariant != null}
                                    indicatorVariant={indicatorVariant ?? "line-top"}
                                    superstate={superstate}
                                    style={{}}
                                    onSelectRange={selectRange}
                                    active={activePath == node.item?.path}
                                    highlighted={isHighlighted(virtualRow.index)}
                                    dimmed={isDimmed(virtualRow.index)}
                                    selected={(selectedPaths as TreeNode[]).some((g) => g.id == node.id)}
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
