import classNames from "classnames";
import { Pos } from "shared/types/Pos";

import { showPathContextMenu, triggerMultiPathMenu } from "core/react/components/UI/Menus/navigator/pathContextMenu";

import { NavigatorContext } from "core/react/context/SidebarContext";
import { TreeNode, spaceRowHeight } from "core/superstate/utils/spaces";
import { Superstate } from "makemd-core";
import React, { CSSProperties, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { PathStickerView } from "shared/components/PathSticker";
import { PathState } from "shared/types/PathState";
import { windowFromDocument } from "shared/utils/dom";
import { CollapseToggle } from "../../UI/Toggles/CollapseToggle";
import { shouldShowFileTag } from "./fileTags";
import { canOpenTreeItemPath, isTagTreeItemPath } from "./treeItemPath";
import { treeItemActiveColorVariables, treeItemColorVariables } from "./treeItemStyles";
export type DropModifiers = "copy" | "link" | "move";
type TreeItemStyle = React.CSSProperties & Record<string, string>;

export const eventToModifier = (e: React.DragEvent, isDefaultSpace?: boolean) => (e.altKey ? "copy" : e.shiftKey || isDefaultSpace ? "link" : "move");
export interface TreeItemProps {
    id: string;
    disabled: boolean;
    childCount?: number;
    clone?: boolean;
    collapsed?: boolean;
    depth: number;
    ghost: boolean;
    active: boolean;
    selected: boolean;
    highlighted: boolean;
    onSelectRange?(id: string): void;
    indicator: boolean;
    indentationWidth: number;
    data: TreeNode;
    superstate: Superstate;
    style: CSSProperties;
    onCollapse?(node: TreeNode, open: boolean): void;
    dragStarted: (activeId: string) => void;
    dragOver: (e: React.DragEvent<HTMLElement>, overId: string, position: Pos) => void;
    dragEnded: (e: React.DragEvent<HTMLDivElement>, overId: string) => void;
    dragActive: boolean;
}

export const TreeItem = (props: TreeItemProps) => {
    const { id: _id, childCount, clone, data, depth, dragActive, ghost, active, indentationWidth, indicator, collapsed, selected, highlighted, onCollapse, onSelectRange, style, superstate, disabled: _disabled, dragStarted, dragOver, dragEnded } = props;
    const { setActivePath: setActivePath, selectedPaths: selectedPaths, setSelectedPaths: setSelectedPaths, setDragPaths, closeActiveSpace } = useContext(NavigatorContext);
    const [hoverTarget, setHoverTarget] = useState<EventTarget>(null);

    const innerRef = useRef(null);
    const [dropHighlighted, setDropHighlighted] = useState(false);
    const [pathState, setPathState] = useState<PathState>(superstate.pathsIndex.get(data.item.path));

    useEffect(() => setPathState(superstate.pathsIndex.get(data.item.path)), [data.item.path]);
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
        const isTagSpace = isTagTreeItemPath(path.item);
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
            setDragPaths(selectedPaths.map((f) => f.path));
            superstate.ui.dragStarted(
                e,
                selectedPaths.map((f) => f.path),
            );

            return;
        }
        dragStarted(data.id);
        setDragPaths([data.path]);
        superstate.ui.dragStarted(e, [data.path]);
    };
    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!innerRef.current) return;
        const rect = innerRef.current.getBoundingClientRect();

        const x = e.clientX - rect.left; //x position within the element.
        const y = e.clientY - rect.top; //y position within the element.

        dragOver(e, data.id, { x, y });
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
        onDragLeave: () => setDropHighlighted(false),
        onDropAccepted: () => setDropHighlighted(false),
        onDropRejected: () => setDropHighlighted(false),
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
    const color = pathState?.label?.color;
    const contextMenu = (e: React.MouseEvent) => {
        if (superstate.settings.overrideNativeMenu) {
            return superstate.ui.nativePathMenu(e, pathState.path);
        }

        showPathContextMenu(superstate, data.path, data.type == "group" ? null : data.space, (e.target as HTMLElement).getBoundingClientRect(), windowFromDocument(e.view.document), "right", data.type == "group" ? () => closeActiveSpace(data.path) : null);
    };
    const pathStateUpdated = (payload: { path: string }) => {
        if (payload.path == pathState?.path) {
            const _pathState = superstate.pathsIndex.get(pathState.path);
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
    const isFolder = pathState?.metadata?.isFolder || isSpace;
    const extension = pathState?.metadata?.file?.extension;
    const showFileTag = shouldShowFileTag(isSpace, extension);
    const spacing = data.type == "group" ? 0 : indentationWidth * (depth - 1) + (data.type == "space" ? 0 : 20);
    return (
        <>
            <div
                className={classNames("mk-tree-wrapper", data.type == "group" ? "mk-tree-section" : "", clone && "mk-clone", ghost && "mk-ghost", highlighted ? "is-highlighted" : "")}
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
                        )}
                        style={
                            {
                                "--spacing": `${spacing}px`,
                                "--childrenCount": `${data.type == "space" && !collapsed ? childCount * spaceRowHeight(superstate, superstate.settings.spaceRowHeight, false) - 13 : 0}px`,
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
                        {pathState && <PathStickerView superstate={superstate} pathState={pathState} editable={data.type == "space" || (data.type == "group" && data.path != "/")} />}
                        <div className={`mk-tree-text ${isFolder ? "nav-folder-title-content" : "nav-file-title-content"}`}>{pathState?.name ?? data.path}</div>

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
                        {showFileTag && <span className="nav-file-tag">{extension}</span>}
                    </div>
                </div>
            </div>
        </>
    );
};
TreeItem.displayName = "TreeItem";
