import { excludedPathDisplayName } from "core/react/components/UI/Modals/ExcludedFiles";

describe("ExcludedFiles", () => {
    it("displays tag spaces as tags without the internal URI scheme", () => {
        expect(excludedPathDisplayName("spaces://#📖/art")).toBe("#📖/art");
        expect(excludedPathDisplayName("Content/Books")).toBe("Content/Books");
    });
});
