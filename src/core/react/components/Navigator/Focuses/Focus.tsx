import { UniqueIdentifier } from "@dnd-kit/core";
import classNames from "classnames";
import { NavigatorContext } from "core/react/context/SidebarContext";
import { SelectOption, Superstate } from "makemd-core";
import i18n from "shared/i18n";
import React, { forwardRef, useContext, useRef } from "react";
import { Focus } from "shared/types/focus";
import { Rect } from "shared/types/Pos";
import { windowFromDocument } from "utils/dom";
import { ConfirmationModal } from "../../UI/Modals/ConfirmationModal";
import { defaultMenu } from "../../UI/Menus/menu/SelectionMenu";
import { eventToModifier } from "../SpaceTree/SpaceTreeItem";

export interface SortablePinnedSpaceItemProps extends PinnedSpaceProps {
    id: UniqueIdentifier;
}

export const SortablePinnedSpaceItem = ({ id: _id, index, ...props }: SortablePinnedSpaceItemProps) => {
    return <FocusItem index={index} {...props} />;
};

type PinnedSpaceProps = {
    superstate: Superstate;
    index: number;
    pin: Focus;
    clone?: boolean;
    ghost?: boolean;
    style?: React.CSSProperties;
    highlighted: boolean;
    indicator?: boolean;
    dragStart?: (id: UniqueIdentifier) => void;
    dragOver?: (id: UniqueIdentifier, x: number) => void;
    dragEnded?: () => void;
    dragActive?: boolean;
};

export const FocusItem = forwardRef<HTMLDivElement, PinnedSpaceProps>(({ pin, indicator, highlighted, superstate, style, clone, ghost, dragStart, dragOver, dragEnded, index }, ref) => {
    const innerRef = useRef<HTMLDivElement>(null);
    const { focuses: focuses, setEditFocus: setEditFocus, setFocuses: setFocuses, setModifier } = useContext(NavigatorContext);
    const onDragStarted = (_e: React.DragEvent<HTMLDivElement>) => {
        if (dragStart && pin) {
            dragStart(index);
        }
    };
    const onDragEnded = (_e: React.DragEvent<HTMLDivElement>) => {
        if (dragEnded) {
            dragEnded();
        }
    };
    const innerProps = {
        draggable: true,
        onDragStart: onDragStarted,
        onDragEnd: onDragEnded,
        onDrop: onDragEnded,
    };

    const openContextMenu = (rect: Rect) => {
        const menuOptions: SelectOption[] = [
            {
                name: "Edit Focus",
                icon: "ui//edit",
                onClick: () => {
                    setEditFocus(true);
                },
            },
            {
                name: i18n.buttons.close,
                icon: "ui//close",
                value: "close",
                onClick: () => {
                    const focusName = pin.name || i18n.labels.waypoint;
                    superstate.ui.openModal(
                        i18n.labels.closeFocus.replace("${1}", focusName),
                        <ConfirmationModal
                            confirmAction={() => {
                                setFocuses(focuses.filter((_f, i) => i != index));
                                superstate.saveSettings();
                            }}
                            confirmLabel={i18n.menu.yes}
                            cancelLabel={i18n.menu.no}
                            message=""
                        />,
                        windowFromDocument(innerRef.current.ownerDocument),
                    );
                },
            },
        ];
        superstate.ui.openMenu(rect, defaultMenu(superstate.ui, menuOptions), windowFromDocument(innerRef.current.ownerDocument));
    };
    return pin ? (
        <div
            onContextMenu={(e) => {
                e.preventDefault();
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                openContextMenu(rect);
            }}
            ref={innerRef}
            className="mk-waypoint"
            onClick={() => {
                superstate.settings.currentFocus = index;
                superstate.saveSettings();
            }}
            onDragOver={(e) => {
                e.preventDefault();
                setModifier(eventToModifier(e));
                if (!innerRef.current) return;
                const rect = innerRef.current.getBoundingClientRect();

                const x = e.clientX - rect.left; //x position within the element.

                if (dragOver && pin) dragOver(index, x);
            }}
            {...innerProps}
        >
            <div
                ref={ref}
                aria-label={pin.name}
                className={classNames("mk-focuses-item", "clickable-icon", "nav-action-button", (superstate.settings.currentFocus == index || highlighted) && "mk-active", indicator && "mk-indicator", clone && "mk-clone", ghost && "mk-ghost")}
                style={{
                    ...style,
                }}
                dangerouslySetInnerHTML={{
                    __html: superstate.ui.getSticker(pin.sticker),
                }}
            ></div>
        </div>
    ) : (
        <div ref={innerRef} className="mk-waypoint">
            <div
                ref={ref}
                onClick={() => {
                    setFocuses([...focuses, { sticker: "ui//spaces", name: i18n.labels.waypoint, paths: [] }]);
                    superstate.saveSettings();
                }}
                className={classNames("mk-focuses-item", "clickable-icon", "nav-action-button", highlighted && "mk-active", indicator && "mk-indicator", clone && "mk-clone", ghost && "mk-ghost")}
            ></div>
        </div>
    );
});

FocusItem.displayName = "PinnedSpace";
