import { UniqueIdentifier } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Pos } from "shared/types/Pos";

import { NavigatorContext } from "core/react/context/SidebarContext";
import { createSpace, TreeNode } from "core/superstate/utils/spaces";
import { addTag } from "core/superstate/utils/tags";
import { DragProjection } from "core/utils/dnd/dragPath";
import { tagSpacePathFromTag } from "core/utils/strings";
import { Superstate } from "makemd-core";
import i18n from "shared/i18n";
import React, { CSSProperties, useContext } from "react";
import { windowFromDocument } from "shared/utils/dom";
import { showOpenMenu } from "../../UI/Menus/modals/selectSpaceMenu";
import { TreeItem } from "./SpaceTreeItem";
import { ensureTag } from "utils/tags";
import { isTagSpacePath } from "shared/schemas/builtin";


const ensureTagSpaceLoaded = (superstate: Superstate, tagPath: string) => {
    if (superstate.spacesIndex.has(tagPath)) {
        return Promise.resolve(superstate.spacesIndex.get(tagPath));
    }
    return Promise.resolve(superstate.reloadSpace(superstate.spaceManager.spaceInfoForPath(tagPath), null, true));
};

export function showOpenMenuInRect(rect: DOMRect, document: Document, superstate: Superstate, saveActiveSpace: (path: string) => void) {
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
    );
}

export const VirtualizedList = React.memo(function VirtualizedList(props: {
    flattenedTree: TreeNode[];
    rowHeights: number[];
    projected: DragProjection;
    handleCollapse: any;
    superstate: Superstate;
    selectedPaths: TreeNode[];
    vRef: any;
    activePath: string;
    selectRange: any;
    indentationWidth: number;
    overIndex: number;
    activeIndex: number;
    dragStarted: (activeId: UniqueIdentifier) => void;
    dragOver: (e: React.DragEvent<HTMLElement>, overId: UniqueIdentifier, position: Pos) => void;
    dragEnded: (e: React.DragEvent<HTMLElement>, overId: UniqueIdentifier) => void;
}) {
    const { flattenedTree, rowHeights, projected, vRef, selectedPaths: selectedPaths, activePath: activePath, selectRange, handleCollapse, superstate, overIndex, activeIndex, indentationWidth } = props;

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
    const dropIndicator = (index: number) => {
        return overIndex == index && projected && projected.insert;
    };
    const highlighted = (index: number) => {
        if (!projected || !flattenedTree[index] || !projected?.droppable) return false;
        return (!projected.sortable && !projected.insert && flattenedTree[index].parentId && flattenedTree[index].parentId.startsWith(projected.parentId)) || flattenedTree[index].id == projected.parentId;
    };
    const heightBetweenIndex = (start: number, end: number) => {
        if (start > end) return rowHeights.slice(end, start).reduce((p, c) => p + c, 0);
        return -rowHeights.slice(start, end).reduce((p, c) => p + c, 0);
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
    const calcYOffset = (index: number) => {
        if (!projected) return 0;
        if (projected.insert) {
            if (projected.copy && !projected.reorder) return 0;
            if (index > activeIndex) {
                return -rowHeights[index];
            } else if (index == activeIndex) {
                return heightBetweenIndex(overIndex, activeIndex);
            } else {
                return 0;
            }
        } else if (projected.sortable) {
            const targetIndex = overIndex < activeIndex ? overIndex : overIndex;
            if (projected.copy && !projected.reorder) {
                if (index == activeIndex) {
                    return heightBetweenIndex(targetIndex, activeIndex);
                } else if (index >= targetIndex) {
                    return rowHeights[index];
                } else {
                    return 0;
                }
            }

            if (index == activeIndex) {
                return heightBetweenIndex(targetIndex, activeIndex);
            } else if (index > activeIndex && index <= targetIndex) {
                return -rowHeights[index];
            } else if (index < activeIndex && index >= targetIndex) {
                return rowHeights[index];
            } else {
                return 0;
            }
        }
    };

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
                    {pinnedSeparators.map((separator) => (
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
                {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                    <div
                        key={flattenedTree[virtualRow.index].id}
                        data-index={virtualRow.index}
                        className="mk-tree-node"
                        style={
                            {
                                "--row-height": `${rowHeights[virtualRow.index]}px`,
                                "--node-offset": `${virtualRow.start}px`,
                            } as CSSProperties
                        }
                    >
                        {flattenedTree[virtualRow.index].type == "new" ? (
                            <div
                                className={"mk-tree-wrapper mk-tree-section"}
                                onClick={(e) => {
                                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                                    showOpenMenuInRect(rect, e.view.document, props.superstate, saveActiveSpace);
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
                                key={flattenedTree[virtualRow.index].id}
                                id={flattenedTree[virtualRow.index].id}
                                data={flattenedTree[virtualRow.index]}
                                disabled={false}
                                depth={flattenedTree[virtualRow.index].depth}
                                indentationWidth={indentationWidth}
                                dragStarted={props.dragStarted}
                                dragOver={props.dragOver}
                                dragEnded={props.dragEnded}
                                dragActive={activeIndex != -1}
                                indicator={dropIndicator(virtualRow.index)}
                                superstate={superstate}
                                ghost={
                                    overIndex != -1 && activeIndex == virtualRow.index
                                    // (overIndex == virtualRow.index && !projected?.droppable)
                                }
                                style={{
                                    opacity: projected && projected.insert && !projected.copy && virtualRow.index == activeIndex ? 0 : 1,
                                    transform: CSS.Translate.toString({
                                        x: projected && projected.sortable && virtualRow.index == activeIndex && projected ? (projected.depth - flattenedTree[virtualRow.index].depth) * indentationWidth : 0,
                                        y: calcYOffset(virtualRow.index),
                                        scaleX: 0,
                                        scaleY: 0,
                                    }),
                                }}
                                onSelectRange={selectRange}
                                active={activePath == flattenedTree[virtualRow.index].item?.path}
                                highlighted={highlighted(virtualRow.index)}
                                selected={(selectedPaths as TreeNode[]).some((g) => g.id == flattenedTree[virtualRow.index].id)}
                                collapsed={flattenedTree[virtualRow.index].collapsed}
                                onCollapse={handleCollapse}
                            ></TreeItem>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
});
