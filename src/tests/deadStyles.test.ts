import { readFileSync } from "fs";
import i18n from "shared/i18n";

const read = (path: string) => readFileSync(path, "utf8");

describe("i18n", () => {
    it("has no keys left over from removed make.md features", () => {
        const en = i18n as any;
        expect(en.defaults).toBeUndefined();
        expect(en.buttons.close).toBeUndefined();
        expect(en.labels.findStickersButton).toBeUndefined();
        expect(en.labels.saveView).toBeUndefined();
        expect(en.notice.noPropertyName).toBeUndefined();
        expect(en.colors.base80).toBeUndefined();
        expect(en.colors.base90).toBeUndefined();
    });
});

describe("stylesheets", () => {
    it("no longer style components that do not exist", () => {
        expect(read("src/css/Modal/Modal.css")).not.toMatch(/mk-onboarding-settings|mk-options-modal|mk-setting-tabs|mk-form-container/);
        expect(read("src/css/Menus/ColorPicker.css")).not.toMatch(/mk-gradient-|mk-circular-angle-selector/);
        expect(read("src/css/Menus/Menu.css")).not.toMatch(/mk-drawer-|mk-suggester/);
        expect(read("src/css/Menus/MainMenu.css")).not.toMatch(/mk-main-menu-container|mk-main-menu-button/);
        expect(read("src/css/Menus/StickerMenu.css")).not.toMatch(/mk-sticker-modal|mk-sticker-suggestion|mk-image-modal/);
    });
});
