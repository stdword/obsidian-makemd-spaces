jest.mock(
    "makemd-core",
    () => ({
        SelectOptionType: {
            Submenu: "submenu",
            Separator: "separator",
            Radio: "radio",
        },
    }),
    { virtual: true },
);

jest.mock("core/react/components/UI/Menus/modals/colorPickerMenu", () => ({
    showColorPickerMenu: jest.fn((_superstate, _offset, _win, _color, saveValue) => saveValue("#123456")),
}));

import { showPathContextMenu, triggerMultiPathMenu } from "core/react/components/UI/Menus/navigator/pathContextMenu";
import { showSpaceContextMenu } from "core/react/components/UI/Menus/navigator/spaceContextMenu";
import { defaultContextFileColumns, defaultContextSchemaID } from "shared/schemas/context";

describe("triggerMultiPathMenu", () => {
    it("opens every selected path in a new tab from the multi-path open action", async () => {
        let resolveFirst: () => void;
        let resolveSecond: () => void;
        const firstOpen = new Promise<void>((resolve) => {
            resolveFirst = resolve;
        });
        const secondOpen = new Promise<void>((resolve) => {
            resolveSecond = resolve;
        });
        const openPath = jest.fn().mockReturnValueOnce(firstOpen).mockReturnValueOnce(secondOpen);
        const openMenu = jest.fn();
        const superstate = {
            ui: {
                openPath,
                openMenu,
            },
        };
        const selectedPaths = [
            { item: { path: "Alpha.md", type: "file" }, path: "Alpha.md" },
            { item: { path: "Beta.md", type: "file" }, path: "Beta.md" },
        ];
        const event = {
            target: {
                getBoundingClientRect: jest.fn(() => ({ x: 0, y: 0, width: 0, height: 0 })),
            },
            view: {
                document: { defaultView: {} } as Document,
            },
        };

        triggerMultiPathMenu(superstate as any, selectedPaths as any, event as any);

        const menuProps = openMenu.mock.calls[0][1];
        const openAll = menuProps.options[0].onClick(event);

        expect(openPath).toHaveBeenCalledTimes(1);
        expect(openPath).toHaveBeenNthCalledWith(1, "Alpha.md", "tab");

        resolveFirst();
        await firstOpen;
        await Promise.resolve();

        expect(openPath).toHaveBeenCalledTimes(2);
        expect(openPath).toHaveBeenNthCalledWith(2, "Beta.md", "tab");

        resolveSecond();
        await openAll;
    });

    it("hides the color action when a selected file is linked", () => {
        const openMenu = jest.fn();
        const superstate = {
            ui: {
                openMenu,
            },
        };
        const selectedPaths = [
            { item: { path: "Folder/Note.md", type: "file", parent: "Folder" }, path: "Folder/Note.md", space: "LinkedSpace" },
            { item: { path: "Folder/Other.md", type: "file", parent: "Folder" }, path: "Folder/Other.md", space: "Folder" },
        ];
        const event = {
            target: {
                getBoundingClientRect: jest.fn(() => ({ x: 0, y: 0, width: 0, height: 0 })),
            },
            view: {
                document: { defaultView: {} } as Document,
            },
        };

        triggerMultiPathMenu(superstate as any, selectedPaths as any, event as any);

        const rootOptions = openMenu.mock.calls[0][1].options;
        expect(rootOptions.some((option: any) => option.icon === "ui//palette")).toBe(false);
    });
});

describe("showPathContextMenu", () => {
    it("hides the color action for linked files", () => {
        const openMenu = jest.fn();
        const pathState = {
            path: "Folder/Note.md",
            parent: "Folder",
            type: "file",
            subtype: "md",
            label: { color: "#123456", sticker: "ui//file-text" },
        };
        const superstate = {
            pathsIndex: new Map([["Folder/Note.md", pathState]]),
            spacesIndex: new Map([["LinkedSpace", { path: "LinkedSpace", name: "Linked Space" }]]),
            spaceManager: {
                copyPath: jest.fn(),
                renamePath: jest.fn(),
            },
            ui: {
                openMenu,
                getOS: jest.fn(() => "mac"),
                hasNativePathMenu: jest.fn(() => false),
            },
        };

        showPathContextMenu(superstate as any, "Folder/Note.md", "LinkedSpace", { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window);

        const rootOptions = openMenu.mock.calls[0][1].options;
        expect(rootOptions.some((option: any) => option.icon === "ui//palette")).toBe(false);
    });
});

describe("showSpaceContextMenu", () => {
    it("updates the home space label color when a color is selected", async () => {
        const dispatchEvent = jest.fn();
        const saveLabel = jest.fn(() => Promise.resolve());
        const saveTable = jest.fn(() => Promise.resolve(true));
        const saveSpace = jest.fn();
        const updateSpaceMetadata = jest.fn(() => Promise.resolve(true));
        const openMenu = jest.fn();
        const pathState = {
            path: "/",
            parent: "",
            type: "space",
            label: {
                color: "",
            },
            spaces: ["/"],
        };
        const contextTable = {
            schema: { id: defaultContextSchemaID, name: "Items", type: "db", primary: "true" },
            cols: defaultContextFileColumns.map((name) => ({ name, schemaId: defaultContextSchemaID, type: "text" })),
            rows: [{ path: "/", color: "" }],
        };
        const superstate = {
            settings: {
                fmKeyColor: "color",
            },
            pathsIndex: new Map([["/", pathState]]),
            spacesIndex: new Map([
                [
                    "/",
                    {
                        path: "/",
                        name: "Home",
                        type: "vault",
                        metadata: {},
                        space: {
                            path: "/",
                            folderPath: "/",
                        },
                    },
                ],
            ]),
            spaceManager: {
                saveLabel,
                contextForSpace: jest.fn(() => Promise.resolve(contextTable)),
                saveTable,
                saveSpace,
            },
            updateSpaceMetadata,
            ui: {
                openMenu,
                getOS: jest.fn(() => "mac"),
                hasNativePathMenu: jest.fn(() => false),
            },
            dispatchEvent,
        };

        showSpaceContextMenu(superstate as any, pathState as any, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window);

        const changeColor = openMenu.mock.calls[0][1].options.find((option: any) => option.icon === "ui//palette");
        await changeColor.onSubmenu({ x: 0, y: 0, width: 0, height: 0 });

        expect(saveLabel).toHaveBeenCalledWith("/", "color", "#123456");
        expect(saveTable).not.toHaveBeenCalled();
        expect(saveSpace).not.toHaveBeenCalled();
        expect(updateSpaceMetadata).not.toHaveBeenCalled();
        expect(superstate.pathsIndex.get("/")?.label.color).toBe("#123456");
        expect(dispatchEvent).toHaveBeenCalledWith("pathStateUpdated", { path: "/" });
    });

    it("rebuilds sort submenu radio values from the latest space state", () => {
        const openMenu = jest.fn();
        const pathState = {
            path: "Projects",
            parent: "",
            type: "space",
            label: {},
            spaces: ["Projects"],
        };
        const initialSpace = {
            path: "Projects",
            name: "Projects",
            type: "folder",
            metadata: {
                sort: {
                    field: "name",
                    asc: true,
                    group: false,
                    recursive: false,
                },
            },
            space: {
                path: "Projects",
                folderPath: "Projects",
            },
        };
        const superstate = {
            pathsIndex: new Map([["Projects", pathState]]),
            spacesIndex: new Map([["Projects", initialSpace]]),
            ui: {
                openMenu,
                getOS: jest.fn(() => "mac"),
                hasNativePathMenu: jest.fn(() => false),
            },
        };

        showSpaceContextMenu(superstate as any, pathState as any, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window);

        const sortMenu = openMenu.mock.calls[0][1].options.find((option: any) => option.icon === "ui//sort-desc");
        sortMenu.onSubmenu({ x: 0, y: 0, width: 0, height: 0 });
        expect(openMenu.mock.calls[1][1].options.find((option: any) => option.name === "File Name (A to Z)")?.value).toBe(true);

        superstate.spacesIndex.set("Projects", {
            ...initialSpace,
            metadata: {
                sort: {
                    field: "number",
                    asc: true,
                    group: false,
                    recursive: false,
                },
            },
        });

        sortMenu.onSubmenu({ x: 0, y: 0, width: 0, height: 0 });

        expect(openMenu.mock.calls[2][1].options.find((option: any) => option.name === "File Name (A to Z)")?.value).toBe(false);
        expect(openMenu.mock.calls[2][1].options.find((option: any) => option.name === "File Name (1 to 9)")?.value).toBe(true);
    });

    it("hides sticker and apply-to-items actions for tag spaces", () => {
        const openMenu = jest.fn();
        const pathState = {
            path: "spaces://#art",
            parent: "",
            type: "space",
            subtype: "tag",
            label: {},
            spaces: [] as string[],
        };
        const tagSpace = {
            path: "spaces://#art",
            name: "#art",
            type: "tag",
            metadata: {},
            space: {
                path: "spaces://#art",
                folderPath: "/#art",
            },
        };
        const superstate = {
            pathsIndex: new Map([["spaces://#art", pathState]]),
            spacesIndex: new Map([["spaces://#art", tagSpace]]),
            ui: {
                openMenu,
                getOS: jest.fn(() => "mac"),
                hasNativePathMenu: jest.fn(() => false),
            },
        };

        showSpaceContextMenu(superstate as any, pathState as any, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window);

        const rootOptions = openMenu.mock.calls[0][1].options;
        expect(rootOptions.some((option: any) => option.icon === "ui//sticker")).toBe(false);
        expect(rootOptions.some((option: any) => option.value === "apply-all")).toBe(false);
    });

    it("hides folder-only sort options for tag spaces", () => {
        const openMenu = jest.fn();
        const pathState = {
            path: "spaces://#art",
            parent: "",
            type: "space",
            subtype: "tag",
            label: {},
            spaces: [] as string[],
        };
        const tagSpace = {
            path: "spaces://#art",
            name: "#art",
            type: "tag",
            metadata: {
                sort: {
                    field: "name",
                    asc: true,
                    group: false,
                    recursive: false,
                },
            },
            space: {
                path: "spaces://#art",
                folderPath: "/#art",
            },
        };
        const superstate = {
            pathsIndex: new Map([["spaces://#art", pathState]]),
            spacesIndex: new Map([["spaces://#art", tagSpace]]),
            ui: {
                openMenu,
                getOS: jest.fn(() => "mac"),
                hasNativePathMenu: jest.fn(() => false),
            },
        };

        showSpaceContextMenu(superstate as any, pathState as any, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window);

        const sortMenu = openMenu.mock.calls[0][1].options.find((option: any) => option.icon === "ui//sort-desc");
        sortMenu.onSubmenu({ x: 0, y: 0, width: 0, height: 0 });

        const sortOptions = openMenu.mock.calls[1][1].options;
        expect(sortOptions.some((option: any) => option.name === "Folders at the Top")).toBe(false);
        expect(sortOptions.some((option: any) => option.name === "Apply to Subfolders")).toBe(false);
        expect(sortOptions.some((option: any) => option.name === "File Name (A to Z)")).toBe(true);
    });
});
