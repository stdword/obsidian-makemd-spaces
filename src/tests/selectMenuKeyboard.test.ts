import { readFileSync } from "fs";
import { SelectOptionType } from "shared/types/menu";
import { activateMenuOption, menuKeyAction, stepOptionIndex } from "core/react/components/UI/Menus/menu/selectMenuKeyboard";

const separator = { name: "", type: SelectOptionType.Separator, disabled: true };
const option = (name: string, extra: Record<string, unknown> = {}) => ({ name, value: name, ...extra });

describe("stepOptionIndex", () => {
    it("returns -1 for an empty list instead of throwing", () => {
        expect(stepOptionIndex([], 0, 1)).toBe(-1);
        expect(stepOptionIndex([], -1, -1)).toBe(-1);
    });

    it("skips separators and disabled options and wraps around", () => {
        const options = [option("Open"), separator, option("Rename", { disabled: true }), option("Delete")];
        expect(stepOptionIndex(options, 0, 1)).toBe(3);
        expect(stepOptionIndex(options, 3, 1)).toBe(0);
        expect(stepOptionIndex(options, 0, -1)).toBe(3);
        expect(stepOptionIndex(options, -1, 1)).toBe(0);
    });

    it("returns -1 when nothing is focusable", () => {
        expect(stepOptionIndex([separator, option("Off", { disabled: true })], 0, 1)).toBe(-1);
    });
});

describe("menuKeyAction", () => {
    const options = [option("Open", { onClick: (): void => undefined }), option("Share", { type: SelectOptionType.Submenu, onSubmenu: (): null => null }), option("Plain")];

    it("activates the focused option on Enter when it has a handler or submenu", () => {
        expect(menuKeyAction("Enter", options, 0, false)).toBe("activate");
        expect(menuKeyAction("Enter", options, 1, false)).toBe("activate");
    });

    it("leaves Enter to the select flow for plain options and when nothing is focused", () => {
        expect(menuKeyAction("Enter", options, 2, false)).toBeNull();
        expect(menuKeyAction("Enter", options, -1, false)).toBeNull();
        expect(menuKeyAction("Enter", [], 0, false)).toBeNull();
    });

    it("opens a submenu on ArrowRight only when the focused option has one", () => {
        expect(menuKeyAction("ArrowRight", options, 1, false)).toBe("open-submenu");
        expect(menuKeyAction("ArrowRight", options, 0, false)).toBeNull();
    });

    it("closes a submenu on ArrowLeft but ignores ArrowLeft in a root menu", () => {
        expect(menuKeyAction("ArrowLeft", options, 0, true)).toBe("close-submenu");
        expect(menuKeyAction("ArrowLeft", options, 0, false)).toBeNull();
    });
});

describe("activateMenuOption", () => {
    const anchor = { x: 10, y: 20, width: 100, height: 24 };
    const makeContext = () => ({
        openSubmenu: jest.fn(),
        hide: jest.fn(),
        onHide: jest.fn(),
        selectOption: jest.fn(),
        isDisclosureMenu: false,
    });

    it("opens the submenu anchored to the row and registers it with the parent", () => {
        const submenu = { hide: jest.fn(), update: jest.fn() };
        const onSubmenu = jest.fn((_anchor: unknown, _onHide: () => void) => submenu);
        const context = makeContext();

        activateMenuOption(option("Share", { type: SelectOptionType.Submenu, onSubmenu }), anchor, {}, context);

        expect(onSubmenu.mock.calls[0][0]).toEqual(anchor);
        expect(context.openSubmenu).toHaveBeenCalledWith(submenu);
        expect(context.hide).not.toHaveBeenCalled();
    });

    it("runs onClick and closes the menu unless the option keeps it open", () => {
        const onClick = jest.fn();
        const context = makeContext();
        const event = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false };

        activateMenuOption(option("Rename", { onClick }), anchor, event, context);
        expect(onClick).toHaveBeenCalledWith(event);
        expect(context.hide).toHaveBeenCalledWith(false, undefined);

        const keepOpen = makeContext();
        activateMenuOption(option("Toggle", { onClick, keepOpen: true }), anchor, event, keepOpen);
        expect(keepOpen.hide).not.toHaveBeenCalled();
    });

    it("selects a plain option with the event modifiers", () => {
        const context = makeContext();
        const event = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false };
        const plain = option("Plain");

        activateMenuOption(plain, anchor, event, context);

        expect(context.selectOption).toHaveBeenCalledWith(plain, expect.objectContaining({ ctrlKey: true, doubleClick: false }));
    });
});

describe("hidden menus stop handling keys before unmount", () => {
    const read = (path: string) => readFileSync(path, "utf8");

    it("marks the menu hidden synchronously in hide()", () => {
        const source = read("src/core/react/components/UI/Menus/menu.tsx");
        expect(source).toContain('portalElement.classList.add("mk-menu-hidden")');
        expect(source).toContain("if (isMenuHidden(ref.current)) return false;");
        expect(read("src/css/Menus/Menu.css")).toContain(".mk-menu.mk-menu-hidden");
    });

    it("ignores keyboard input once the menu is marked hidden", () => {
        expect(read("src/core/react/components/UI/Menus/menu/SelectMenuComponent.tsx")).toContain("isMenuHidden(container.current)");
    });
});
