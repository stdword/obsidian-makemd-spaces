import { showLinkMenu } from "core/react/components/UI/Menus/modals/linkMenu";

describe("showLinkMenu", () => {
    it("uses the shared search menu tabs without system items", async () => {
        const openMenu = jest.fn();
        const superstate = {
            allSpaces: jest.fn(() => [
                { name: "Folder", path: "Folder", type: "folder" },
                { name: "tag", path: "spaces://#tag", type: "tag" },
            ]),
            spaceManager: {
                readTags: jest.fn((): string[] => []),
            },
            spacesIndex: new Map(),
            pathsIndex: new Map([
                ["/", { name: "Home", path: "/", type: "space", subtype: "vault", hidden: false }],
                ["Folder", { name: "Folder", path: "Folder", type: "space", subtype: "folder", hidden: false }],
                ["Note.md", { name: "Note", path: "Note.md", type: "file", subtype: "md", hidden: false }],
                ["spaces://#tag", { name: "tag", path: "spaces://#tag", type: "space", subtype: "tag", hidden: false }],
            ]),
            settings: {
                searchMenuFoldersLimit: 75,
                searchMenuFilesLimit: 75,
            },
            ui: {
                openMenu,
            },
        } as any;

        await showLinkMenu({ x: 0, y: 0, width: 0, height: 0 } as any, {} as any, superstate, jest.fn());

        const menuConfig = openMenu.mock.calls[0][1];
        expect(menuConfig.sections.map((section: any) => section.value)).toEqual(["tags", "folders", "files"]);
        expect(menuConfig.editable).toBe(false);
        expect(menuConfig.allowNewBySection).toEqual({ tags: true });
        expect(menuConfig.centered).toBe(true);
        expect(menuConfig.optionLimitsBySection).toEqual({ tags: undefined, folders: 75, files: 75 });
        expect(menuConfig.options.map((option: any) => option.value)).toEqual(["Folder", "Note.md"]);
        expect(menuConfig.options.map((option: any) => option.section)).toEqual(["folders", "files"]);
    });

    it("passes the selected path as a string when an item is chosen", async () => {
        const openMenu = jest.fn();
        const saveLink = jest.fn();
        const superstate = {
            allSpaces: jest.fn(() => [{ name: "Folder", path: "Folder", type: "folder" }]),
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

        await showLinkMenu({ x: 0, y: 0, width: 0, height: 0 } as any, {} as any, superstate, saveLink);

        const menuConfig = openMenu.mock.calls[0][1];
        menuConfig.saveOptions(["Folder"], ["Folder"]);

        expect(saveLink).toHaveBeenCalledWith("Folder");
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

        await showLinkMenu({ x: 0, y: 0, width: 0, height: 0 } as any, {} as any, superstate, jest.fn(), true);

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
});
