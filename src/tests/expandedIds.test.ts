import { translateExpandedIds, writeBackExpandedIds } from "core/utils/superstate/expandedIds";

describe("expanded id translation", () => {
    it("moves a subtree's expanded state to its new root", () => {
        expect(translateExpandedIds(["Lab", "Lab/Lab/Notes", "Lab/Lab/Notes/Lab/Notes/Old", "Garden"], [{ from: "Lab/Lab/Notes", to: "Lab/Notes" }]))
            .toEqual(["Lab/Notes", "Lab/Notes/Lab/Notes/Old"]);
    });

    it("does not treat a sibling with a shared name prefix as part of the subtree", () => {
        expect(translateExpandedIds(["Lab/Lab/Notes2"], [{ from: "Lab/Lab/Notes", to: "Lab/Notes" }])).toEqual([]);
    });

    it("writes the temporary state back over the origin subtree only", () => {
        expect(writeBackExpandedIds(["Lab", "Lab/Lab/Notes", "Garden"], ["Lab/Notes/Lab/Notes/Old"], [{ from: "Lab/Notes", to: "Lab/Lab/Notes" }]))
            .toEqual(["Lab", "Garden", "Lab/Lab/Notes/Lab/Notes/Old"]);
    });
});
