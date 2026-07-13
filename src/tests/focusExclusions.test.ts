import { excludePathsFromCurrentFocus, excludePathsFromFocus, isPathExcludedFromFocus, removeExcludedPathFromFocus } from "core/utils/superstate/focus";
import { renameFocusExcludedPaths } from "shared/types/focus";
import { renameExpandedSpacePaths } from "shared/types/settings";

describe("focus exclusions", () => {
    it("matches only the exact excluded path", () => {
        const excluded = ["Projects/Private", "spaces://#internal"];

        expect(isPathExcludedFromFocus("Projects/Private", excluded)).toBe(true);
        expect(isPathExcludedFromFocus("Projects/Private/Plan.md", excluded)).toBe(false);
        expect(isPathExcludedFromFocus("Projects/Privateer.md", excluded)).toBe(false);
        expect(isPathExcludedFromFocus("spaces://#internal/archive", excluded)).toBe(false);
        expect(isPathExcludedFromFocus("spaces://#internal-tools", excluded)).toBe(false);
    });

    it("saves unique paths only on the current focus", async () => {
        const saveFocuses = jest.fn(() => Promise.resolve());
        const superstate = {
            settings: { currentFocus: 1 },
            focuses: [
                { name: "Home", sticker: "", paths: ["/"] },
                { name: "Work", sticker: "", paths: ["Projects"], "excluded-paths": ["Projects/Old.md"] },
            ],
            spaceManager: { saveFocuses },
        } as any;

        await excludePathsFromCurrentFocus(superstate, ["Projects/Old.md", "Projects/Draft.md"]);

        expect(saveFocuses).toHaveBeenCalledWith([
            superstate.focuses[0],
            expect.objectContaining({ "excluded-paths": ["Projects/Old.md", "Projects/Draft.md"] }),
        ]);
    });

    it("adds and removes exclusions using the original focus index", async () => {
        const saveFocuses = jest.fn(() => Promise.resolve());
        const superstate = {
            settings: { currentFocus: 0 },
            focuses: [
                { name: "Archived", sticker: "", paths: [], archived: true },
                { name: "Research", sticker: "", paths: ["Notes"], "excluded-paths": ["Notes/Old.md"] },
            ],
            spaceManager: { saveFocuses },
        } as any;

        await excludePathsFromFocus(superstate, 1, ["Notes/Draft.md"]);
        expect(saveFocuses).toHaveBeenLastCalledWith([
            superstate.focuses[0],
            expect.objectContaining({ "excluded-paths": ["Notes/Old.md", "Notes/Draft.md"] }),
        ]);

        await removeExcludedPathFromFocus(superstate, 1, "Notes/Old.md");
        expect(saveFocuses).toHaveBeenLastCalledWith([
            superstate.focuses[0],
            expect.objectContaining({ "excluded-paths": [] }),
        ]);
    });

    it("renames exact exclusions and descendants without changing sibling prefixes", () => {
        expect(renameFocusExcludedPaths(
            ["Projects/Private", "Projects/Private/Plan.md", "Projects/Privateer/Plan.md"],
            "Projects/Private",
            "Archive/Private",
        )).toEqual([
            "Archive/Private",
            "Archive/Private/Plan.md",
            "Projects/Privateer/Plan.md",
        ]);
    });

    it("renames tag exclusions and removes duplicates created by the rename", () => {
        expect(renameFocusExcludedPaths(
            ["spaces://#draft", "spaces://#draft/review", "spaces://#published"],
            "spaces://#draft",
            "spaces://#published",
        )).toEqual([
            "spaces://#published",
            "spaces://#published/review",
        ]);
    });

    it("moves expanded state to the renamed path and removes stale destination state", () => {
        expect(renameExpandedSpacePaths([
            "Atlas/Applications",
            "Atlas/Applications/Atlas/Applications/Notes",
            "Atlas/Applications1",
            "Atlas/Applications1/Atlas/Applications1/Legacy",
            "Atlas/Applications2",
        ], "Atlas/Applications", "Atlas/Applications1")).toEqual([
            "Atlas/Applications2",
            "Atlas/Applications1",
            "Atlas/Applications1/Atlas/Applications1/Notes",
        ]);
    });

    it("keeps a renamed folder collapsed when only the destination has stale expanded state", () => {
        expect(renameExpandedSpacePaths([
            "Atlas/Applications1",
            "Atlas/Applications1/Atlas/Applications1/Legacy",
            "Atlas/AI",
        ], "Atlas/Applications", "Atlas/Applications1")).toEqual(["Atlas/AI"]);
    });
});
