import { NavigatorContext } from "core/react/context/SidebarContext";
import { DragProjection } from "core/utils/dnd/dragPath";
import { addPathsToFocus } from "core/utils/superstate/focus";
import { Superstate } from "makemd-core";
import React, { useContext, useEffect, useState, useRef } from "react";
import { arrayMove } from "utils/array";
import { SortablePinnedSpaceItem } from "./Focus";

export const FocusSelector = (props: { superstate: Superstate }) => {
    const { focuses: focuses, modifier, setModifier, setFocuses: setFocuses } = useContext(NavigatorContext);

    const { dragPaths, setDragPaths } = useContext(NavigatorContext);
    const [activeId, setActiveId] = useState(null);
    const [overId, setOverId] = useState(null);
    const dragCounter = useRef(0);
    const menuRef = useRef<HTMLDivElement>();
    const [offset, setOffset] = useState(0);
    const [projected, setProjected] = useState<DragProjection>(null);
    useEffect(() => {
        if (overId === null || dragPaths.length == 0) {
            setProjected(null);
            return;
        }
        const focus = focuses.find((_f, i) => i == overId);
        if (!focus) return;
        const _projected: DragProjection = {
            depth: 0,
            overId: overId,
            parentId: null,
            sortable: false,
            insert: true,
            droppable: true,
            copy: false,
            reorder: false,
        };
        setProjected(_projected);
        return;
    }, [overId, dragPaths, offset, modifier, focuses, activeId]);
    const resetState = () => {
        setModifier(null);
        setOverId(null);
        setDragPaths([]);
        setActiveId(null);
        setProjected(null);
        setOffset(0);
        dragCounter.current = 0;
    };
    const dragEnter = () => {
        dragCounter.current++;
    };
    const dragLeave = () => {
        dragCounter.current--;
        if (dragCounter.current == 0) {
            setOverId(null);
            setProjected(null);
            setOffset(0);
            dragCounter.current = 0;
        }
    };
    const dragStarted = (id: number) => {
        setActiveId(id);
    };
    const dragOver = (id: number, x: number) => {
        setOffset(x);
        if (activeId == null) {
            setOverId(id);
        } else {
            if (id == activeId) return;
            setFocuses(arrayMove(focuses, activeId, id));
            setActiveId(id);
        }
    };
    // Native (cmd-drag) drop of paths onto a focus tab. Reordering focus tabs is already
    // applied live in dragOver, and pointer drags from the tree are completed by the tree.
    const dragEnded = () => {
        if (overId != null && activeId === null && dragPaths.length > 0) {
            setFocuses(addPathsToFocus(focuses, overId, dragPaths));
        }
        resetState();
    };

    useEffect(() => {
        window.addEventListener("dragend", resetState);
        return () => {
            window.removeEventListener("dragend", resetState);
        };
    });
    const width = 32;
    const calcXOffset = (index: number) => {
        if (!projected || projected.insert) return 0;
        const fromIndex = activeId;
        const targetIndex = overId;
        if (activeId === null) {
            if (index >= targetIndex) return width;
            return 0;
        }

        if (index == fromIndex) {
            return width * (targetIndex - fromIndex);
        } else if (index > fromIndex && index <= targetIndex) {
            return -width;
        } else if (index < fromIndex && index >= targetIndex) {
            return width;
        } else {
            return 0;
        }
    };
    return (
        <>
            <div className="mk-focuses" onDragEnter={() => dragEnter()} onDragLeave={() => dragLeave()} onDragOver={(e) => e.preventDefault()}>
                <div className="mk-focuses-inner">
                    {focuses.map((pin, i) =>
                        pin.archived ? null : (
                        <SortablePinnedSpaceItem
                            id={i}
                            superstate={props.superstate}
                            highlighted={overId == i && projected && projected.insert && projected.droppable}
                            style={{ transform: `translate3d(${calcXOffset(i)}px, 0, 0)` }}
                            index={i}
                            pin={pin}
                            key={i}
                            dragStart={dragStarted}
                            dragOver={dragOver}
                            dragEnded={dragEnded}
                            dragActive={activeId !== null}
                            ghost={activeId === i}
                        ></SortablePinnedSpaceItem>
                    ))}
                </div>
                <div
                    className="mk-focuses-menu"
                    ref={menuRef}
                    onClick={() => {
                        props.superstate.ui.mainMenu(menuRef.current, props.superstate);
                    }}
                    dangerouslySetInnerHTML={{
                        __html: props.superstate.ui.getSticker("lucide//more-vertical"),
                    }}
                ></div>
            </div>
        </>
    );
};
