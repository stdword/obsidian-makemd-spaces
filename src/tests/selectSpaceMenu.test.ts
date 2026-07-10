import { showOpenMenu } from "core/react/components/UI/Menus/modals/selectSpaceMenu";

describe("showOpenMenu", () => {
    it("includes tag spaces that are visible in Obsidian even though their paths use the spaces protocol", async () => {
        const openMenu = jest.fn();
        const superstate = {
            allSpaces: jest.fn(() => [
                { name: "sample", path: "spaces://#sample", type: "tag" },
                { name: "archive", path: "spaces://#archive", type: "tag" },
                { name: "Internal", path: "spaces://$tags", type: "default" },
                { name: "Folder", path: "Folder", type: "folder" },
            ]),
            spaceManager: {
                readTags: jest.fn(() => ["#sample"]),
            },
            spacesIndex: new Map([
                ["spaces://#sample", { name: "sample", path: "spaces://#sample", type: "tag" }],
                ["spaces://#archive", { name: "archive", path: "spaces://#archive", type: "tag" }],
            ]),
            pathsIndex: new Map(),
            ui: {
                openMenu,
            },
        } as any;

        await showOpenMenu({ x: 0, y: 0, width: 0, height: 0 } as any, {} as any, superstate, jest.fn());

        const menuConfig = openMenu.mock.calls[0][1];
        expect(menuConfig.options).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    name: "sample",
                    value: "spaces://#sample",
                    section: "tags",
                    icon: "lucide//hash",
                    description: "",
                }),
            ]),
        );
        expect(menuConfig.options).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    value: "spaces://$tags",
                }),
                expect.objectContaining({
                    value: "spaces://#archive",
                }),
            ]),
        );
    });

    it("sorts tags by name and folders by parent section depth", async () => {
        const openMenu = jest.fn();
        const superstate = {
            allSpaces: jest.fn(() => [
                { name: "python", path: "spaces://#it/languages/python", type: "tag" },
                { name: "cpp", path: "spaces://#it/languages/cpp", type: "tag" },
                { name: "Leaf", path: "Alpha/Sub1/Leaf", type: "folder" },
                { name: "Home", path: "/", type: "vault" },
                { name: "Sub2", path: "Alpha/Sub2", type: "folder" },
                { name: "Beta", path: "Beta", type: "folder" },
                { name: "Shared", path: "Zeta/Shared", type: "folder" },
                { name: "c", path: "spaces://#it/languages/c", type: "tag" },
                { name: "Alpha", path: "Alpha", type: "folder" },
                { name: "Tools", path: "Workspace/Tools", type: "folder" },
                { name: "Workspace", path: "Workspace", type: "folder" },
                { name: "Content", path: "Content", type: "folder" },
                { name: "Items", path: "Beta/Items", type: "folder" },
                { name: "Shared", path: "Alpha/Shared", type: "folder" },
                { name: "Sub1", path: "Alpha/Sub1", type: "folder" },
            ]),
            spaceManager: {
                readTags: jest.fn(() => ["#it/languages/python", "#it/languages/cpp", "#it/languages/c"]),
            },
            spacesIndex: new Map([
                ["spaces://#it/languages/python", { name: "python", path: "spaces://#it/languages/python", type: "tag" }],
                ["spaces://#it/languages/cpp", { name: "cpp", path: "spaces://#it/languages/cpp", type: "tag" }],
                ["spaces://#it/languages/c", { name: "c", path: "spaces://#it/languages/c", type: "tag" }],
            ]),
            pathsIndex: new Map(),
            settings: {
                searchMenuFoldersLimit: 75,
                searchMenuTagsLimit: undefined,
                searchMenuRefsLimit: 75,
            },
            ui: {
                openMenu,
            },
        } as any;

        await showOpenMenu({ x: 0, y: 0, width: 0, height: 0 } as any, {} as any, superstate, jest.fn());

        const menuConfig = openMenu.mock.calls[0][1];
        expect(menuConfig.options[0].value).toBe("/");
        expect(menuConfig.sections.map((section: any) => section.value)).toEqual(["tags", "folders", "files"]);
        expect(menuConfig.allowNewBySection).toEqual({ tags: true });
        expect(menuConfig.editable).toBe(true);
        expect(menuConfig.centered).toBe(true);
        expect(menuConfig.optionLimitsBySection).toEqual({ tags: undefined, folders: 75, files: undefined });
        expect(menuConfig.options.filter((option: any) => option.section == "tags").map((option: any) => option.name)).toEqual(["c", "cpp", "python"]);
        expect(menuConfig.options.filter((option: any) => option.section == "folders").map((option: any) => option.value)).toEqual([
            "Alpha",
            "Beta",
            "Content",
            "Workspace",
            "Alpha/Shared",
            "Alpha/Sub1",
            "Alpha/Sub2",
            "Beta/Items",
            "Workspace/Tools",
            "Zeta/Shared",
            "Alpha/Sub1/Leaf",
        ]);
    });

    it("routes new tags through the tags section", async () => {
        const openMenu = jest.fn();
        const saveLink = jest.fn();
        const superstate = {
            allSpaces: jest.fn((): any[] => []),
            spaceManager: {
                readTags: jest.fn((): string[] => []),
            },
            spacesIndex: new Map(),
            pathsIndex: new Map(),
            settings: {},
            ui: {
                openMenu,
            },
        } as any;

        await showOpenMenu({ x: 0, y: 0, width: 0, height: 0 } as any, {} as any, superstate, saveLink);

        const menuConfig = openMenu.mock.calls[0][1];
        menuConfig.saveOptions([], ["sample"], true, "tags");

        expect(saveLink).toHaveBeenCalledWith("sample", true, "tags");
    });

    it("includes hidden items when opened in hidden mode", async () => {
        const openMenu = jest.fn();
        const superstate = {
            allSpaces: jest.fn((_ordered: boolean, hidden?: boolean) =>
                [
                    { name: "Visible", path: "Visible", type: "folder", hidden: false },
                    { name: "Hidden", path: "Hidden", type: "folder", hidden: true },
                ].filter((space) => hidden || !space.hidden),
            ),
            spaceManager: {
                readTags: jest.fn((): string[] => []),
            },
            spacesIndex: new Map(),
            pathsIndex: new Map([
                ["Visible.md", { name: "Visible", path: "Visible.md", type: "file", hidden: false }],
                ["Hidden.md", { name: "Hidden", path: "Hidden.md", type: "file", hidden: true }],
            ]),
            settings: {},
            ui: {
                openMenu,
            },
        } as any;

        await showOpenMenu({ x: 0, y: 0, width: 0, height: 0 } as any, {} as any, superstate, jest.fn(), true);

        const menuConfig = openMenu.mock.calls[0][1];
        expect(superstate.allSpaces).toHaveBeenCalledWith(true, true);
        expect(menuConfig.options).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ value: "Hidden" }),
                expect.objectContaining({ value: "Hidden.md" }),
            ]),
        );
        expect(menuConfig.getOptionsForModifiers({ shiftKey: false })).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({ value: "Hidden" }),
                expect.objectContaining({ value: "Hidden.md" }),
            ]),
        );
        expect(menuConfig.getOptionsForModifiers({ shiftKey: true })).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ value: "Hidden" }),
                expect.objectContaining({ value: "Hidden.md" }),
            ]),
        );
    });

    it("keeps hidden items out of the initial list but exposes them while Shift is held", async () => {
        const openMenu = jest.fn();
        const superstate = {
            allSpaces: jest.fn((_ordered: boolean, hidden?: boolean) =>
                [
                    { name: "Visible", path: "Visible", type: "folder", hidden: false },
                    { name: "Hidden", path: "Hidden", type: "folder", hidden: true },
                ].filter((space) => hidden || !space.hidden),
            ),
            spaceManager: {
                readTags: jest.fn((): string[] => []),
            },
            spacesIndex: new Map(),
            pathsIndex: new Map([
                ["Visible.md", { name: "Visible", path: "Visible.md", type: "file", hidden: false }],
                ["Hidden.md", { name: "Hidden", path: "Hidden.md", type: "file", hidden: true }],
            ]),
            settings: {},
            ui: {
                openMenu,
            },
        } as any;

        await showOpenMenu({ x: 0, y: 0, width: 0, height: 0 } as any, {} as any, superstate, jest.fn(), false);

        const menuConfig = openMenu.mock.calls[0][1];
        expect(menuConfig.options).not.toEqual(expect.arrayContaining([expect.objectContaining({ value: "Hidden.md" })]));
        expect(menuConfig.getOptionsForModifiers({ shiftKey: true })).toEqual(expect.arrayContaining([expect.objectContaining({ value: "Hidden.md" })]));
        expect(menuConfig.getOptionsForModifiers({ shiftKey: false })).not.toEqual(expect.arrayContaining([expect.objectContaining({ value: "Hidden.md" })]));
    });

    it("hides descendants of hidden folders until Shift is held even if their cached hidden flag is stale", async () => {
        const openMenu = jest.fn();
        const superstate = {
            allSpaces: jest.fn((_ordered: boolean, hidden?: boolean) =>
                [
                    { name: "HiddenFolder", path: "Workspace/HiddenFolder", type: "folder" },
                    { name: "ChildFolder", path: "Workspace/HiddenFolder/ChildFolder", type: "folder" },
                ].filter((space) => hidden || !space.path.startsWith("Workspace/HiddenFolder")),
            ),
            spaceManager: {
                readTags: jest.fn((): string[] => []),
            },
            spacesIndex: new Map(),
            pathsIndex: new Map([
                ["Workspace/HiddenFolder/ChildFolder.md", { name: "ChildFolder", path: "Workspace/HiddenFolder/ChildFolder.md", type: "file", hidden: false }],
            ]),
            settings: {
                hiddenExtensions: [],
                hiddenFiles: ["Workspace/HiddenFolder"],
            },
            ui: {
                openMenu,
            },
        } as any;

        await showOpenMenu({ x: 0, y: 0, width: 0, height: 0 } as any, {} as any, superstate, jest.fn(), false);

        const menuConfig = openMenu.mock.calls[0][1];
        expect(menuConfig.options).not.toEqual(expect.arrayContaining([expect.objectContaining({ value: "Workspace/HiddenFolder/ChildFolder.md" })]));
        expect(menuConfig.getOptionsForModifiers({ shiftKey: true })).toEqual(expect.arrayContaining([expect.objectContaining({ value: "Workspace/HiddenFolder/ChildFolder.md" })]));
        expect(menuConfig.getOptionsForModifiers({ shiftKey: false })).not.toEqual(expect.arrayContaining([expect.objectContaining({ value: "Workspace/HiddenFolder/ChildFolder.md" })]));
    });
});
