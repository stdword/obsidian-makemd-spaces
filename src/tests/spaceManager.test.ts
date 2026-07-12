import { SpaceManager } from "core/spaceManager/spaceManager";

describe("SpaceManager", () => {
    it("recognizes a root tag-space URI as a tag instead of the vault", () => {
        const manager = new SpaceManager();
        const uri = manager.uriByString("spaces://#asd");

        expect(uri.authority).toBe("#asd");
        expect(uri.path).toBe("/");
        expect(manager.spaceTypeByString(uri)).toBe("tag");
    });
});
