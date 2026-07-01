jest.mock(
    "makemd-core",
    () => ({
        SelectOptionType: {
            Separator: "separator",
        },
    }),
    { virtual: true },
);

jest.mock("core/react/components/UI/Menus/modals/linkMenu", () => ({
    showLinkMenu: jest.fn(),
}));

import { showSpaceAddMenu } from "core/react/components/UI/Menus/navigator/showSpaceAddMenu";
import { showLinkMenu } from "core/react/components/UI/Menus/modals/linkMenu";
import i18n from "shared/i18n";

describe("showSpaceAddMenu", () => {
    it("opens the link menu with hidden items when add into space is shift-clicked", () => {
        const openMenu = jest.fn();
        const superstate = {
            pathsIndex: new Map([["Projects", { path: "Projects", subtype: "folder" }]]),
            spacesIndex: new Map([["Projects", {}]]),
            ui: {
                isPluginEnabled: jest.fn(() => false),
                openMenu,
            },
        } as any;
        const space = {
            type: "folder",
            path: "Projects",
            space: { path: "Projects" },
        } as any;

        showSpaceAddMenu(superstate, { x: 0, y: 0, width: 0, height: 0 } as any, {} as any, space);

        const menuConfig = openMenu.mock.calls[0][1];
        const addIntoSpace = menuConfig.options.find((option: any) => option.name == i18n.buttons.addIntoSpace);
        addIntoSpace.onClick({
            target: {
                getBoundingClientRect: () => ({ x: 1, y: 2, width: 3, height: 4 }),
            },
            view: {
                document: {
                    defaultView: {},
                },
            },
            shiftKey: true,
            stopPropagation: jest.fn(),
        } as any);

        expect(showLinkMenu).toHaveBeenCalledWith(
            { x: 1, y: 2, width: 3, height: 4 },
            {},
            superstate,
            expect.any(Function),
            true,
        );
    });
});
