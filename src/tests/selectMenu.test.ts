import { applySectionLimits, escapeActionForQuery, maxSuggestionsLengthForMenu, prioritizeSearchMatches, verticalDeltaForShiftWheel } from "core/react/components/UI/Menus/menu/selectMenuLimits";

describe("SelectMenu", () => {
    it("does not cap suggestions when showAll is enabled", () => {
        expect(maxSuggestionsLengthForMenu(true, 105)).toBe(105);
    });

    it("uses the compact suggestion limit when showAll is disabled", () => {
        expect(maxSuggestionsLengthForMenu(false, 105)).toBe(25);
    });

    it("applies limits independently for each section in all view", () => {
        const options = [
            { name: "tag-1", value: "tag-1", section: "tag" },
            { name: "tag-2", value: "tag-2", section: "tag" },
            { name: "folder-1", value: "folder-1", section: "folder" },
            { name: "folder-2", value: "folder-2", section: "folder" },
            { name: "file-1", value: "file-1", section: "file" },
            { name: "file-2", value: "file-2", section: "file" },
        ];

        expect(applySectionLimits(options, "", { folder: 1, file: 1 }).map((option) => option.value)).toEqual(["tag-1", "tag-2", "folder-1", "file-1"]);
    });

    it("applies only the selected section limit in section view", () => {
        const options = [
            { name: "folder-1", value: "folder-1", section: "folder" },
            { name: "folder-2", value: "folder-2", section: "folder" },
        ];

        expect(applySectionLimits(options, "folder", { folder: 1 }).map((option) => option.value)).toEqual(["folder-1"]);
    });

    it("clears query on Escape before allowing the menu to close", () => {
        expect(escapeActionForQuery("obsidian")).toBe("clear");
        expect(escapeActionForQuery("")).toBe("close");
    });

    it("prioritizes search matches in names before matches in descriptions or paths", () => {
        const options = [
            { name: "Notes", value: "Atlas/Obsidian/Notes", description: "Atlas/Obsidian/", section: "folders" },
            { name: "Plugins", value: "Atlas/Obsidian/Plugins", description: "Atlas/Obsidian/", section: "folders" },
            { name: "Obsidian", value: "Assets/Content/Obsidian", description: "Assets/Content/", section: "folders" },
        ];

        expect(prioritizeSearchMatches(options, "obsid").map((option) => option.name)).toEqual(["Obsidian", "Notes", "Plugins"]);
    });

    it("uses wheel delta as vertical scroll delta while Shift is held", () => {
        expect(verticalDeltaForShiftWheel(48, 0)).toBe(48);
        expect(verticalDeltaForShiftWheel(0, 48)).toBe(48);
    });
});
