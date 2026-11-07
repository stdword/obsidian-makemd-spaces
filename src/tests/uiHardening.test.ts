import { readFileSync } from "fs";
import { isConfirmKey } from "core/react/components/UI/Modals/ConfirmationModal";
import { hexInputValue, normalizeHexInput } from "core/react/components/UI/Menus/modals/colorPickerMenu";

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

describe("ColorPicker hex field", () => {
    it("shows only real hex colors in the field", () => {
        expect(hexInputValue("#1A2b3C")).toBe("#1A2b3C");
        expect(hexInputValue("var(--mk-color-red)")).toBe("");
        expect(hexInputValue("")).toBe("");
        expect(hexInputValue(undefined as unknown as string)).toBe("");
    });

    it("accepts a complete hex with or without the hash and rejects partial input", () => {
        expect(normalizeHexInput("#A1B2C3")).toBe("#A1B2C3");
        expect(normalizeHexInput("a1b2c3")).toBe("#a1b2c3");
        expect(normalizeHexInput(" #A1B2C3 ")).toBe("#A1B2C3");
        expect(normalizeHexInput("#A1B")).toBeNull();
        expect(normalizeHexInput("#GGGGGG")).toBeNull();
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
