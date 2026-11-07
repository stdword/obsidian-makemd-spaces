import { copyPathMenuOption, copyPathMenuOptions } from "core/react/components/UI/Menus/navigator/copyPathMenu";
import i18n from "shared/i18n";
import { SelectOptionType } from "shared/types/menu";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const makeSuperstate = () => ({
    ui: {
        openMenu: jest.fn(),
        notify: jest.fn(),
        appUrlForPath: jest.fn((path: string) => `obsidian://open?vault=Garden&file=${encodeURIComponent(path)}`),
        systemPathForPath: jest.fn((path: string) => `/Users/kim/Garden/${path}`),
    },
});

const makeWindow = () => ({ navigator: { clipboard: { writeText: jest.fn(() => Promise.resolve()) } } }) as unknown as Window;

describe("copyPathMenuOptions", () => {
    it("copies the Obsidian URL, the vault-relative path and the system path", async () => {
        const superstate = makeSuperstate();
        const win = makeWindow();
        const options = copyPathMenuOptions(superstate as any, "Trips/Norway.md", win);

        expect(options.map((option) => option.name)).toEqual([i18n.menu.copyPathAsUrl, i18n.menu.copyPathFromVault, i18n.menu.copyPathFromRoot]);

        for (const option of options) await option.onClick(null as any);
        await flush();

        const writeText = (win.navigator.clipboard.writeText as jest.Mock).mock.calls.map((call) => call[0]);
        expect(writeText).toEqual(["obsidian://open?vault=Garden&file=Trips%2FNorway.md", "Trips/Norway.md", "/Users/kim/Garden/Trips/Norway.md"]);
        expect(superstate.ui.notify).toHaveBeenCalledTimes(3);
        expect(superstate.ui.notify).toHaveBeenCalledWith(i18n.notice.pathCopied);
    });
});

describe("copyPathMenuOption", () => {
    it("opens the three copy entries as a submenu", () => {
        const superstate = makeSuperstate();
        const win = makeWindow();
        const option = copyPathMenuOption(superstate as any, "Trips", win);

        expect(option.name).toBe(i18n.menu.copyPath);
        expect(option.type).toBe(SelectOptionType.Submenu);

        const onHide = jest.fn();
        option.onSubmenu({ x: 1, y: 2, width: 3, height: 4 } as any, onHide);

        const [rect, menuProps, menuWin, anchor, hide] = superstate.ui.openMenu.mock.calls[0];
        expect(rect).toEqual({ x: 1, y: 2, width: 3, height: 4 });
        expect(menuProps.options.map((o: any) => o.name)).toEqual([i18n.menu.copyPathAsUrl, i18n.menu.copyPathFromVault, i18n.menu.copyPathFromRoot]);
        expect(menuWin).toBe(win);
        expect(anchor).toBe("right");
        expect(hide).toBe(onHide);
    });
});
