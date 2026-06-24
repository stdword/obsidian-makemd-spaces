import { showOpenMenu } from "core/react/components/UI/Menus/modals/selectSpaceMenu";

describe("showOpenMenu", () => {
    it("includes tag spaces even though their paths use the spaces protocol", () => {
        const openMenu = jest.fn();
        const superstate = {
            allSpaces: jest.fn(() => [
                { name: "project", path: "spaces://#project", type: "tag" },
                { name: "Internal", path: "spaces://$tags", type: "default" },
                { name: "Folder", path: "Folder", type: "folder" },
            ]),
            pathsIndex: new Map(),
            ui: {
                openMenu,
            },
        } as any;

        showOpenMenu({ x: 0, y: 0, width: 0, height: 0 } as any, {} as any, superstate, jest.fn());

        const menuConfig = openMenu.mock.calls[0][1];
        expect(menuConfig.options).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    name: "project",
                    value: "spaces://#project",
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
            ]),
        );
    });

    it("sorts tags by name and folders by parent section depth", () => {
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
                { name: "Applications", path: "Atlas/Applications", type: "folder" },
                { name: "Atlas", path: "Atlas", type: "folder" },
                { name: "Content", path: "Content", type: "folder" },
                { name: "Items", path: "Beta/Items", type: "folder" },
                { name: "Shared", path: "Alpha/Shared", type: "folder" },
                { name: "Sub1", path: "Alpha/Sub1", type: "folder" },
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

        showOpenMenu({ x: 0, y: 0, width: 0, height: 0 } as any, {} as any, superstate, jest.fn());

        const menuConfig = openMenu.mock.calls[0][1];
        expect(menuConfig.options[0].value).toBe("/");
        expect(menuConfig.sections.map((section: any) => section.value)).toEqual(["folders", "tags", "refs"]);
        expect(menuConfig.allowNewBySection).toEqual({ tags: true, refs: true });
        expect(menuConfig.editable).toBe(true);
        expect(menuConfig.centered).toBe(true);
        expect(menuConfig.optionLimitsBySection).toEqual({ tags: undefined, folders: 75, refs: 75 });
        expect(menuConfig.options.filter((option: any) => option.section == "tags").map((option: any) => option.name)).toEqual(["c", "cpp", "python"]);
        expect(menuConfig.options.filter((option: any) => option.section == "folders").map((option: any) => option.value)).toEqual([
            "Alpha",
            "Atlas",
            "Beta",
            "Content",
            "Alpha/Shared",
            "Alpha/Sub1",
            "Alpha/Sub2",
            "Atlas/Applications",
            "Beta/Items",
            "Zeta/Shared",
            "Alpha/Sub1/Leaf",
        ]);
    });

    it("routes new tags through the tags section", () => {
        const openMenu = jest.fn();
        const saveLink = jest.fn();
        const superstate = {
            allSpaces: jest.fn((): any[] => []),
            pathsIndex: new Map(),
            settings: {},
            ui: {
                openMenu,
            },
        } as any;

        showOpenMenu({ x: 0, y: 0, width: 0, height: 0 } as any, {} as any, superstate, saveLink);

        const menuConfig = openMenu.mock.calls[0][1];
        menuConfig.saveOptions([], ["project"], true, "tags");

        expect(saveLink).toHaveBeenCalledWith("project", true, "tags");
    });
});
