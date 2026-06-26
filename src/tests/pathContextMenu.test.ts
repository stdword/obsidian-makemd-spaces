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
    it("opens the space context menu for virtual tag spaces without path cache", () => {
        const openMenu = jest.fn();
        const tagPathState = {
            path: "spaces://#art",
            name: "art",
            type: "space",
            subtype: "tag",
            label: { color: "", sticker: "" },
        };
        const tagSpace = {
            path: "spaces://#art",
            name: "art",
            type: "tag",
            metadata: { sort: { field: "rank", asc: true } },
            space: { path: "spaces://#art", name: "art", folderPath: "", defPath: "", notePath: "", dbPath: "" },
        };
        const superstate = {
            pathsIndex: new Map(),
            pathStateForPath: jest.fn(() => tagPathState),
            spacesIndex: new Map([["spaces://#art", tagSpace]]),
            ui: {
                openMenu,
                openPath: jest.fn(),
                getOS: jest.fn(() => "mac"),
                hasNativePathMenu: jest.fn(() => false),
            },
        };

        showPathContextMenu(superstate as any, "spaces://#art", null, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window);

        expect(openMenu).toHaveBeenCalled();
    });

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
        expect(updateSpaceMetadata).toHaveBeenCalledWith("/", { color: "#123456" });
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
        expect(openMenu.mock.calls[1][1].options.find((option: any) => option.name === "File Name (1 to 9)")).toBeUndefined();
        expect(openMenu.mock.calls[1][1].options.find((option: any) => option.name === "File Name (9 to 1)")).toBeUndefined();

        superstate.spacesIndex.set("Projects", {
            ...initialSpace,
            metadata: {
                sort: {
                    field: "mtime",
                    asc: false,
                    group: false,
                    recursive: false,
                },
            },
        });

        sortMenu.onSubmenu({ x: 0, y: 0, width: 0, height: 0 });

        expect(openMenu.mock.calls[2][1].options.find((option: any) => option.name === "File Name (A to Z)")?.value).toBe(false);
        expect(openMenu.mock.calls[2][1].options.find((option: any) => option.name === "Modified Time (new to old)")?.value).toBe(true);
    });

    it("passes submenu onHide to sort menu so selecting a sort closes the parent menu", () => {
        const openMenu = jest.fn();
        const onHide = jest.fn();
        const pathState = {
            path: "Projects",
            parent: "",
            type: "space",
            label: {},
            spaces: ["Projects"],
        };
        const superstate = {
            settings: {
                defaultFoldersAtTop: true,
                defaultSpaceSort: {
                    field: "name",
                    asc: true,
                },
            },
            pathsIndex: new Map([["Projects", pathState]]),
            spacesIndex: new Map([
                [
                    "Projects",
                    {
                        path: "Projects",
                        name: "Projects",
                        type: "folder",
                        metadata: {},
                        space: {
                            path: "Projects",
                            folderPath: "Projects",
                        },
                    },
                ],
            ]),
            ui: {
                openMenu,
                getOS: jest.fn(() => "mac"),
                hasNativePathMenu: jest.fn(() => false),
            },
        };

        showSpaceContextMenu(superstate as any, pathState as any, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window);

        const offset = { x: 1, y: 2, width: 3, height: 4 };
        const sortMenu = openMenu.mock.calls[0][1].options.find((option: any) => option.icon === "ui//sort-desc");
        sortMenu.onSubmenu(offset, onHide);

        expect(openMenu.mock.calls[1][0]).toBe(offset);
        expect(openMenu.mock.calls[1][3]).toBe("right");
        expect(openMenu.mock.calls[1][4]).toBe(onHide);
    });

    it("does not create space metadata when clearing sort without an explicit sort", async () => {
        const openMenu = jest.fn();
        const saveSpace = jest.fn();
        const updateSpaceMetadata = jest.fn();
        const pathState = {
            path: "Projects",
            parent: "",
            type: "space",
            label: {},
            spaces: ["Projects"],
        };
        const superstate = {
            settings: {
                defaultFoldersAtTop: true,
                defaultSpaceSort: {
                    field: "name",
                    asc: true,
                },
            },
            pathsIndex: new Map([["Projects", pathState]]),
            spacesIndex: new Map([
                [
                    "Projects",
                    {
                        path: "Projects",
                        name: "Projects",
                        type: "folder",
                        metadata: {},
                        space: {
                            path: "Projects",
                            folderPath: "Projects",
                        },
                    },
                ],
            ]),
            spaceManager: {
                saveSpace,
            },
            updateSpaceMetadata,
            ui: {
                openMenu,
                getOS: jest.fn(() => "mac"),
                hasNativePathMenu: jest.fn(() => false),
            },
        };

        showSpaceContextMenu(superstate as any, pathState as any, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window);

        const sortMenu = openMenu.mock.calls[0][1].options.find((option: any) => option.icon === "ui//sort-desc");
        sortMenu.onSubmenu({ x: 0, y: 0, width: 0, height: 0 });
        const clearSort = openMenu.mock.calls[1][1].options.find((option: any) => option.name === "Reset to Default");

        await clearSort.onClick();

        expect(saveSpace).not.toHaveBeenCalled();
        expect(updateSpaceMetadata).not.toHaveBeenCalled();
    });

    it("does not create def.json when clearing sort from superstate without an existing def.json", async () => {
        const openMenu = jest.fn();
        const saveSpace = jest.fn();
        const updateSpaceMetadata = jest.fn(() => Promise.resolve());
        const pathExists = jest.fn(() => Promise.resolve(false));
        const pathState = {
            path: "Projects",
            parent: "",
            type: "space",
            label: {},
            spaces: ["Projects"],
        };
        const superstate = {
            settings: {
                defaultFoldersAtTop: true,
                defaultSpaceSort: {
                    field: "name",
                    asc: true,
                },
            },
            pathsIndex: new Map([["Projects", pathState]]),
            spacesIndex: new Map([
                [
                    "Projects",
                    {
                        path: "Projects",
                        name: "Projects",
                        type: "folder",
                        metadata: {
                            sort: {
                                field: "rank",
                                asc: true,
                            },
                        },
                        space: {
                            path: "Projects",
                            folderPath: "Projects",
                            defPath: "Projects/.space/def.json",
                        },
                    },
                ],
            ]),
            spaceManager: {
                pathExists,
                saveSpace,
            },
            updateSpaceMetadata,
            ui: {
                openMenu,
                getOS: jest.fn(() => "mac"),
                hasNativePathMenu: jest.fn(() => false),
            },
        };

        showSpaceContextMenu(superstate as any, pathState as any, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window);

        const sortMenu = openMenu.mock.calls[0][1].options.find((option: any) => option.icon === "ui//sort-desc");
        sortMenu.onSubmenu({ x: 0, y: 0, width: 0, height: 0 });
        const clearSort = openMenu.mock.calls[1][1].options.find((option: any) => option.name === "Reset to Default");

        await clearSort.onClick();

        expect(pathExists).toHaveBeenCalledWith("Projects/.space/def.json");
        expect(saveSpace).not.toHaveBeenCalled();
        expect(updateSpaceMetadata).toHaveBeenCalledWith("Projects", {
            sort: undefined,
        });
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

    it("hides creation, rename, duplicate, reveal, and native menu actions for tag spaces", () => {
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
                hasNativePathMenu: jest.fn(() => true),
                nativePathMenu: jest.fn(),
            },
        };

        showSpaceContextMenu(superstate as any, pathState as any, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window);

        const rootOptions = openMenu.mock.calls[0][1].options;
        expect(rootOptions.some((option: any) => option.name === "New")).toBe(false);
        expect(rootOptions.some((option: any) => option.name === "Duplicate")).toBe(false);
        expect(rootOptions.some((option: any) => option.name === "Rename")).toBe(false);
        expect(rootOptions.some((option: any) => option.name === "Reveal in Finder")).toBe(false);
        expect(rootOptions.some((option: any) => option.name === "More options")).toBe(false);
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
