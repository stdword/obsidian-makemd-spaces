import {
    currentExpandedSpaces,
    currentFocus,
    currentFocusIndex,
    enterFocusMode,
    exitFocusMode,
    focusTabContextMenu,
    focusTabPointerDown,
    isFocusTabContextClick,
    isFocusModeActive,
    removeFocusModePath,
    renameFocusModePath,
    setCurrentExpandedSpaces,
    updateCurrentFocus,
} from "core/utils/superstate/focusMode";
import { SPACE_SEPARATOR_PATH } from "schemas/builtin";
import { linkExpandKey, sectionExpandKey } from "core/utils/superstate/expandKeys";
import { makeFocusSuperstate } from "./focusModeStub";

// The temporary focus has no name.
const tempSection = (path: string) => sectionExpandKey("", path);
const kitchen = sectionExpandKey("Kitchen", "Recipes");

describe("focus mode", () => {
    it("enters focus mode with the selected paths as sections", () => {
        const s = makeFocusSuperstate();

        enterFocusMode(s, [{ path: "Recipes/Soups", originKey: "Recipes/Soups" }, { path: "Recipes/Soups" }, { path: "Tools/Saw.md" }]);

        expect(currentFocus(s).paths).toEqual(["Recipes/Soups", "Tools/Saw.md"]);
        expect(currentFocus(s)["excluded-paths"]).toBeUndefined();
        expect(currentFocusIndex(s)).toBe(-1);
        expect(s.settings.currentFocus).toBe(0);
        expect(s.spaceManager.saveFocuses).not.toHaveBeenCalled();
    });

    it("does nothing when there is nothing to focus on", () => {
        const s = makeFocusSuperstate();

        enterFocusMode(s, []);

        expect(isFocusModeActive(s)).toBe(false);
    });

    it("keeps the collapsed state the items had before entry", () => {
        const saved = [kitchen, "Recipes/Soups", "Recipes/Soups/Cold", linkExpandKey("Recipes/Soups", "Tools"), "Recipes/Salads"];
        const s = makeFocusSuperstate({ expandedSpaces: saved });

        enterFocusMode(s, [{ path: "Recipes/Soups", originKey: "Recipes/Soups" }]);

        expect(currentExpandedSpaces(s)).toEqual([tempSection("Recipes/Soups"), "Recipes/Soups/Cold", linkExpandKey("Recipes/Soups", "Tools")]);
        expect(s.settings.expandedSpaces).toEqual(saved);
    });

    it("opens a section collapsed when its row was collapsed", () => {
        const s = makeFocusSuperstate({ expandedSpaces: [kitchen, "Recipes/Soups/Cold"] });

        enterFocusMode(s, [{ path: "Recipes/Soups", originKey: "Recipes/Soups" }]);

        expect(currentExpandedSpaces(s)).toEqual(["Recipes/Soups/Cold"]);
    });

    it("takes the state of the row that was picked, not of the same folder shown elsewhere", () => {
        const s = makeFocusSuperstate({ expandedSpaces: ["Tools"] });

        enterFocusMode(s, [{ path: "Tools", originKey: linkExpandKey("Recipes", "Tools") }]);

        expect(currentExpandedSpaces(s)).toEqual([]);
    });

    it("changes inside focus mode never reach saveFocuses", async () => {
        const s = makeFocusSuperstate();
        const regular = s.focuses;
        enterFocusMode(s, [{ path: "Recipes/Soups" }]);

        await updateCurrentFocus(s, (focus) => ({ ...focus, paths: [...focus.paths, "Tools"] }));

        expect(currentFocus(s).paths).toEqual(["Recipes/Soups", "Tools"]);
        expect(s.spaceManager.saveFocuses).not.toHaveBeenCalled();
        expect(s.focuses).toBe(regular);
    });

    it("closes itself when the last section is removed", async () => {
        const s = makeFocusSuperstate();
        enterFocusMode(s, [{ path: "Recipes/Soups" }]);

        await updateCurrentFocus(s, (focus) => ({ ...focus, paths: [] }));

        expect(isFocusModeActive(s)).toBe(false);
        expect(currentFocusIndex(s)).toBe(0);
    });

    it("stays open while only a separator is removed", async () => {
        const s = makeFocusSuperstate();
        enterFocusMode(s, [{ path: "Recipes/Soups" }]);
        await updateCurrentFocus(s, (focus) => ({ ...focus, paths: [...focus.paths, SPACE_SEPARATOR_PATH] }));

        await updateCurrentFocus(s, (focus) => ({ ...focus, paths: ["Recipes/Soups"] }));

        expect(isFocusModeActive(s)).toBe(true);
    });

    it("closes when only separators remain", async () => {
        const s = makeFocusSuperstate();
        enterFocusMode(s, [{ path: "Recipes/Soups" }]);

        await updateCurrentFocus(s, (focus) => ({ ...focus, paths: [SPACE_SEPARATOR_PATH] }));

        expect(isFocusModeActive(s)).toBe(false);
    });

    it("exit returns to the origin focus", async () => {
        const s = makeFocusSuperstate({ currentFocus: 1 });
        enterFocusMode(s, [{ path: "Recipes/Soups" }]);

        await exitFocusMode(s);

        expect(currentFocus(s).name).toBe("Workshop");
    });

    it("exit to a chosen focus", async () => {
        const s = makeFocusSuperstate();
        enterFocusMode(s, [{ path: "Recipes/Soups" }]);

        await exitFocusMode(s, 1);

        expect(s.settings.currentFocus).toBe(1);
        expect(isFocusModeActive(s)).toBe(false);
    });

    it("exit falls back to the first unarchived focus", async () => {
        const s = makeFocusSuperstate({ currentFocus: 0 });
        enterFocusMode(s, [{ path: "Tools/Saw.md" }]);
        s.focuses = [{ ...s.focuses[0], archived: true }, s.focuses[1]];

        await exitFocusMode(s);

        expect(currentFocus(s).name).toBe("Workshop");
    });

    it("survives an external reload of the focus list", () => {
        const s = makeFocusSuperstate();
        enterFocusMode(s, [{ path: "Recipes/Soups" }]);

        s.focuses = [{ name: "Pantry", sticker: "", paths: ["Jars"] }];

        expect(isFocusModeActive(s)).toBe(true);
        expect(currentFocus(s).paths).toEqual(["Recipes/Soups"]);
    });

    it("discards collapse changes on exit by default", async () => {
        const s = makeFocusSuperstate({ expandedSpaces: [kitchen, "Recipes/Soups"] });
        enterFocusMode(s, [{ path: "Recipes/Soups", originKey: "Recipes/Soups" }]);

        setCurrentExpandedSpaces(s, []);
        await exitFocusMode(s);

        expect(s.settings.expandedSpaces).toEqual([kitchen, "Recipes/Soups"]);
    });

    it("writes collapse changes back when the setting is on", async () => {
        const s = makeFocusSuperstate({ expandedSpaces: [kitchen, "Recipes/Soups/Hot", "Recipes/Salads"], keepExpanded: true });
        enterFocusMode(s, [{ path: "Recipes/Soups", originKey: "Recipes/Soups" }]);

        setCurrentExpandedSpaces(s, [tempSection("Recipes/Soups"), "Recipes/Soups/Cold"]);
        await exitFocusMode(s);

        expect(s.settings.expandedSpaces).toEqual([kitchen, "Recipes/Salads", "Recipes/Soups", "Recipes/Soups/Cold"]);
    });

    it("writes a section's state back to the link it was picked from", async () => {
        const link = linkExpandKey("Recipes", "Tools");
        const s = makeFocusSuperstate({ expandedSpaces: ["Tools"], keepExpanded: true });
        enterFocusMode(s, [{ path: "Tools", originKey: link }]);

        setCurrentExpandedSpaces(s, [tempSection("Tools")]);
        await exitFocusMode(s);

        expect(s.settings.expandedSpaces).toEqual(["Tools", link]);
    });

    it("replacing focus mode keeps the original origin", async () => {
        const s = makeFocusSuperstate({ currentFocus: 1 });
        enterFocusMode(s, [{ path: "Recipes/Soups" }]);
        await updateCurrentFocus(s, (focus) => ({ ...focus, "excluded-paths": ["Recipes/Soups/Cold"] }));

        enterFocusMode(s, [{ path: "Recipes/Soups/Hot" }]);

        expect(currentFocus(s).paths).toEqual(["Recipes/Soups/Hot"]);
        expect(currentFocus(s)["excluded-paths"]).toBeUndefined();
        await exitFocusMode(s);
        expect(currentFocus(s).name).toBe("Workshop");
    });

    it("carries collapse state through a replaced focus mode back to the regular tree", async () => {
        const s = makeFocusSuperstate({ keepExpanded: true });
        enterFocusMode(s, [{ path: "Recipes/Soups", originKey: "Recipes/Soups" }]);
        enterFocusMode(s, [{ path: "Recipes/Soups/Hot", originKey: "Recipes/Soups/Hot" }]);

        setCurrentExpandedSpaces(s, [tempSection("Recipes/Soups/Hot")]);
        await exitFocusMode(s);

        expect(s.settings.expandedSpaces).toEqual(["Recipes/Soups/Hot"]);
    });

    it("resolves a temporary section picked again to the row it first came from", async () => {
        const s = makeFocusSuperstate({ keepExpanded: true });
        enterFocusMode(s, [{ path: "Recipes/Soups", originKey: "Recipes/Soups" }, { path: "Tools", originKey: linkExpandKey("Recipes", "Tools") }]);
        enterFocusMode(s, [{ path: "Tools", originKey: tempSection("Tools") }]);

        setCurrentExpandedSpaces(s, [tempSection("Tools")]);
        await exitFocusMode(s);

        expect(s.settings.expandedSpaces).toEqual([linkExpandKey("Recipes", "Tools")]);
    });

    it("an item with no origin place leaves no collapse state behind", async () => {
        const s = makeFocusSuperstate({ keepExpanded: true });
        enterFocusMode(s, [{ path: "Recipes/Soups", originKey: "Recipes/Soups" }]);
        await updateCurrentFocus(s, (focus) => ({ ...focus, paths: [...focus.paths, "Tools"] }));
        enterFocusMode(s, [{ path: "Tools", originKey: tempSection("Tools") }]);

        setCurrentExpandedSpaces(s, [tempSection("Tools")]);
        await exitFocusMode(s);

        expect(s.settings.expandedSpaces).toEqual([]);
    });

    it("renaming a temporary section keeps it in the tree", async () => {
        const s = makeFocusSuperstate({ expandedSpaces: ["Recipes/Soups"] });
        enterFocusMode(s, [{ path: "Recipes/Soups", originKey: "Recipes/Soups" }]);
        await updateCurrentFocus(s, (focus) => ({ ...focus, "excluded-paths": ["Recipes/Soups/Cold"] }));

        renameFocusModePath(s, "Recipes/Soups", "Recipes/Broths");

        expect(currentFocus(s).paths).toEqual(["Recipes/Broths"]);
        expect(currentFocus(s)["excluded-paths"]).toEqual(["Recipes/Broths/Cold"]);
        expect(currentExpandedSpaces(s)).toEqual([tempSection("Recipes/Broths")]);
        expect(s.focusMode.origins).toEqual([{ path: "Recipes/Broths", originKey: "Recipes/Broths" }]);
        expect(s.spaceManager.saveFocuses).not.toHaveBeenCalled();
    });

    it("keeps a section's place in the regular tree when an unrelated folder takes a matching name", () => {
        const s = makeFocusSuperstate();
        enterFocusMode(s, [{ path: "Work/Notes", originKey: "Work/Notes" }]);

        renameFocusModePath(s, "Archive", "Notes");

        expect(s.focusMode.origins).toEqual([{ path: "Work/Notes", originKey: "Work/Notes" }]);
    });

    it("renaming a parent folder keeps a nested temporary section", () => {
        const s = makeFocusSuperstate();
        enterFocusMode(s, [{ path: "Recipes/Soups/Hot" }]);

        renameFocusModePath(s, "Recipes/Soups", "Recipes/Broths");

        expect(currentFocus(s).paths).toEqual(["Recipes/Broths/Hot"]);
    });

    it("deleting the only temporary section closes focus mode", async () => {
        const s = makeFocusSuperstate();
        enterFocusMode(s, [{ path: "Recipes/Soups" }]);

        await removeFocusModePath(s, "Recipes/Soups");

        expect(isFocusModeActive(s)).toBe(false);
    });

    it("deleting one of several temporary sections keeps the rest", async () => {
        const s = makeFocusSuperstate();
        enterFocusMode(s, [{ path: "Recipes/Soups" }, { path: "Tools/Saw.md" }]);

        await removeFocusModePath(s, "Tools/Saw.md");

        expect(currentFocus(s).paths).toEqual(["Recipes/Soups"]);
    });

    describe("regular focus tabs", () => {
        it("pressing a regular focus tab leaves focus mode for that focus", () => {
            const s = makeFocusSuperstate();
            enterFocusMode(s, [{ path: "Recipes/Soups" }]);

            expect(focusTabPointerDown(s, 1, { button: 0, ctrlKey: false })).toBe(true);

            expect(isFocusModeActive(s)).toBe(false);
            expect(s.settings.currentFocus).toBe(1);
        });

        it("a right-button press does not switch focus", () => {
            const s = makeFocusSuperstate();
            enterFocusMode(s, [{ path: "Recipes/Soups" }]);

            expect(focusTabPointerDown(s, 1, { button: 2, ctrlKey: false })).toBe(false);

            expect(isFocusModeActive(s)).toBe(true);
        });

        it("ctrl+click outside macOS is an ordinary press that switches focus", () => {
            const s = makeFocusSuperstate();
            s.ui.getOS = () => "windows";
            enterFocusMode(s, [{ path: "Recipes/Soups" }]);

            expect(focusTabPointerDown(s, 1, { button: 0, ctrlKey: true })).toBe(true);

            expect(isFocusModeActive(s)).toBe(false);
            expect(s.settings.currentFocus).toBe(1);
        });

        it("tells a macOS ctrl+click apart from a plain click", () => {
            const mac = makeFocusSuperstate();
            mac.ui.getOS = () => "mac";
            const windows = makeFocusSuperstate();
            windows.ui.getOS = () => "windows";

            expect(isFocusTabContextClick(mac, { button: 0, ctrlKey: true })).toBe(true);
            expect(isFocusTabContextClick(mac, { button: 0, ctrlKey: false })).toBe(false);
            expect(isFocusTabContextClick(mac, { button: 2, ctrlKey: false })).toBe(true);
            expect(isFocusTabContextClick(windows, { button: 0, ctrlKey: true })).toBe(false);
        });

        it("ctrl+click is a right click, not a switch", () => {
            const s = makeFocusSuperstate();
            s.ui.getOS = () => "mac";
            enterFocusMode(s, [{ path: "Recipes/Soups" }]);

            expect(focusTabPointerDown(s, 1, { button: 0, ctrlKey: true })).toBe(false);

            expect(isFocusModeActive(s)).toBe(true);
        });

        it("right click only closes focus mode", () => {
            const s = makeFocusSuperstate({ currentFocus: 0 });
            enterFocusMode(s, [{ path: "Tools/Saw.md" }]);

            expect(focusTabContextMenu(s)).toBe(true);

            expect(isFocusModeActive(s)).toBe(false);
            expect(s.settings.currentFocus).toBe(0);
            expect(focusTabContextMenu(s)).toBe(false);
        });

        it("tab presses outside focus mode are left alone", () => {
            const s = makeFocusSuperstate();

            expect(focusTabPointerDown(s, 1, { button: 0, ctrlKey: false })).toBe(false);
            expect(focusTabContextMenu(s)).toBe(false);

            expect(s.settings.currentFocus).toBe(0);
            expect(s.saveSettings).not.toHaveBeenCalled();
        });
    });
});
