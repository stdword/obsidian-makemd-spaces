jest.mock("core/react/components/UI/Menus/modals/linkMenu", () => ({
    showLinkMenu: jest.fn(),
}));

jest.mock("core/utils/superstate/spaces", () => ({
    ...jest.requireActual("core/utils/superstate/spaces"),
    newPathInSpace: jest.fn(() => Promise.resolve("Projects/Untitled.md")),
}));

import { newNoteMenuOption, showSpaceAddMenu } from "core/react/components/UI/Menus/navigator/showSpaceAddMenu";
import { showLinkMenu } from "core/react/components/UI/Menus/modals/linkMenu";
import { newPathInSpace } from "core/utils/superstate/spaces";
import { targetLocationForEvent } from "core/utils/targetLocation";
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

describe("targetLocationForEvent", () => {
    it("maps modifiers to the open location", () => {
        expect(targetLocationForEvent({})).toBe(false);
        expect(targetLocationForEvent({ metaKey: true })).toBe("tab");
        expect(targetLocationForEvent({ ctrlKey: true })).toBe("tab");
        expect(targetLocationForEvent({ button: 1 })).toBe("tab");
        expect(targetLocationForEvent({ metaKey: true, altKey: true })).toBe("split");
        expect(targetLocationForEvent({ altKey: true })).toBe(false);
    });
});

describe("showSpaceAddMenu open location", () => {
    const createMenu = (excalidrawEnabled: boolean) => {
        const openMenu = jest.fn();
        const createExcalidrawDrawing = jest.fn(() => Promise.resolve());
        const superstate = {
            pathsIndex: new Map([["Projects", { path: "Projects", subtype: "folder" }]]),
            spacesIndex: new Map([["Projects", {}]]),
            ui: { isPluginEnabled: jest.fn(() => excalidrawEnabled), openMenu, createExcalidrawDrawing },
        } as any;
        const space = { type: "folder", path: "Projects", space: { path: "Projects", folderPath: "Projects" } } as any;
        showSpaceAddMenu(superstate, { x: 0, y: 0, width: 0, height: 0 } as any, {} as any, space);
        const options = [newNoteMenuOption(superstate, space), ...(openMenu.mock.calls[0][1].options as any[])];
        return { options, superstate, space, createExcalidrawDrawing };
    };

    beforeEach(() => {
        (newPathInSpace as jest.Mock).mockClear();
    });

    it("opens a new note, canvas and base in a new tab on cmd-click and in the current tab otherwise", () => {
        const { options, superstate, space } = createMenu(false);
        const cases: [string, string, string | null][] = [
            [i18n.labels.createNote, "md", "Untitled"],
            [i18n.buttons.createCanvas, "canvas", null],
            [i18n.buttons.createBase, "base", null],
        ];
        for (const [label, type, name] of cases) {
            const option = options.find((o) => o.name == label);
            option.onClick({ metaKey: true } as any);
            expect(newPathInSpace).toHaveBeenLastCalledWith(superstate, space, type, name, undefined, undefined, "tab");
            option.onClick({} as any);
            expect(newPathInSpace).toHaveBeenLastCalledWith(superstate, space, type, name, undefined, undefined, false);
        }
    });

    it("passes the open location to the excalidraw drawing", () => {
        const { options, createExcalidrawDrawing } = createMenu(true);
        const option = options.find((o) => o.name == i18n.buttons.createDrawing);
        option.onClick({ ctrlKey: true } as any);
        expect(createExcalidrawDrawing).toHaveBeenLastCalledWith("Projects", "tab");
        option.onClick({} as any);
        expect(createExcalidrawDrawing).toHaveBeenLastCalledWith("Projects", false);
    });
});
