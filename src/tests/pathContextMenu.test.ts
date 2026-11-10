jest.mock("core/react/components/UI/Menus/modals/colorPickerMenu", () => ({
    showColorPickerMenu: jest.fn((_superstate, _offset, _win, _color, saveValue) => saveValue("#123456")),
}));

jest.mock("core/react/components/UI/Menus/modals/selectSpaceMenu", () => ({
    showFoldersMenu: jest.fn(),
}));

jest.mock("core/commands/revealPathInSpaces", () => ({
    revealPathInSpaces: jest.fn(),
}));

import { showPathContextMenu, triggerMultiPathMenu } from "core/react/components/UI/Menus/navigator/pathContextMenu";
import { showSpaceContextMenu } from "core/react/components/UI/Menus/navigator/spaceContextMenu";
import { showFoldersMenu } from "core/react/components/UI/Menus/modals/selectSpaceMenu";
import { sectionExpandKey } from "core/utils/superstate/expandKeys";
import i18n from "shared/i18n";
import { revealPathInSpaces } from "core/commands/revealPathInSpaces";

beforeEach(() => {
    jest.clearAllMocks();
});

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

    it("updates colors for selected files in their current tree space", async () => {
        const openMenu = jest.fn();
        const spacesIndex = new Map([
            [
                "Projects",
                {
                    type: "folder",
                    name: "Projects",
                    path: "Projects",
                    metadata: {
                        "file-colors": {},
                    },
                    space: { path: "Projects", name: "Projects", defPath: "", notePath: "", folderPath: "" },
                },
            ],
        ]);
        const updateSpaceMetadata = jest.fn((spacePath: string, metadata: any) => {
            spacesIndex.set(spacePath, {
                ...spacesIndex.get(spacePath),
                metadata,
            });
            return Promise.resolve(spacesIndex.get(spacePath));
        });
        const superstate = {
            pathsIndex: new Map([
                [
                    "Projects/Alpha.md",
                    {
                        path: "Projects/Alpha.md",
                        name: "Alpha",
                        type: "file",
                        subtype: "md",
                        parent: "Projects",
                        spaces: [],
                    },
                ],
                [
                    "Projects/Beta.md",
                    {
                        path: "Projects/Beta.md",
                        name: "Beta",
                        type: "file",
                        subtype: "md",
                        parent: "Projects",
                        spaces: [],
                    },
                ],
            ]),
            spacesIndex,
            updateSpaceMetadata,
            spaceManager: {
                saveSpace: jest.fn(() => Promise.resolve()),
            },
            dispatchEvent: jest.fn(),
            ui: {
                openMenu,
            },
        };
        const selectedPaths = [
            { item: { path: "Projects/Alpha.md", type: "file", parent: "Projects" }, path: "Projects/Alpha.md", space: "Projects" },
            { item: { path: "Projects/Beta.md", type: "file", parent: "Projects" }, path: "Projects/Beta.md", space: "Projects" },
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

        const changeColor = openMenu.mock.calls[0][1].options.find((option: any) => option.icon === "ui//palette");
        await changeColor.onSubmenu({ x: 0, y: 0, width: 0, height: 0 });

        expect(spacesIndex.get("Projects").metadata["file-colors"]).toEqual({
            "Projects/Alpha.md": "#123456",
            "Projects/Beta.md": "#123456",
        });
    });

    it("pins every selected path in their shared tree space", async () => {
        const openMenu = jest.fn();
        const space = { path: "Projects", type: "folder", metadata: { pinned: [] as string[] } };
        const superstate = {
            spacesIndex: new Map([[space.path, space]]),
            spaceManager: { saveSpace: jest.fn(() => Promise.resolve()) },
            updateSpaceMetadata: jest.fn((_path: string, metadata: any) => {
                space.metadata = metadata;
                return Promise.resolve();
            }),
            ui: { openMenu },
        };
        const selectedPaths = [
            { item: { path: "Projects/Alpha.md", parent: "Projects", type: "file" }, path: "Projects/Alpha.md", space: "Projects", depth: 1 },
            { item: { path: "Projects/Beta.md", parent: "Projects", type: "file" }, path: "Projects/Beta.md", space: "Projects", depth: 1 },
        ];
        const event = { target: { getBoundingClientRect: jest.fn(() => ({})) }, view: { document: { defaultView: {} } } };

        triggerMultiPathMenu(superstate as any, selectedPaths as any, event as any);
        const pin = openMenu.mock.calls[0][1].options.find((option: any) => option.name === i18n.menu.pinToTop);
        await pin.onClick();

        expect(space.metadata.pinned).toEqual(["Projects/Alpha.md", "Projects/Beta.md"]);
    });

    it("deletes every selected sub-tag through tag-space deletion", async () => {
        const openMenu = jest.fn();
        const openModal = jest.fn();
        const onTagDeleted = jest.fn(() => Promise.resolve());
        const parentPath = "spaces://#topic";
        const firstPath = "spaces://#topic/first";
        const secondPath = "spaces://#topic/second";
        const superstate = {
            spacesIndex: new Map([
                [firstPath, { path: firstPath, name: "topic/first", type: "tag", metadata: {} }],
                [secondPath, { path: secondPath, name: "topic/second", type: "tag", metadata: {} }],
            ]),
            onTagDeleted,
            ui: { openMenu, openModal },
        };
        const selectedPaths = [
            { item: { path: firstPath, type: "space", subtype: "tag" }, path: firstPath, space: parentPath, depth: 1 },
            { item: { path: secondPath, type: "space", subtype: "tag" }, path: secondPath, space: parentPath, depth: 1 },
        ];
        const event = { target: { getBoundingClientRect: jest.fn(() => ({})) }, view: { document: { defaultView: {} } } };

        triggerMultiPathMenu(superstate as any, selectedPaths as any, event as any);
        const deleteOption = openMenu.mock.calls[0][1].options.find((option: any) => option.name === i18n.menu.delete);
        deleteOption.onClick(event as any);
        await openModal.mock.calls[0][1].props.confirmAction();

        expect(onTagDeleted.mock.calls).toEqual([["topic/first"], ["topic/second"]]);
    });

    it("wraps selected sibling paths into one new folder", async () => {
        const openMenu = jest.fn();
        const openModal = jest.fn();
        const renamePath = jest.fn(() => Promise.resolve());
        const createFolder = jest.fn(() => Promise.resolve());
        const superstate = {
            spacesIndex: new Map(),
            pathsIndex: new Map(),
            spaceManager: {
                pathExists: jest.fn(() => Promise.resolve(false)),
                spaceInfoForPath: jest.fn((path: string) => ({ path, name: path.split("/").pop() })),
                parentPathForPath: jest.fn(() => "Projects"),
                createSpace: createFolder,
                renamePath,
            },
            reloadSpace: jest.fn((space: any) => Promise.resolve({ ...space, metadata: {} })),
            onSpaceDefinitionChanged: jest.fn(),
            ui: { openMenu, openModal, notify: jest.fn() },
        };
        const selectedPaths = [
            { item: { path: "Projects/Alpha.md", parent: "Projects", type: "file" }, path: "Projects/Alpha.md", space: "Projects", depth: 1 },
            { item: { path: "Projects/Beta.md", parent: "Projects", type: "file" }, path: "Projects/Beta.md", space: "Projects", depth: 1 },
        ];
        const event = { target: { getBoundingClientRect: jest.fn(() => ({})) }, view: { document: { defaultView: {} } } };

        triggerMultiPathMenu(superstate as any, selectedPaths as any, event as any);
        const wrap = openMenu.mock.calls[0][1].options.find((option: any) => option.name === i18n.menu.wrapToFolder);
        wrap.onClick(event as any);
        await openModal.mock.calls[0][1].props.saveValue("Bundle");

        expect(createFolder).toHaveBeenCalledWith("Bundle", "Projects", undefined);
        expect(renamePath.mock.calls).toEqual([
            ["Projects/Alpha.md", "Projects/Bundle/Alpha.md"],
            ["Projects/Beta.md", "Projects/Bundle/Beta.md"],
        ]);
    });
});

describe("wrap each item to its own folder", () => {
    it("wraps every selected item into a folder named after it without the extension", async () => {
        const openMenu = jest.fn();
        const renamePath = jest.fn(() => Promise.resolve());
        const createFolder = jest.fn(() => Promise.resolve());
        const superstate = {
            spacesIndex: new Map([["Library", { path: "Library", type: "folder", metadata: { pinned: [] } }]]),
            pathsIndex: new Map(),
            spaceManager: {
                pathExists: jest.fn((path: string) => Promise.resolve(path == "Library/Taken")),
                spaceInfoForPath: jest.fn((path: string) => ({ path, name: path.split("/").pop() })),
                parentPathForPath: jest.fn(() => "Library"),
                createSpace: createFolder,
                renamePath,
            },
            reloadSpace: jest.fn((space: any) => Promise.resolve({ ...space, metadata: {} })),
            onSpaceDefinitionChanged: jest.fn(),
            ui: { openMenu, openModal: jest.fn(), notify: jest.fn() },
        };
        const selectedPaths = [
            { item: { path: "Library/Alpha.md", parent: "Library", type: "file" }, path: "Library/Alpha.md", space: "Library", depth: 1 },
            { item: { path: "Library/Taken.canvas", parent: "Library", type: "file" }, path: "Library/Taken.canvas", space: "Library", depth: 1 },
            { item: { path: "Library/Sub", parent: "Library", type: "space" }, path: "Library/Sub", space: "Library", depth: 1 },
        ];
        const event = { target: { getBoundingClientRect: jest.fn(() => ({})) }, view: { document: { defaultView: {} } } };

        triggerMultiPathMenu(superstate as any, selectedPaths as any, event as any);
        const options = openMenu.mock.calls[0][1].options;
        const wrapIndex = options.findIndex((option: any) => option.name === i18n.menu.wrapToFolder);
        const wrapEach = options[wrapIndex + 1];
        expect(wrapEach.name).toBe(i18n.menu.wrapEachToFolder);
        expect(wrapEach.icon).toBe(options[wrapIndex].icon);
        const names = options.map((option: any) => option.name);
        expect(names.indexOf(i18n.menu.pinToTop)).toBeLessThan(wrapIndex);
        expect(names.indexOf(i18n.menu.moveFile)).toBeGreaterThan(wrapIndex + 1);
        expect(names.indexOf(i18n.buttons.addToSpace)).toBe(names.indexOf(i18n.menu.moveFile) + 1);

        await wrapEach.onClick(event as any);

        expect(superstate.ui.openModal).not.toHaveBeenCalled();
        expect(createFolder.mock.calls.map((call: any[]) => call[0])).toEqual(["Alpha", "Sub"]);
        expect(renamePath.mock.calls).toEqual([
            ["Library/Alpha.md", "Library/Alpha/Alpha.md"],
            ["Library/Sub", "Library/Sub/Sub"],
        ]);
        expect(superstate.ui.notify).toHaveBeenCalledWith(i18n.notice.fileExists);
    });

    it("does not offer the per-item wrap in the single path menu", () => {
        const openMenu = jest.fn();
        const pathsIndex = new Map([["Library/Alpha.md", { path: "Library/Alpha.md", name: "Alpha", type: "file", subtype: "md", parent: "Library", color: "", sticker: "" }]]);
        const superstate = {
            spacesIndex: new Map(),
            pathsIndex,
            settings: {},
            pathStateForPath: jest.fn((path: string) => pathsIndex.get(path)),
            spacesMap: { get: jest.fn(() => new Set()), set: jest.fn() },
            spaceManager: { spaceInfoForPath: jest.fn((): any => null) },
            ui: { openMenu, openModal: jest.fn(), notify: jest.fn(), getOS: jest.fn(() => "mac"), hasNativePathMenu: jest.fn(() => false) },
        } as any;

        showPathContextMenu(superstate as any, "Library/Alpha.md", "Library", {} as any, {} as any, undefined, undefined, 1);

        const names = openMenu.mock.calls[0][1].options.map((option: any) => option.name);
        expect(names).toContain(i18n.menu.wrapToFolder);
        expect(names).not.toContain(i18n.menu.wrapEachToFolder);
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
            color: "",
            sticker: "",
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

    it("shows the color action for linked files", () => {
        const openMenu = jest.fn();
        const pathState = {
            path: "Folder/Note.md",
            parent: "Folder",
            type: "file",
            subtype: "md",
            color: "#123456",
            sticker: "ui//file-text",
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
        expect(rootOptions.some((option: any) => option.icon === "ui//palette")).toBe(true);
    });

    it("reveals a linked file using the selected path", () => {
        const openMenu = jest.fn();
        const pathState = { path: "Folder/Note.md", name: "Note", parent: "Folder", type: "file", subtype: "md" };
        const superstate = {
            pathsIndex: new Map([[pathState.path, pathState]]),
            spacesIndex: new Map([["Dashboard", { path: "Dashboard", name: "Dashboard", type: "folder" }]]),
            spaceManager: { copyPath: jest.fn() },
            ui: { openMenu, getOS: jest.fn(() => "mac"), hasNativePathMenu: jest.fn(() => false) },
        };

        showPathContextMenu(superstate as any, pathState.path, "Dashboard", { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window);
        openMenu.mock.calls[0][1].options.find((option: any) => option.name === i18n.menu.revealInSpaces).onClick();

        expect(revealPathInSpaces).toHaveBeenCalledWith(superstate, pathState.path);
    });

    it("shows Reveal in Spaces for an item in a tag space", () => {
        const openMenu = jest.fn();
        const pathState = { path: "Notes/Tagged.md", name: "Tagged", parent: "Notes", type: "file", subtype: "md" };
        const superstate = {
            pathsIndex: new Map([[pathState.path, pathState]]),
            spacesIndex: new Map(),
            spaceManager: { copyPath: jest.fn() },
            ui: { openMenu, getOS: jest.fn(() => "mac"), hasNativePathMenu: jest.fn(() => false) },
        };

        showPathContextMenu(superstate as any, pathState.path, "spaces://#work", { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window);

        expect(openMenu.mock.calls[0][1].options.some((option: any) => option.name === i18n.menu.revealInSpaces)).toBe(true);
    });

    it("opens Link to with hidden folders when shift-clicked", () => {
        const openMenu = jest.fn();
        const pathState = {
            path: "Folder/Note.md",
            name: "Note",
            parent: "Folder",
            type: "file",
            subtype: "md",
        };
        const superstate = {
            pathsIndex: new Map([["Folder/Note.md", pathState]]),
            spacesIndex: new Map(),
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
        const event = {
            target: {
                getBoundingClientRect: jest.fn(() => ({ x: 1, y: 2, width: 3, height: 4 })),
            },
            view: {
                document: { defaultView: {} } as Document,
            },
            shiftKey: true,
        };

        showPathContextMenu(superstate as any, "Folder/Note.md", "Folder", { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window);

        const linkTo = openMenu.mock.calls[0][1].options.find((option: any) => option.name == i18n.buttons.addToSpace);
        linkTo.onClick(event as any);

        expect(showFoldersMenu).toHaveBeenCalledWith(
            { x: 1, y: 2, width: 3, height: 4 },
            {},
            superstate,
            expect.any(Function),
            true,
        );
    });

    it("uses the shared move helper when moving a file from the context menu", async () => {
        const openMenu = jest.fn();
        const targetSpace = {
            path: "Target",
            type: "folder",
            metadata: {
                sort: { field: "rank", asc: true },
                links: ["Source/Item.md"],
                "rank-order": ["Source/Item.md"],
            },
            space: {
                defPath: "Target/.space/context.json",
            },
        };
        const pathState = {
            path: "Source/Item.md",
            name: "Item.md",
            parent: "Source",
            type: "file",
            subtype: "md",
        };
        const renamePath = jest.fn(() => Promise.resolve());
        const superstate = {
            settings: {},
            pathsIndex: new Map([["Source/Item.md", pathState]]),
            pathStateForPath: jest.fn((path: string) => superstate.pathsIndex.get(path)),
            spacesIndex: new Map([["Target", targetSpace]]),
            spacesMap: {
                get: jest.fn(() => new Set(["Target"])),
                set: jest.fn(),
            },
            spaceManager: {
                copyPath: jest.fn(),
                pathExists: jest.fn(() => Promise.resolve(false)),
                renamePath,
                saveSpace: jest.fn((_path: string, update: (metadata: any) => any) => {
                    targetSpace.metadata = update(targetSpace.metadata);
                    return Promise.resolve();
                }),
            },
            getSpaceItems: jest.fn(() => [{ path: "Source/Item.md" }]),
            updateSpaceMetadata: jest.fn((_path: string, metadata: any) => {
                targetSpace.metadata = metadata;
                return Promise.resolve();
            }),
            ui: {
                openMenu,
                notify: jest.fn(),
                getOS: jest.fn(() => "mac"),
                hasNativePathMenu: jest.fn(() => false),
            },
        } as any;
        const event = {
            target: {
                getBoundingClientRect: jest.fn(() => ({ x: 1, y: 2, width: 3, height: 4 })),
            },
            view: {
                document: { defaultView: {} } as Document,
            },
            shiftKey: false,
        };

        showPathContextMenu(superstate as any, "Source/Item.md", "Source", { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window);

        const moveTo = openMenu.mock.calls[0][1].options.find((option: any) => option.name == i18n.menu.moveFile);
        moveTo.onClick(event as any);
        const saveFolder = (showFoldersMenu as jest.Mock).mock.calls[0][3];
        await saveFolder("Target");

        expect(renamePath).toHaveBeenCalledWith("Source/Item.md", "Target/Item.md");
        expect(superstate.updateSpaceMetadata).toHaveBeenLastCalledWith("Target", expect.objectContaining({
            links: [],
            "rank-order": ["Target/Item.md"],
        }));
    });

    it("shows Wrap to Folder before Move to and defaults to the file name without its extension", async () => {
        const openMenu = jest.fn();
        const openModal = jest.fn();
        const renamePath = jest.fn(() => Promise.resolve());
        const createFolder = jest.fn(() => Promise.resolve());
        const pathState = {
            path: "Drafts/Sample Article.md",
            name: "Sample Article",
            parent: "Drafts",
            type: "file",
            subtype: "md",
        };
        const superstate = {
            settings: {},
            pathsIndex: new Map([[pathState.path, pathState]]),
            pathStateForPath: jest.fn(() => pathState),
            spacesIndex: new Map(),
            spaceManager: {
                pathExists: jest.fn(() => Promise.resolve(false)),
                spaceInfoForPath: jest.fn((path: string) => ({ path, name: path.split("/").pop() })),
                parentPathForPath: jest.fn(() => "Drafts"),
                createSpace: createFolder,
                renamePath,
            },
            reloadSpace: jest.fn((space: any) => Promise.resolve({ ...space, metadata: {} })),
            onSpaceDefinitionChanged: jest.fn(),
            ui: {
                openMenu,
                openModal,
                notify: jest.fn(),
                getOS: jest.fn(() => "mac"),
                hasNativePathMenu: jest.fn(() => false),
            },
        } as any;
        const event = { view: { document: { defaultView: {} } } } as any;

        showPathContextMenu(superstate, pathState.path, "Drafts", { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window, "right", null, 1);

        const options = openMenu.mock.calls[0][1].options;
        const moveIndex = options.findIndex((option: any) => option.name === i18n.menu.moveFile);
        const wrapIndex = options.findIndex((option: any) => option.name === i18n.menu.wrapToFolder);
        expect(wrapIndex).toBeGreaterThan(-1);
        expect(wrapIndex).toBeLessThan(moveIndex);

        options[wrapIndex].onClick(event);
        const modal = openModal.mock.calls[0][1];
        expect(modal.props.value).toBe("Sample Article");

        await modal.props.saveValue("Published Article");
        expect(createFolder).toHaveBeenCalledWith("Published Article", "Drafts", undefined);
        expect(renamePath).toHaveBeenCalledWith(
            "Drafts/Sample Article.md",
            "Drafts/Published Article/Sample Article.md",
        );
    });

    it("shows Exclude from Focus below level zero and no Hide command", async () => {
        const openMenu = jest.fn();
        const saveFocuses = jest.fn();
        const pathState = {
            path: "Atlas/Obsidian",
            parent: "Atlas",
            type: "space",
            spaces: [] as string[],
        };
        const space = {
            path: "Atlas/Obsidian",
            name: "Obsidian",
            type: "folder",
            metadata: {},
            space: {
                path: "Atlas/Obsidian",
                folderPath: "Atlas/Obsidian",
            },
        };
        const superstate = {
            settings: {
                currentFocus: 0,
            },
            focuses: [{ name: "Work", sticker: "", paths: ["Atlas"] }],
            pathsIndex: new Map([["Atlas/Obsidian", pathState]]),
            spacesIndex: new Map([["Atlas/Obsidian", space]]),
            spaceManager: {
                copyPath: jest.fn(),
                renameSpace: jest.fn(),
                saveFocuses,
            },
            ui: {
                openMenu,
                getOS: jest.fn(() => "mac"),
                hasNativePathMenu: jest.fn(() => false),
            },
        };

        showSpaceContextMenu(superstate as any, pathState as any, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window, "Atlas", undefined, 1);

        const nestedOptions = openMenu.mock.calls[0][1].options;
        expect(nestedOptions).toEqual(expect.arrayContaining([expect.objectContaining({ name: i18n.menu.excludeFromFocus })]));
        expect(nestedOptions).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: i18n.menu.hide })]));
        expect(nestedOptions).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: i18n.menu.unhide })]));

        showSpaceContextMenu(superstate as any, pathState as any, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window);
        const rootOptions = openMenu.mock.calls[1][1].options;
        expect(rootOptions).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: i18n.menu.excludeFromFocus })]));

        nestedOptions.find((option: any) => option.name == i18n.menu.excludeFromFocus).onClick();
        await Promise.resolve();
        expect(saveFocuses).toHaveBeenCalledWith([
            expect.objectContaining({ "excluded-paths": ["Atlas/Obsidian"] }),
        ]);
    });
});

describe("copy path placement", () => {
    const names = (options: any[]) => options.map((option) => option.name);

    it("puts Copy path right above Pin to Top in the file menu", () => {
        const openMenu = jest.fn();
        const parent = { path: "Trips", type: "space", subtype: "folder", metadata: {}, space: { folderPath: "Trips" } };
        const pathState = { path: "Trips/Norway.md", parent: "Trips", type: "file", subtype: "md", spaces: [] as string[] };
        const superstate = {
            pathsIndex: new Map([[pathState.path, pathState]]),
            spacesIndex: new Map([[parent.path, parent]]),
            ui: { openMenu, getOS: jest.fn(() => "mac"), hasNativePathMenu: jest.fn(() => false) },
        };

        showPathContextMenu(superstate as any, pathState.path, parent.path, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window, undefined, undefined, 1);

        const optionNames = names(openMenu.mock.calls[0][1].options);
        const copyIndex = optionNames.indexOf(i18n.menu.copyPath);
        expect(copyIndex).toBeGreaterThan(-1);
        expect(optionNames[copyIndex + 1]).toBe(i18n.menu.pinToTop);
    });

    it("puts Copy path right above Pin to Top in the folder menu and hides it for tag spaces", () => {
        const openMenu = jest.fn();
        const parent = { path: "/", type: "space", subtype: "folder", metadata: {}, space: { folderPath: "/" } };
        const pathState = { path: "Trips", parent: "/", type: "space", subtype: "folder", spaces: [] as string[] };
        const space = { path: "Trips", name: "Trips", type: "folder", metadata: {}, space: { folderPath: "Trips" } };
        const superstate = {
            settings: {},
            pathsIndex: new Map([[pathState.path, pathState]]),
            spacesIndex: new Map<string, any>([[space.path, space], [parent.path, parent]]),
            ui: { openMenu, getOS: jest.fn(() => "mac"), hasNativePathMenu: jest.fn(() => false), isPluginEnabled: jest.fn(() => false) },
        };

        showSpaceContextMenu(superstate as any, pathState as any, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window, parent.path, undefined, 1);

        const optionNames = names(openMenu.mock.calls[0][1].options);
        const copyIndex = optionNames.indexOf(i18n.menu.copyPath);
        expect(copyIndex).toBeGreaterThan(-1);
        expect(optionNames[copyIndex + 1]).toBe(i18n.menu.pinToTop);

        const tagState = { path: "spaces://#trips", parent: "", type: "space", subtype: "tag", spaces: [] as string[] };
        const tagSpace = { path: "spaces://#trips", name: "#trips", type: "tag", metadata: {}, space: { folderPath: "/#trips" } };
        const tagSuperstate = { ...superstate, pathsIndex: new Map([[tagState.path, tagState]]), spacesIndex: new Map([[tagSpace.path, tagSpace]]) };
        showSpaceContextMenu(tagSuperstate as any, tagState as any, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window);
        expect(names(openMenu.mock.calls[1][1].options)).not.toContain(i18n.menu.copyPath);
    });
});

describe("showSpaceContextMenu", () => {
    it("shows New Note before New and keeps New Folder in its submenu", () => {
        const openMenu = jest.fn();
        const pathState = { path: "Projects", parent: "/", type: "space", subtype: "folder", spaces: [] as string[] };
        const space = {
            path: pathState.path,
            name: "Projects",
            type: "folder",
            metadata: {},
            space: { folderPath: pathState.path },
        };
        const superstate = {
            settings: {},
            pathsIndex: new Map([[pathState.path, pathState]]),
            spacesIndex: new Map([[space.path, space]]),
            ui: {
                openMenu,
                getOS: jest.fn(() => "mac"),
                hasNativePathMenu: jest.fn(() => false),
                isPluginEnabled: jest.fn(() => false),
            },
        };

        showSpaceContextMenu(superstate as any, pathState as any, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window);

        const rootOptions = openMenu.mock.calls[0][1].options;
        expect(rootOptions.slice(0, 2).map((option: any) => option.name)).toEqual([
            i18n.labels.createNote,
            i18n.menu.new,
        ]);

        rootOptions[1].onSubmenu({ x: 0, y: 0, width: 0, height: 0 });
        const newSubmenuOptions = openMenu.mock.calls[1][1].options;
        expect(newSubmenuOptions.some((option: any) => option.name === i18n.labels.createNote)).toBe(false);
        expect(newSubmenuOptions.some((option: any) => option.name === i18n.labels.createFolder)).toBe(true);
    });

    it("updates the home space display color when a color is selected", async () => {
        const dispatchEvent = jest.fn();
        const saveSpace = jest.fn();
        const updateSpaceMetadata = jest.fn(() => Promise.resolve(true));
        const openMenu = jest.fn();
        const pathState = {
            path: "/",
            parent: "",
            type: "space",
            color: "",
            sticker: "ui//home",
            spaces: ["/"],
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

        expect(saveSpace).toHaveBeenCalledWith("/", expect.any(Function));
        expect(updateSpaceMetadata).toHaveBeenCalledWith("/", { color: "#123456" });
    });

    it("rebuilds sort submenu radio values from the latest space state", () => {
        const openMenu = jest.fn();
        const pathState = {
            path: "Projects",
            parent: "",
            type: "space",
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
        expect(openMenu.mock.calls[1][1].options.find((option: any) => option.name === i18n.menu.fileNameSortAlphaAsc)?.value).toBe(true);
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

        expect(openMenu.mock.calls[2][1].options.find((option: any) => option.name === i18n.menu.fileNameSortAlphaAsc)?.value).toBe(false);
        expect(openMenu.mock.calls[2][1].options.find((option: any) => option.name === i18n.menu.modifiedTimeSortAsc)?.value).toBe(true);
    });

    it("passes submenu onHide to sort menu so selecting a sort closes the parent menu", () => {
        const openMenu = jest.fn();
        const onHide = jest.fn();
        const pathState = {
            path: "Projects",
            parent: "",
            type: "space",
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
        const clearSort = openMenu.mock.calls[1][1].options.find((option: any) => option.name === i18n.menu.clearSort);

        await clearSort.onClick();

        expect(saveSpace).not.toHaveBeenCalled();
        expect(updateSpaceMetadata).not.toHaveBeenCalled();
    });

    it("does not create context.json when clearing sort from superstate without an existing context.json", async () => {
        const openMenu = jest.fn();
        const saveSpace = jest.fn();
        const updateSpaceMetadata = jest.fn(() => Promise.resolve());
        const pathExists = jest.fn(() => Promise.resolve(false));
        const pathState = {
            path: "Projects",
            parent: "",
            type: "space",
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
                            defPath: "Projects/.space/context.json",
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
        const clearSort = openMenu.mock.calls[1][1].options.find((option: any) => option.name === i18n.menu.clearSort);

        await clearSort.onClick();

        expect(pathExists).toHaveBeenCalledWith("Projects/.space/context.json");
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

    it("shows New Separator as the first tag-space action while hiding New and unsupported actions", () => {
        const openMenu = jest.fn();
        const pathState = {
            path: "spaces://#art",
            parent: "",
            type: "space",
            subtype: "tag",
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
        expect(rootOptions.some((option: any) => option.name === i18n.menu.new)).toBe(false);
        expect(rootOptions[0]?.name).toBe(i18n.buttons.createSeparator);
        expect(rootOptions[0]?.icon).toBe("lucide//separator-horizontal");
        expect(rootOptions.some((option: any) => option.name === i18n.menu.duplicate)).toBe(false);
        expect(rootOptions.some((option: any) => option.name === i18n.menu.rename)).toBe(false);
        expect(rootOptions.some((option: any) => option.name === i18n.menu.revealInDefault)).toBe(false);
        expect(rootOptions.some((option: any) => option.name === i18n.menu.openNativeMenu)).toBe(false);
        expect(rootOptions.some((option: any) => option.name === i18n.menu.revealInSpaces)).toBe(false);
    });

    it("reveals a linked folder using the selected folder path", () => {
        const openMenu = jest.fn();
        const pathState = { path: "Projects/Archive", parent: "Projects", type: "space", subtype: "folder", spaces: [] as string[] };
        const space = {
            path: pathState.path,
            name: "Archive",
            type: "folder",
            metadata: {},
            space: { folderPath: pathState.path },
        };
        const superstate = {
            settings: {},
            spacesIndex: new Map<string, any>([
                [space.path, space],
                ["Dashboard", { path: "Dashboard", name: "Dashboard", type: "folder" }],
            ]),
            spaceManager: {},
            ui: { openMenu, getOS: jest.fn(() => "mac"), hasNativePathMenu: jest.fn(() => false) },
        };

        showSpaceContextMenu(superstate as any, pathState as any, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window, "Dashboard");
        openMenu.mock.calls[0][1].options.find((option: any) => option.name === i18n.menu.revealInSpaces).onClick();

        expect(revealPathInSpaces).toHaveBeenCalledWith(superstate, pathState.path);
    });

    it("shows folder grouping but hides recursive sorting for tag spaces", () => {
        const openMenu = jest.fn();
        const pathState = {
            path: "spaces://#art",
            parent: "",
            type: "space",
            subtype: "tag",
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
        expect(sortOptions.some((option: any) => option.name === i18n.menu.groupSpaces)).toBe(true);
        expect(sortOptions.some((option: any) => option.name === i18n.menu.groupSubtags)).toBe(true);
        expect(sortOptions.some((option: any) => option.name === i18n.menu.recursiveTagSort)).toBe(true);
        expect(sortOptions.some((option: any) => option.name === i18n.menu.recursiveSort)).toBe(false);
        expect(sortOptions.some((option: any) => option.name === i18n.menu.fileNameSortAlphaAsc)).toBe(true);
    });

    it("shows Pin to Top for a sub-tag inside its parent tag space", () => {
        const openMenu = jest.fn();
        const parentPath = "spaces://#topic";
        const childPath = "spaces://#topic/child";
        const pathState = { path: childPath, type: "space", subtype: "tag", parent: "" };
        const superstate = {
            settings: {},
            spacesIndex: new Map([
                [parentPath, { path: parentPath, type: "tag", metadata: { pinned: [] } }],
                [childPath, { path: childPath, type: "tag", metadata: {} }],
            ]),
            ui: {
                openMenu,
                getOS: jest.fn(() => "mac"),
                hasNativePathMenu: jest.fn(() => false),
            },
        };

        showSpaceContextMenu(superstate as any, pathState as any, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window, parentPath, undefined, 1);

        const rootOptions = openMenu.mock.calls[0][1].options;
        const pinIndex = rootOptions.findIndex((option: any) => option.name === i18n.menu.pinToTop);
        const sortIndex = rootOptions.findIndex((option: any) => option.name === i18n.menu.sortBy);
        expect(pinIndex).toBeGreaterThan(-1);
        expect(pinIndex).toBeGreaterThan(sortIndex);
    });

    it("shows Use as Filter immediately after Pin to Top for a linked tag space", async () => {
        const openMenu = jest.fn();
        const parentPath = "Folder";
        const tagPath = "spaces://#topic";
        const pathState = { path: tagPath, type: "space", subtype: "tag", parent: "" };
        const parentSpace: any = { path: parentPath, type: "folder", metadata: { links: [`${tagPath}?filter`], pinned: [] as string[] } };
        const updateSpaceMetadata = jest.fn(async (_path, metadata) => { parentSpace.metadata = metadata; });
        const superstate = {
            settings: {},
            spacesIndex: new Map<string, any>([
                [parentPath, parentSpace],
                [tagPath, { path: tagPath, type: "tag", metadata: {} }],
            ]),
            spaceManager: { saveSpace: jest.fn(async (_path, update) => update(parentSpace.metadata)) },
            updateSpaceMetadata,
            dispatchEvent: jest.fn(),
            ui: { openMenu, getOS: jest.fn(() => "mac"), hasNativePathMenu: jest.fn(() => false) },
        };

        showSpaceContextMenu(superstate as any, pathState as any, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window, parentPath, undefined, 1);
        const rootOptions = openMenu.mock.calls[0][1].options;
        const pinIndex = rootOptions.findIndex((option: any) => option.name === i18n.menu.pinToTop);
        const filterIndex = rootOptions.findIndex((option: any) => option.name === i18n.menu.useAsFilter);
        expect(filterIndex).toBe(pinIndex + 1);
        expect(rootOptions[filterIndex]).toEqual(expect.objectContaining({ icon: "lucide//filter", value: true }));
        await rootOptions[filterIndex].onClick();
        expect(parentSpace.metadata.links).toEqual([tagPath]);
    });

    it("opens Link to with hidden folders when shift-clicked", () => {
        const openMenu = jest.fn();
        const pathState = {
            path: "Projects",
            parent: "",
            type: "space",
            spaces: ["Projects"],
        };
        const space = {
            path: "Projects",
            name: "Projects",
            type: "folder",
            metadata: {},
            space: {
                path: "Projects",
                folderPath: "Projects",
            },
        };
        const superstate = {
            pathsIndex: new Map([["Projects", pathState]]),
            spacesIndex: new Map([["Projects", space]]),
            spaceManager: {
                copyPath: jest.fn(),
                renameSpace: jest.fn(),
            },
            ui: {
                openMenu,
                getOS: jest.fn(() => "mac"),
                hasNativePathMenu: jest.fn(() => false),
            },
        };
        const event = {
            target: {
                getBoundingClientRect: jest.fn(() => ({ x: 1, y: 2, width: 3, height: 4 })),
            },
            shiftKey: true,
        };

        showSpaceContextMenu(superstate as any, pathState as any, { x: 0, y: 0, width: 0, height: 0 } as any, {} as Window);

        const linkTo = openMenu.mock.calls[0][1].options.find((option: any) => option.name == i18n.buttons.addToSpace);
        linkTo.onClick(event as any);

        expect(showFoldersMenu).toHaveBeenCalledWith(
            { x: 1, y: 2, width: 3, height: 4 },
            {},
            superstate,
            expect.any(Function),
            true,
        );
    });
});

describe("Focus Mode menu item", () => {
    const rect = { x: 0, y: 0, width: 0, height: 0 } as any;
    const event = { target: { getBoundingClientRect: () => rect }, view: { document: { defaultView: {} } } } as any;
    const makeSuperstate = () => {
        const openMenu = jest.fn();
        const folder = (path: string) => ({ path, parent: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "/", type: "space", subtype: "folder", spaces: [] as string[] });
        const space = (path: string, type = "folder") => ({ path, name: path.split("/").pop(), type, metadata: {}, space: { folderPath: path } });
        const tagPath = "spaces://#brass";
        const superstate = {
            settings: { currentFocus: 0, expandedSpaces: [] as string[] },
            focuses: [{ name: "Workshop", sticker: "", paths: ["Benches"] }],
            focusMode: null as any,
            dispatchEvent: jest.fn(),
            saveSettings: jest.fn(() => Promise.resolve()),
            spaceManager: { saveFocuses: jest.fn(() => Promise.resolve()) },
            pathsIndex: new Map<string, any>([
                ["Benches/Lathe.md", { path: "Benches/Lathe.md", parent: "Benches", type: "file", subtype: "md", name: "Lathe" }],
                ["Benches/Jigs", folder("Benches/Jigs")],
                [tagPath, { path: tagPath, parent: "", type: "space", subtype: "tag", spaces: [] }],
            ]),
            spacesIndex: new Map<string, any>([
                ["Benches", space("Benches")],
                ["Benches/Jigs", space("Benches/Jigs")],
                [tagPath, space(tagPath, "tag")],
            ]),
            ui: { openMenu, getOS: jest.fn(() => "mac"), hasNativePathMenu: jest.fn(() => false), isPluginEnabled: jest.fn(() => false) },
        };
        const names = () => (openMenu.mock.calls[0][1].options as any[]).map((option) => option.name);
        const click = (name: string) => (openMenu.mock.calls[0][1].options as any[]).find((option) => option.name == name).onClick(event);
        return { superstate: superstate as any, names, click, tagPath };
    };
    const focusMode = "Focus Mode";

    it("a single file gets Focus Mode as its own group above Color", () => {
        const { superstate, names } = makeSuperstate();

        showPathContextMenu(superstate, "Benches/Lathe.md", "Benches", rect, {} as Window, undefined, undefined, 1, "Benches/Lathe.md");

        expect(names().slice(0, 3)).toEqual([focusMode, "", i18n.menu.changeColor]);
    });

    it("a folder gets Focus Mode last in the New group", () => {
        const { superstate, names } = makeSuperstate();

        showPathContextMenu(superstate, "Benches/Jigs", "Benches", rect, {} as Window, undefined, undefined, 1, "Benches/Jigs");

        expect(names().slice(0, 5)).toEqual([i18n.labels.createNote, i18n.menu.new, focusMode, "", i18n.menu.changeColor]);
    });

    it("a tag space gets Focus Mode right after New Separator", () => {
        const { superstate, names, tagPath } = makeSuperstate();

        showPathContextMenu(superstate, tagPath, null, rect, {} as Window, undefined, undefined, 0, tagPath);

        expect(names().slice(0, 4)).toEqual([i18n.buttons.createSeparator, focusMode, "", i18n.menu.changeColor]);
    });

    it("multi-select gets Focus Mode right after Open in Tabs", () => {
        const { superstate, names } = makeSuperstate();
        const selected = [
            { id: "Benches/Benches/Lathe.md", expandKey: "Benches/Lathe.md", item: { path: "Benches/Lathe.md", type: "file" }, path: "Benches/Lathe.md", space: "Benches", depth: 1 },
            { id: "Benches/Benches/Jigs", expandKey: "Benches/Jigs", item: { path: "Benches/Jigs", type: "space" }, path: "Benches/Jigs", space: "Benches", depth: 1 },
        ];

        triggerMultiPathMenu(superstate, selected as any, event);

        expect(names().slice(0, 3)).toEqual([i18n.menu.openInATab, focusMode, ""]);
    });

    it("multi-select inside a tag space gets Focus Mode right after Open in Tabs", () => {
        const { superstate, names, tagPath } = makeSuperstate();
        const selected = [
            { id: `${tagPath}/Benches/Lathe.md`, item: { path: "Benches/Lathe.md", type: "file" }, path: "Benches/Lathe.md", space: tagPath, depth: 1 },
            { id: `${tagPath}/Benches/Jigs`, item: { path: "Benches/Jigs", type: "space" }, path: "Benches/Jigs", space: tagPath, depth: 1 },
        ];

        triggerMultiPathMenu(superstate, selected as any, event);

        expect(names().slice(0, 3)).toEqual([i18n.menu.openInATab, focusMode, ""]);
    });

    it("Focus Mode on a selection uses tree order, not click order", () => {
        const { superstate, click } = makeSuperstate();
        const selected = [
            { id: "Benches/Benches/Lathe.md", expandKey: "Benches/Lathe.md", item: { path: "Benches/Lathe.md", type: "file" }, path: "Benches/Lathe.md", space: "Benches", depth: 1 },
            { id: "Benches/Benches/Jigs", expandKey: "Benches/Jigs", item: { path: "Benches/Jigs", type: "space" }, path: "Benches/Jigs", space: "Benches", depth: 1 },
        ];

        triggerMultiPathMenu(superstate, selected as any, event, ["Benches", "Benches/Benches/Jigs", "Benches/Benches/Lathe.md"]);
        click(focusMode);

        expect(superstate.focusMode.focus.paths).toEqual(["Benches/Jigs", "Benches/Lathe.md"]);
        expect(superstate.spaceManager.saveFocuses).not.toHaveBeenCalled();
    });

    it("Focus Mode on a single nested folder makes it a section with its folding kept", () => {
        const { superstate, click } = makeSuperstate();
        superstate.settings.expandedSpaces = [sectionExpandKey("Workshop", "Benches"), "Benches/Jigs"];

        showPathContextMenu(superstate, "Benches/Jigs", "Benches", rect, {} as Window, undefined, undefined, 1, "Benches/Jigs");
        click(focusMode);

        expect(superstate.focusMode.focus.paths).toEqual(["Benches/Jigs"]);
        expect(superstate.focusMode.expandedSpaces).toEqual([sectionExpandKey("", "Benches/Jigs")]);
        expect(superstate.spaceManager.saveFocuses).not.toHaveBeenCalled();
    });
});
