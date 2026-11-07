import { PointerModifiers } from "schemas/ui";
import { MenuObject, SelectOption, SelectOptionType } from "shared/types/menu";
import { Rect } from "shared/types/Pos";

export const canFocusOption = (item: SelectOption): boolean =>
    !item.disabled && item.type != SelectOptionType.Separator && item.type != SelectOptionType.Section && item.type != SelectOptionType.Input && item.type != SelectOptionType.Custom;

// Next focusable index in the given direction, wrapping around; -1 when nothing can be focused.
export const stepOptionIndex = (options: SelectOption[], index: number, direction: 1 | -1): number => {
    const size = options.length;
    if (size == 0) return -1;
    const start = index < 0 || index >= size ? (direction == 1 ? -1 : size) : index;
    for (let step = 1; step <= size; step++) {
        const next = (((start + direction * step) % size) + size) % size;
        if (canFocusOption(options[next])) return next;
    }
    return -1;
};

/** Backspace removes the last selected tag only when there is one and the query is empty. */
export const backspaceDeletesTag = (query: string, tagCount: number): boolean => query.length == 0 && tagCount > 0;

export type MenuKeyAction = "activate" | "open-submenu" | "close-submenu";

export const menuKeyAction = (key: string, options: SelectOption[], index: number, isSubmenu: boolean): MenuKeyAction | null => {
    const item = index >= 0 ? options[index] : undefined;
    if (key == "Enter") return item && (item.onClick || item.onSubmenu) ? "activate" : null;
    if (key == "ArrowRight") return item?.onSubmenu ? "open-submenu" : null;
    if (key == "ArrowLeft") return isSubmenu ? "close-submenu" : null;
    return null;
};

export type MenuActivationEvent = Partial<PointerModifiers> & { detail?: number };

export type MenuActivationContext = {
    openSubmenu?: (menu: MenuObject | null) => void;
    hide: (suppress?: boolean, immediate?: boolean) => void;
    onHide?: () => void;
    selectOption: (item: SelectOption, modifiers: PointerModifiers) => void;
    isDisclosureMenu?: boolean;
};

// Shared by mouse clicks and keyboard activation so both behave identically.
export const activateMenuOption = (item: SelectOption, anchor: Rect, e: MenuActivationEvent, context: MenuActivationContext): void => {
    if (item.onSubmenu && context.openSubmenu) {
        if (item.closeParentOnOpen) {
            context.openSubmenu(null);
            context.hide();
            item.onSubmenu(anchor, () => undefined);
            return;
        }
        context.openSubmenu(
            item.onSubmenu(anchor, () => {
                context.onHide?.();
                context.hide();
            }),
        );
        return;
    }
    if (item.onClick) {
        context.openSubmenu?.(null);
        item.onClick(e as React.MouseEvent);
        if (!item.keepOpen && item.type != SelectOptionType.Submenu && item.type != SelectOptionType.Disclosure) {
            context.hide(false, item.closeParentImmediately);
        }
        return;
    }
    context.openSubmenu?.(null);
    if (item.type == null || item.type == SelectOptionType.Option || item.type == SelectOptionType.Disclosure) {
        context.selectOption(item, {
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            altKey: e.altKey,
            shiftKey: e.shiftKey,
            doubleClick: e.detail == 2,
        });
    }
};
