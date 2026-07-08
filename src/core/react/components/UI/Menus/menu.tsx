import { DndContext, KeyboardSensor, MeasuringStrategy, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { calculateBoundsBasedOnPosition } from "core/utils/ui/menu";
import { isPhone } from "core/utils/ui/screen";
import React, { cloneElement, useEffect } from "react";
import { MenuObject } from "shared/types/menu";
import { Anchors, Rect } from "shared/types/Pos";
import { IUIManager } from "shared/types/uiManager";

export const MenuWrapper = (props: { rect: Rect; ui: IUIManager; anchor: Anchors; hide: (supress?: boolean) => void; children: any }) => {
    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 10,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );
    const ref = React.useRef(null);
    // const [rect, setRect] = React.useState<Rect>(props.rect);
    const isReady = false;
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key == "Escape") {
                props.hide(true);
                return true;
            }
            return false;
        };
        function handleClickOutside(event: MouseEvent) {
            const checkElement = (el: HTMLElement) => {
                if (el.classList.contains("mk-menu") || el.classList.contains("mk-menu-wrapper") || el.classList.contains("mk-modal")) {
                    return true;
                }
                return false;
            };
            let dom: HTMLElement = event.target as HTMLElement;
            while (!checkElement(dom) && dom.parentElement) {
                dom = dom.parentElement;
            }

            if (checkElement(dom)) {
                return;
            }
            if (ref.current && !ref.current.contains(event.target)) {
                props.hide(true);
            }
        }
        props.ui.inputManager.on("click", handleClickOutside);
        props.ui.inputManager.on("contextmenu", handleClickOutside);
        props.ui.inputManager.on("keydown", onKeyDown);
        return () => {
            props.ui.inputManager.off("click", handleClickOutside);
            props.ui.inputManager.off("contextmenu", handleClickOutside);
            props.ui.inputManager.off("keydown", onKeyDown);
        };
    }, [props.hide]);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            measuring={{
                droppable: {
                    strategy: MeasuringStrategy.Always,
                },
            }}
        >
            <div className={`mk-menu-wrapper ${!isPhone(props.ui) || isReady ? "mk-ready" : ""}`} ref={ref}>
                {props.children}
            </div>
        </DndContext>
    );
};

export const showMenu = (props: {
    rect: Rect;
    ui: IUIManager;
    anchor: Anchors;
    win: Window;
    fc: JSX.Element;
    props?: any;
    onHide?: () => void;
    onSubmenu?: (openSubmenu: (offset: Rect, onHide: () => void) => MenuObject) => MenuObject;
    className?: string;
    centered?: boolean;
    force?: boolean;
}): MenuObject => {
    const backdropElement = props.centered ? props.win.document.createElement("div") : null;
    const portalElement = props.win.document.createElement("div");
    portalElement.classList.add("mk-menu");
    if (props.centered) portalElement.classList.add("mk-menu-centered");

    if (backdropElement) {
        backdropElement.classList.add("mk-menu-backdrop");
        props.win.document.body.appendChild(backdropElement);
    }
    props.win.document.body.appendChild(portalElement);

    let submenu: MenuObject = null;
    let resizeObserver: ResizeObserver | null = null;

    const hideFunction = () => {
        let hasBeenCalled = false;
        return (supress: boolean, immediate?: boolean) => {
            if (props.onHide && !supress) props.onHide();
            if (submenu) submenu.hide(true);
            if (hasBeenCalled) return;
            hasBeenCalled = true;
            const remove = () => {
                resizeObserver?.disconnect();
                root.unmount();
                if (portalElement.isConnected) props.win.document.body.removeChild(portalElement);
                if (backdropElement?.isConnected) props.win.document.body.removeChild(backdropElement);
            };
            if (immediate) {
                remove();
            } else {
                setTimeout(remove, 50);
            }
        };
    };
    const hide = hideFunction();
    backdropElement?.addEventListener("click", () => hide(true));

    const root = props.ui.createRoot(portalElement);
    const updateRoot = (newProps: any) => {
        root.render(
            <MenuWrapper rect={props.rect} ui={props.ui} hide={(supress?: boolean, immediate?: boolean) => hide(supress, immediate)} anchor={props.anchor}>
                {cloneElement(props.fc, {
                    hide: (supress?: boolean, immediate?: boolean) => hide(supress, immediate),
                    onSubmenu: (openSubmenu: (offset: Rect, onHide: () => void) => MenuObject) => {
                        const menu = openSubmenu(props.rect, () => {
                            if (props.onHide) {
                                props.onHide();
                            }
                            hide(true);
                        });
                        if (submenu) {
                            submenu.hide(true);
                        }
                        submenu = menu;
                    },
                    ...newProps,
                })}
            </MenuWrapper>,
        );
    };

    updateRoot(props.props);
    if (props.centered) {
        portalElement.style.position = "fixed";
        portalElement.style.left = "50%";
        portalElement.style.top = "30%";
    } else {
        portalElement.style.position = "absolute";
        portalElement.style.left = `${props.rect.x}px`;
        portalElement.style.top = `${props.rect.y}px`;
    }

    resizeObserver = props.centered
        ? null
        : new ResizeObserver((entries) => {
              const newPos = calculateBoundsBasedOnPosition(
                  props.rect,
                  entries[0].target.getBoundingClientRect(),
                  {
                      width: props.win.innerWidth,
                      height: props.win.innerHeight,
                  },
                  props.anchor,
              );
              portalElement.style.left = `${newPos.x}px`;
              portalElement.style.top = `${newPos.y}px`;

              // portalElement.style.height = `${newPos.height}px`;
              // portalElement.style.height = `${newPos.height}px`;
              // portalElement.style.width = `${newPos.width}px`;
          });

    // start observing a DOM node
    resizeObserver?.observe(portalElement);
    // Ensure the portalElement stays within the window
    return {
        update: updateRoot,
        hide: hide,
        isOpen: () => portalElement.isConnected,
    } as MenuObject;
};
