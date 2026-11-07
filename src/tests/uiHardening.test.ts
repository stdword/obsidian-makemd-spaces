import { readFileSync } from "fs";
import { isConfirmKey } from "core/react/components/UI/Modals/ConfirmationModal";

const read = (path: string) => readFileSync(path, "utf8");

describe("ConfirmationModal keyboard", () => {
    it("confirms on Enter only", () => {
        expect(isConfirmKey({ key: "Enter", isComposing: false })).toBe(true);
        expect(isConfirmKey({ key: "Enter", isComposing: true })).toBe(false);
        expect(isConfirmKey({ key: "Escape", isComposing: false })).toBe(false);
        expect(isConfirmKey({ key: " ", isComposing: false })).toBe(false);
    });

    it("listens through the shared inputManager, not the global window", () => {
        const source = read("src/core/react/components/UI/Modals/ConfirmationModal.tsx");
        expect(source).toContain('inputManager.on("keydown", handleKeyDown)');
        expect(source).not.toContain("window.addEventListener");
        expect(read("src/adapters/obsidian/ui/modal.tsx")).toContain("ui: props.fc.props?.ui ?? props.ui.manager");
    });
});

describe("ColorPicker", () => {
    it("has no text input: colors come from the palette and the canvas only", () => {
        const source = read("src/core/react/components/UI/Menus/modals/colorPickerMenu.tsx");
        expect(source).not.toContain("<input");
        expect(source).not.toContain("mk-color-hex-input");
    });

    it("creates the debounced saver once and flushes it on unmount", () => {
        const source = read("src/core/react/components/UI/Menus/modals/colorPickerMenu.tsx");
        expect(source).toMatch(/useMemo\(\(\) => debounce\(/);
        expect(source).toContain("debouncedSaveValue.flush()");
        expect(source).not.toMatch(/useCallback\(\s*debounce/);
    });
});

describe("showMenu", () => {
    const source = read("src/core/react/components/UI/Menus/menu.tsx");

    it("notifies onHide at most once", () => {
        const guard = source.indexOf("if (hasBeenCalled) return;");
        const notify = source.indexOf("if (props.onHide && !supress) props.onHide();");
        expect(guard).toBeGreaterThan(-1);
        expect(guard).toBeLessThan(notify);
    });

    it("applies the requested className to the menu portal", () => {
        expect(source).toContain("portalElement.classList.add(...props.className.split");
        expect(read("src/css/Menus/Menu.css")).not.toContain(".mk-combo-menu {");
    });
});
