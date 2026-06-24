import { showSpacesMenu } from "core/react/components/UI/Menus/properties/selectSpaceMenu";

describe("showSpacesMenu", () => {
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

        showSpacesMenu({ x: 0, y: 0, width: 0, height: 0 } as any, {} as any, superstate, jest.fn());

        const menuConfig = openMenu.mock.calls[0][1];
        expect(menuConfig.options).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    name: "project",
                    value: "spaces://#project",
                    section: "tag",
                    icon: "hash",
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
});
