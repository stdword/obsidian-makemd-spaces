jest.mock(
    "makemd-core",
    () => ({
        SelectOptionType: {
            Submenu: "submenu",
        },
    }),
    { virtual: true },
);

jest.mock("core/react/components/UI/Menus/modals/colorPickerMenu", () => ({
    showColorPickerMenu: jest.fn(),
}));

import { showApplyItemsMenu } from "core/react/components/UI/Menus/navigator/showApplyItemsMenu";
import i18n from "shared/i18n";

describe("showApplyItemsMenu", () => {
    it("shows default color before default sticker", () => {
        const openMenu = jest.fn();
        const superstate = {
            ui: {
                openMenu,
            },
        };
        const space = {
            space: { path: "Projects" },
            metadata: {},
        };

        showApplyItemsMenu({ x: 0, y: 0, width: 0, height: 0 } as any, superstate as any, space as any, {} as Window);

        const options = openMenu.mock.calls[0][1].options;
        expect(options.map((option: any) => option.name)).toEqual([i18n.menu.setDefaultColor, i18n.menu.setDefaultSticker]);
    });
});
