import { addPathsToFocus } from "core/utils/superstate/focus";

describe("addPathsToFocus", () => {
    const focuses = [
        { name: "Work", sticker: "", paths: ["Work/Plan.md"] },
        { name: "Home", sticker: "", paths: ["Home"] },
    ] as any[];

    it("appends new paths to the target focus only, skipping ones it already has", () => {
        const result = addPathsToFocus(focuses, 1, ["Home", "Recipes"]);

        expect(result[1].paths).toEqual(["Home", "Recipes"]);
        expect(result[0]).toBe(focuses[0]);
        expect(focuses[1].paths).toEqual(["Home"]);
    });

    it("returns the focuses unchanged for an index that does not exist", () => {
        expect(addPathsToFocus(focuses, 5, ["Recipes"])).toEqual(focuses);
    });
});
