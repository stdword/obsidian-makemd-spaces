import classNames from "classnames";
import React, { CSSProperties, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";

import { showPathContextMenu, triggerMultiPathMenu } from "core/react/components/UI/Menus/navigator/pathContextMenu";
import { NavigatorContext } from "core/react/context/SidebarContext";
import { PathStickerView } from "core/react/components/PathSticker";
import { Superstate } from "makemd-core";
import { Pos } from "shared/types/Pos";
import { PathState } from "shared/types/PathState";
import { TreeNode, spaceSortLabel } from "core/utils/superstate/spaces";
import { windowFromDocument } from "utils/dom";
import { canOpenTreeItemPath, isTagTreeItemPath, isTagSpacePath } from "schemas/builtin";
import { CollapseToggle } from "../../UI/Toggles/CollapseToggle";
import { treeItemActiveColorVariables, treeItemColorVariables, treeItemDisplayColor, treeItemDisplayName } from "./treeItemStyles";

export type DropModifiers = "copy" | "link" | "move";
type TreeItemStyle = React.CSSProperties & Record<string, string>;

export const shouldShowFileTag = (isSpace: boolean, extension?: string) => {
    const registeredFileTagExtensions = ["md", "base", "canvas", "excalidraw"];
    return !!extension && !isSpace && !registeredFileTagExtensions.includes(extension)
};

export const shouldShowLinkedItemIcon = (data: TreeNode) => {
    if (data.depth <= 0 || isTagSpacePath(data.space)) return false;
    if (isTagTreeItemPath(data.item) && data.item?.path != data.space) return true;
    if (data.item?.linkedSpaces?.includes(data.space)) return true;
    return false
}

export const shouldShowPinnedItemIcon = (data: TreeNode) => {
    if (data.depth == 0) return false;
    return data.item?.pinnedSpaces?.includes(data.space);
}

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
    indentationWidth: number;
    data: TreeNode;
    superstate: Superstate;
    style: CSSProperties;
    onCollapse?(node: TreeNode, open: boolean): void;
    enableObsidianDragGhost: boolean;
    dragStarted: (activeId: string) => void;
    dragOver: (e: React.DragEvent<HTMLElement>, overId: string, position: Pos) => void;
    dragEnded: (e: React.DragEvent<HTMLDivElement>, overId: string) => void;
    dragActive: boolean;
}

export const TreeItem = (props: TreeItemProps) => {
    const { id: _id, data, depth, dragActive, active, indentationWidth, indicator, indicatorVariant = "line-top", collapsed, selected, highlighted, dimmed, onCollapse, onSelectRange, style, superstate, disabled: _disabled, enableObsidianDragGhost, dragStarted, dragOver, dragEnded } = props;
    const { setActivePath: setActivePath, selectedPaths: selectedPaths, setSelectedPaths: setSelectedPaths, setDragPaths, closeActiveSpace } = useContext(NavigatorContext);
    const [hoverTarget, setHoverTarget] = useState<EventTarget>(null);

    const innerRef = useRef(null);
    const [dropHighlighted, setDropHighlighted] = useState(false);
    const [pathState, setPathState] = useState<PathState>(superstate.pathStateForPath(data.item.path) ?? data.item);

    useEffect(() => setPathState(superstate.pathStateForPath(data.item.path) ?? data.item), [data.item]);
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
            setSelectedPaths((s) => [...s.filter((f) => f.id != path.id), path]);
            return;
        }
        if (isTagSpace) {
            onCollapse?.(data, Boolean(collapsed));
        } else if (isFolder) {
            if (superstate.settings.expandFolderOnClick) {
                if (collapsed) {
                    onCollapse(data, true);
                } else if (selected) {
                    // Only collapse if already selected, so first click selects, second click collapses
                    onCollapse(data, false);
                }
            }
        }
        if (canOpenTreeItemPath(path.item)) {
            superstate.ui.openPath(path.item.path, e.ctrlKey || e.metaKey || e.button == 1 ? (e.altKey ? "split" : "tab") : false);
        }
        setActivePath(path.item.path);
        setSelectedPaths([path]);
    };

    const onDragStarted = (e: React.DragEvent<HTMLDivElement>) => {
        if (selectedPaths.length > 1) {
            const paths = selectedPaths.map((f) => f.path);
            setDragPaths(paths);
            if (enableObsidianDragGhost) {
                superstate.ui.dragStarted(e, paths);
            }
            dragStarted(data.id);

            return;
        }
        setDragPaths([data.path]);
        if (enableObsidianDragGhost) {
            superstate.ui.dragStarted(e, [data.path]);
        }
        dragStarted(data.id);
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
    const onKeyDown = (e: KeyboardEvent | React.KeyboardEvent) => {
        if (e.key === "Control" || e.key === "Meta") {
            if (e.repeat) return;
            const el = hoverTarget;
            if (el && canOpenTreeItemPath(pathState)) superstate.ui.openPath(pathState.path, "hover", el);
        }
    };
    const onDrop = useCallback((files: File[]) => {
        if (isFolder) {
            // Do something with the files
            files.map(async (file) => {
                file.arrayBuffer().then((arrayBuffer) => {
                    superstate.spaceManager.writeToPath(pathState.path + "/" + file.name, arrayBuffer, true);
                });
            });
        }
    }, []);
    const onDragEnter = useCallback(() => {
        if (isFolder) setDropHighlighted(true);
    }, []);

    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        onDragEnter,
        onDragLeave: () => {
            setDropHighlighted(false);
        },
        onDropAccepted: () => {
            setDropHighlighted(false);
        },
        onDropRejected: () => {
            setDropHighlighted(false);
        },
        noClick: true,
    });
    const onDragEnded = (e: React.DragEvent<HTMLDivElement>) => {
        e.stopPropagation();
        dragEnded(e, data.id);
    };
    const mouseOut = (_e: React.MouseEvent) => {
        setHoverTarget(null);
    };
    const handleRightClick = (e: React.MouseEvent) => {
        selectedPaths.length > 1 && selectedPaths.some((f) => f.id == (data.id as string)) ? triggerMultiPathMenu(superstate, selectedPaths, e) : contextMenu(e);
    };
    const color = treeItemDisplayColor(pathState, pathState?.type == "space" ? superstate.spacesIndex.get(pathState.path)?.metadata?.defaultColor : "");
    const contextMenu = (e: React.MouseEvent) => {
        if (superstate.settings.overrideNativeMenu) {
            return superstate.ui.nativePathMenu(e, pathState.path);
        }

        showPathContextMenu(superstate, data.path, data.type == "group" ? null : data.space, (e.target as HTMLElement).getBoundingClientRect(), windowFromDocument(e.view.document), "right", data.type == "group" ? () => closeActiveSpace(data.path) : null, data.depth);
    };
    const pathStateUpdated = (payload: { path: string }) => {
        if (payload.path == pathState?.path) {
            const _pathState = superstate.pathStateForPath(pathState.path);
            if (_pathState) setPathState(_pathState);
        }
    };
    useEffect(() => {
        superstate.eventsDispatcher.addListener("pathStateUpdated", pathStateUpdated);
        return () => {
            superstate.eventsDispatcher.removeListener("pathStateUpdated", pathStateUpdated);
        };
    }, []);
    const hoverItem = (e: React.MouseEvent) => {
        setHoverTarget(e.target);
        if ((e.ctrlKey || e.metaKey) && canOpenTreeItemPath(pathState)) {
            superstate.ui.openPath(pathState.path, "hover", e.target);
        }
    };
    useEffect(() => {
        if (hoverTarget) {
            window.addEventListener("keydown", onKeyDown);
            return () => {
                window.removeEventListener("keydown", onKeyDown);
            };
        }
    }, [hoverTarget]);
    const dropProps = {
        onDragOver: onDragOver,
    };
    const innerProps = {
        draggable: true,
        onDragStart: onDragStarted,
        onDrop: onDragEnded,
    };
    const isSpace = pathState?.type == "space";
    const isFolder = isSpace;
    const extension = pathState?.subtype;
    const isTagSpace = isTagTreeItemPath(pathState ?? data.item);

    const displayName = treeItemDisplayName(pathState, data, superstate.spacesIndex);
    const stickerLabel = data.sort && pathState?.type == "space" ? `${displayName}\n${spaceSortLabel(data.sort, isTagSpace)}` : displayName;

    const spacing = data.type == "group" ? 0 : indentationWidth * (depth - 1) + (data.type == "space" ? 0 : 20);

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
                style={treeItemColorVariables(color, isFolder) as TreeItemStyle}
                ref={innerRef}
                onMouseLeave={mouseOut}
                onMouseEnter={hoverItem}
                onKeyDown={onKeyDown}
                onAuxClick={openAuxClick}
                onClick={(e) => openPathAtTarget(data, e)}
                onContextMenu={(e) => handleRightClick(e)}
                {...dropProps}
                {...innerProps}
            >
                <div
                    className={classNames(isFolder ? "nav-folder" : "nav-file")}
                    style={{
                        ...style,
                        ...(dragActive ? { pointerEvents: "none" } : {}),
                    }}
                    {...getRootProps({ className: "dropzone" })}
                >
                    <input {...getInputProps()} />
                    <div
                        className={classNames(
                            "mk-tree-item",
                            "tree-item-self",
                            isFolder ? "nav-folder-title" : "nav-file-title",
                            active ? "is-active" : "",
                            selected ? "is-selected" : "",

                            indicator || dropHighlighted ? "mk-indicator-row" : "",
                            indicator && indicatorVariant == "line-bottom" ? "mk-indicator-row-bottom" : "",
                            indicator && indicatorVariant == "box" ? "mk-indicator-row-box" : "",
                        )}
                        style={
                            {
                                "--spacing": `${spacing}px`,
                                ...treeItemActiveColorVariables(color, isFolder),
                            } as TreeItemStyle
                        }
                        data-path={pathState?.path}
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
                                color={color}
                                ariaLabel={stickerLabel}
                            />
                        )}
                        <div className={`mk-tree-text ${isFolder ? "nav-folder-title-content" : "nav-file-title-content"}`}>{displayName}</div>

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
                        {shouldShowFileTag(isSpace, extension) &&
                            <span className="nav-file-tag">{extension}</span>
                        }
                        {shouldShowLinkedItemIcon(data) && (
                            <div className="mk-linked-item-icon">
                                <PathStickerView
                                    superstate={superstate}
                                    pathState={{
                                        name: "linked",
                                        path: "",
                                        sticker: "lucide//link-2",
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
TreeItem.displayName = "TreeItem";
