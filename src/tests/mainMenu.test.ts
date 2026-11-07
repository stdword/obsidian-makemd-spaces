jest.mock("main", () => jest.fn());
jest.mock("obsidian", () => ({}), { virtual: true });

import { showMainMenu } from "adapters/obsidian/ui/showMainMenu";
import i18n from "shared/i18n";

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

    it("lists Manage Excluded Items right after Manage Hidden Items", () => {
        const { options } = open([{ name: "Work", sticker: "", paths: [] }]);
        const names = options.map((option) => option.name);
        const hidden = names.indexOf(i18n.labels.manageHiddenFiles);
        expect(hidden).toBeGreaterThan(-1);
        expect(names[hidden + 1]).toBe(i18n.labels.manageExcludedFiles);
    });

    it("opens the exclusions modal for the current focus", () => {
        const { options, openModal } = open([{ name: "Work", sticker: "", paths: [] }, { name: "Home", sticker: "", paths: [] }], 1);
        const item = options.find((option) => option.name == i18n.labels.manageExcludedFiles);
        item.onClick({ view: { document: { defaultView: {} } } });
        const [title, modal] = openModal.mock.calls[0];
        expect(title).toBe(i18n.labels.excludedItems.replace("${1}", "Home"));
        expect(modal.props.focusIndex).toBe(1);
    });

    it("omits the exclusions item when there is no current focus", () => {
        const { options } = open([], 0);
        expect(options.map((option) => option.name)).not.toContain(i18n.labels.manageExcludedFiles);
    });
});
