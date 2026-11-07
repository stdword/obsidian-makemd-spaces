import { buildContextMenu, menuItems } from "core/react/components/UI/Menus/navigator/contextMenuItems";
import i18n from "shared/i18n";
import { SelectOptionType } from "shared/types/menu";

const baseTarget = () =>
    ({
        superstate: { ui: { getOS: () => "mac", hasNativePathMenu: () => true, openModal: jest.fn(), openPath: jest.fn() } },
        win: {} as Window,
        paths: ["Projects/Plan.md"],
    }) as any;

describe("buildContextMenu", () => {
    it("joins non-empty groups with exactly one separator and skips items whose condition fails", () => {
        const target = { ...baseTarget(), excludeFromFocus: true };
        const options = buildContextMenu(target, [
            [menuItems.openInTab],
            [menuItems.changeColor, menuItems.pin], // both conditions fail -> group vanishes
            [{ name: "Custom" }, null, false, menuItems.excludeFromFocus],
            [],
        ]);

        expect(options.map((option) => option.name)).toEqual([i18n.menu.openInATab, "", "Custom", i18n.menu.excludeFromFocus]);
        expect(options[1].type).toBe(SelectOptionType.Separator);
    });

    it("never starts or ends with a separator", () => {
        const options = buildContextMenu(baseTarget(), [[menuItems.changeColor], [menuItems.openInTab], [menuItems.pin]]);
        expect(options.map((option) => option.name)).toEqual([i18n.menu.openInATab]);
    });
});

describe("menu items", () => {
    it("labels pin by whether every path is already pinned in the parent space", () => {
        const parent = { path: "Projects", metadata: { pinned: ["Projects/Plan.md"] } };
        const pinned = menuItems.pin.build({ ...baseTarget(), parent }) as any;
        expect(pinned.name).toBe(i18n.menu.unpin);

        const mixed = menuItems.pin.build({ ...baseTarget(), parent, paths: ["Projects/Plan.md", "Projects/Notes.md"] }) as any;
        expect(mixed.name).toBe(i18n.menu.pinToTop);
        expect(menuItems.pin.when({ ...baseTarget(), parent, isSection: true })).toBe(false);
    });

    it("opens the confirmation modal with the target's title and runs its action", () => {
        const action = jest.fn();
        const target = { ...baseTarget(), remove: { title: "Delete Plan", message: "Sure?", action } };
        const item = menuItems.delete.build(target) as any;

        item.onClick({ view: undefined });

        const [title, modal] = target.superstate.ui.openModal.mock.calls[0];
        expect(title).toBe("Delete Plan");
        modal.props.confirmAction();
        expect(action).toHaveBeenCalled();
    });

    it("reveals in the system file manager only when a system path is given", () => {
        expect(menuItems.revealInSystem.when(baseTarget())).toBe(false);
        const item = menuItems.revealInSystem.build({ ...baseTarget(), systemPath: "Projects" }) as any;
        expect(item.name).toBe(i18n.menu.revealInDefault);
    });
});
