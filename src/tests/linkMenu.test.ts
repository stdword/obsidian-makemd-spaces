import { showLinkMenu } from "core/react/components/UI/Menus/modals/linkMenu";

describe("showLinkMenu", () => {
    it("uses the shared search menu tabs without system, tags, or new item creation", () => {
        const openMenu = jest.fn();
        const superstate = {
            pathsIndex: new Map([
                ["/", { name: "Home", path: "/", type: "space", subtype: "vault", label: {}, hidden: false }],
                ["Folder", { name: "Folder", path: "Folder", type: "space", subtype: "folder", label: {}, hidden: false }],
                ["Note.md", { name: "Note", path: "Note.md", type: "file", subtype: "md", label: {}, hidden: false }],
                ["spaces://#tag", { name: "tag", path: "spaces://#tag", type: "space", subtype: "tag", label: {}, hidden: false }],
            ]),
            settings: {
                searchMenuFoldersLimit: 75,
                searchMenuFilesLimit: 75,
            },
            ui: {
                openMenu,
            },
        } as any;

        showLinkMenu({ x: 0, y: 0, width: 0, height: 0 } as any, {} as any, superstate, jest.fn());

        const menuConfig = openMenu.mock.calls[0][1];
        expect(menuConfig.sections.map((section: any) => section.value)).toEqual(["folders", "files"]);
        expect(menuConfig.editable).toBe(false);
        expect(menuConfig.allowNewBySection).toEqual({});
        expect(menuConfig.centered).toBe(true);
        expect(menuConfig.optionLimitsBySection).toEqual({ folders: 75, files: 75 });
        expect(menuConfig.options.map((option: any) => option.value)).toEqual(["Folder", "Note.md"]);
        expect(menuConfig.options.map((option: any) => option.section)).toEqual(["folders", "files"]);
    });
});
