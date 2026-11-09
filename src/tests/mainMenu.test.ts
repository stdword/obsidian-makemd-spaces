jest.mock("main", () => jest.fn());
jest.mock("obsidian", () => ({}), { virtual: true });

import { showMainMenu } from "adapters/obsidian/ui/showMainMenu";
import i18n from "shared/i18n";
import { SelectOptionType } from "shared/types/menu";

describe("showMainMenu", () => {
    const open = (focuses: any[], currentFocus = 0) => {
        const openMenu = jest.fn((..._args: any[]) => ({ isOpen: (): boolean => false, hide: jest.fn() }));
        const openModal = jest.fn();
        const superstate = {
            focuses,
            settings: { currentFocus, expandedSpaces: [] },
            spaceManager: { saveFocuses: jest.fn() },
            saveSettings: jest.fn(),
            ui: { openMenu, openModal, openPath: jest.fn() },
        } as any;
        const el = { getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }), ownerDocument: { defaultView: {} } } as any;
        showMainMenu(el, superstate, {} as any);
        const call = openMenu.mock.calls[0] as any[];
        return { options: call[1].options as any[], openModal, superstate };
    };

    it("puts the current-focus exclusions in their own group right above Manage Hidden Items", () => {
        const { options } = open([{ name: "Work", sticker: "", paths: [] }]);
        const names = options.map((option) => option.name);
        const excluded = names.indexOf(i18n.labels.manageExcludedFromCurrentFocus);
        expect(excluded).toBeGreaterThan(-1);
        expect(options[excluded - 1].type).toBe(SelectOptionType.Separator);
        expect(options[excluded + 1].type).toBe(SelectOptionType.Separator);
        expect(names[excluded + 2]).toBe(i18n.labels.manageHiddenFiles);
    });

    it("opens the exclusions modal for the current focus", () => {
        const { options, openModal } = open([{ name: "Work", sticker: "", paths: [] }, { name: "Home", sticker: "", paths: [] }], 1);
        const item = options.find((option) => option.name == i18n.labels.manageExcludedFromCurrentFocus);
        item.onClick({ view: { document: { defaultView: {} } } });
        const [title, modal] = openModal.mock.calls[0];
        expect(title).toBe(i18n.labels.excludedItems.replace("${1}", "Home"));
        expect(modal.props.focusIndex).toBe(1);
    });

    it("omits the exclusions item when there is no current focus", () => {
        const { options } = open([], 0);
        expect(options.map((option) => option.name)).not.toContain(i18n.labels.manageExcludedFromCurrentFocus);
    });

    describe("in focus mode", () => {
        const openInFocusMode = (currentFocus = 0) => {
            const openMenu = jest.fn((..._args: any[]) => ({ isOpen: (): boolean => false, hide: jest.fn() }));
            const openModal = jest.fn();
            const superstate = {
                focuses: [{ name: "Cellar", sticker: "", paths: ["Wine"] }, { name: "Attic", sticker: "", paths: ["Boxes"] }],
                focusMode: { focus: { name: "", sticker: "", paths: ["Wine/Red", "Boxes/Toys"] }, expandedSpaces: [] as string[], origins: [] as any[] },
                settings: { currentFocus, expandedSpaces: ["Wine"] },
                spaceManager: { saveFocuses: jest.fn() },
                saveSettings: jest.fn(() => Promise.resolve()),
                dispatchEvent: jest.fn(),
                ui: { openMenu, openModal, openPath: jest.fn() },
            } as any;
            const el = { getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }), ownerDocument: { defaultView: {} } } as any;
            showMainMenu(el, superstate, {} as any);
            const options = (openMenu.mock.calls[0] as any[])[1].options as any[];
            return { options, openModal, superstate, click: (name: string) => options.find((option) => option.name == name).onClick({ view: { document: { defaultView: {} } } }) };
        };

        it("shows Exit Focus Mode instead of New Focus", () => {
            const { options } = openInFocusMode();
            const names = options.map((option) => option.name);

            expect(names[0]).toBe("Exit Focus Mode");
            expect(names).not.toContain("New Focus");
            expect(names).toContain(i18n.labels.manageExcludedFromCurrentFocus);
        });

        it("Exit Focus Mode returns to the origin focus", async () => {
            const { superstate, click } = openInFocusMode(1);

            await click("Exit Focus Mode");

            expect(superstate.focusMode).toBeNull();
            expect(superstate.settings.currentFocus).toBe(1);
        });

        it("titles the exclusions window for Focus Mode and points it at the temporary focus", () => {
            const { openModal, click } = openInFocusMode();

            click(i18n.labels.manageExcludedFromCurrentFocus);

            const [title, modal] = openModal.mock.calls[0];
            expect(title).toBe(i18n.labels.excludedItems.replace("${1}", "Focus Mode"));
            expect(modal.props.focusIndex).toBe(-1);
        });

        it("Expand All leaves the saved folding alone", () => {
            const { superstate, click } = openInFocusMode();

            click(i18n.menu.expandAllSections);

            expect(superstate.focusMode.expandedSpaces).toEqual(["Wine/Red", "Boxes/Toys"]);
            expect(superstate.settings.expandedSpaces).toEqual(["Wine"]);
        });
    });
});
