import {
    currentExpandedSpaces,
    currentFocus,
    currentFocusIndex,
    enterFocusMode,
    exitFocusMode,
    isFocusModeActive,
    setCurrentExpandedSpaces,
    updateCurrentFocus,
} from "core/utils/superstate/focusMode";
import { SPACE_SEPARATOR_PATH } from "schemas/builtin";
import { makeFocusSuperstate } from "./focusModeStub";

describe("focus mode", () => {
    it("enters focus mode with the selected paths as sections", () => {
        const s = makeFocusSuperstate();

        enterFocusMode(s, [{ path: "Recipes/Soups", originId: "Recipes/Recipes/Soups" }, { path: "Recipes/Soups" }, { path: "Tools/Saw.md" }]);

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
        const s = makeFocusSuperstate({ expandedSpaces: ["Recipes", "Recipes/Recipes/Soups"] });

        enterFocusMode(s, [{ path: "Recipes/Soups", originId: "Recipes/Recipes/Soups" }]);

        expect(currentExpandedSpaces(s)).toEqual(["Recipes/Soups"]);
        expect(s.settings.expandedSpaces).toEqual(["Recipes", "Recipes/Recipes/Soups"]);
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
        const s = makeFocusSuperstate({ expandedSpaces: ["Recipes", "Recipes/Recipes/Soups"] });
        enterFocusMode(s, [{ path: "Recipes/Soups", originId: "Recipes/Recipes/Soups" }]);

        setCurrentExpandedSpaces(s, []);
        await exitFocusMode(s);

        expect(s.settings.expandedSpaces).toEqual(["Recipes", "Recipes/Recipes/Soups"]);
    });

    it("writes collapse changes back when the setting is on", async () => {
        const s = makeFocusSuperstate({ expandedSpaces: ["Recipes"], keepExpanded: true });
        enterFocusMode(s, [{ path: "Recipes/Soups", originId: "Recipes/Recipes/Soups" }]);

        setCurrentExpandedSpaces(s, ["Recipes/Soups", "Recipes/Soups/Recipes/Soups/Cold"]);
        await exitFocusMode(s);

        expect(s.settings.expandedSpaces).toEqual(["Recipes", "Recipes/Recipes/Soups", "Recipes/Recipes/Soups/Recipes/Soups/Cold"]);
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
        enterFocusMode(s, [{ path: "Recipes/Soups", originId: "Recipes/Recipes/Soups" }]);
        enterFocusMode(s, [{ path: "Recipes/Soups/Hot", originId: "Recipes/Soups/Recipes/Soups/Hot" }]);

        setCurrentExpandedSpaces(s, ["Recipes/Soups/Hot"]);
        await exitFocusMode(s);

        expect(s.settings.expandedSpaces).toEqual(["Recipes/Recipes/Soups/Recipes/Soups/Hot"]);
    });

    it("an item with no origin place leaves no collapse state behind", async () => {
        const s = makeFocusSuperstate({ keepExpanded: true });
        enterFocusMode(s, [{ path: "Recipes/Soups", originId: "Recipes/Recipes/Soups" }]);
        await updateCurrentFocus(s, (focus) => ({ ...focus, paths: [...focus.paths, "Tools"] }));
        enterFocusMode(s, [{ path: "Tools", originId: "Tools" }]);

        setCurrentExpandedSpaces(s, ["Tools"]);
        await exitFocusMode(s);

        expect(s.settings.expandedSpaces).not.toContain("Tools");
    });
});
