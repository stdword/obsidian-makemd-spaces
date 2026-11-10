import { childExpandKey, expandKeysInside, linkExpandKey, renameExpandKeys, renameFocusInExpandKeys, sectionExpandKey } from "core/utils/superstate/expandKeys";

describe("expand keys", () => {
    it("keys a row by what it is: the folder itself, a link, or a tagged item", () => {
        expect(childExpandKey("Studio", "Studio/Poems")).toBe("Studio/Poems");
        expect(childExpandKey("/", "Studio")).toBe("Studio");
        expect(childExpandKey("Board", "Studio/Poems")).toBe("Board/?link=Studio/Poems");
        expect(childExpandKey("Board", "spaces://#verse")).toBe("Board/?link=spaces://#verse");
        expect(childExpandKey("spaces://#verse", "spaces://#verse/haiku")).toBe("spaces://#verse/haiku");
        expect(childExpandKey("spaces://#verse", "Studio/Poems")).toBe("spaces://#verse/?link=Studio/Poems");
    });

    it("keeps the folder, its link and its section apart", () => {
        const keys = new Set([childExpandKey("Studio", "Studio/Poems"), childExpandKey("Board", "Studio/Poems"), sectionExpandKey("Writing", "Studio/Poems")]);

        expect(keys.size).toBe(3);
    });

    it("does not confuse a nested folder section with a same-named root folder linked next to it", () => {
        expect(sectionExpandKey("Writing", "Board/Poems")).not.toBe(childExpandKey("Board", "Poems"));
    });
});

describe("renaming expand keys", () => {
    it("moves a folder's state and everything inside it, in every form", () => {
        expect(renameExpandKeys([
            "Studio",
            "Studio/Drafts/Poems",
            "Studio/Drafts/Poems/Haiku",
            linkExpandKey("Studio/Drafts/Poems", "Board/Pinned"),
            linkExpandKey("Board", "Studio/Drafts/Poems/Haiku"),
            sectionExpandKey("Writing", "Studio/Drafts/Poems"),
        ], "Studio/Drafts/Poems", "Studio/Poems")).toEqual([
            "Studio",
            "Studio/Poems",
            "Studio/Poems/Haiku",
            linkExpandKey("Studio/Poems", "Board/Pinned"),
            linkExpandKey("Board", "Studio/Poems/Haiku"),
            sectionExpandKey("Writing", "Studio/Poems"),
        ]);
    });

    it("keeps a folder expanded when it moves to and from the vault root", () => {
        const nested = ["Studio", "Studio/Poems", "Studio/Poems/Haiku"];
        const atRoot = ["Studio", "Poems", "Poems/Haiku"];

        expect(renameExpandKeys(nested, "Studio/Poems", "Poems")).toEqual(atRoot);
        expect(renameExpandKeys(atRoot, "Poems", "Studio/Poems")).toEqual(nested);
    });

    it("does not touch a same-named folder that lives under another parent", () => {
        const other = ["Other", "Other/Poems", "Other/Poems/Haiku", sectionExpandKey("Writing", "Other/Poems")];

        expect(renameExpandKeys([...other, "Poems", "Poems/Odes"], "Poems", "Verses")).toEqual([...other, "Verses", "Verses/Odes"]);
        expect(renameExpandKeys([...other, "Studio/Poems"], "Studio/Poems", "Poems")).toEqual([...other, "Poems"]);
    });

    it("does not treat a sibling with a shared name prefix as part of the folder", () => {
        expect(renameExpandKeys(["Studio/Poems", "Studio/Poems 2", "Studio/Poems 2/Haiku"], "Studio/Poems", "Studio/Verses"))
            .toEqual(["Studio/Poems 2", "Studio/Poems 2/Haiku", "Studio/Verses"]);
    });

    it("drops state left at the destination by something that lived there earlier", () => {
        expect(renameExpandKeys(["Studio", "Studio/Verses", "Studio/Verses/Old", "Studio/Poems"], "Studio/Poems", "Studio/Verses"))
            .toEqual(["Studio", "Studio/Verses"]);
        expect(renameExpandKeys(["Studio", "Studio/Verses/Old"], "Studio/Poems", "Studio/Verses")).toEqual(["Studio"]);
    });

    it("returns the same list when nothing names the renamed path", () => {
        const keys = ["Studio", "Studio/Poems"];

        expect(renameExpandKeys(keys, "Garden", "Yard")).toBe(keys);
    });

    it("follows a renamed tag", () => {
        expect(renameExpandKeys(["spaces://#verse", "spaces://#verse/haiku", linkExpandKey("Board", "spaces://#verse")], "spaces://#verse", "spaces://#poetry"))
            .toEqual(["spaces://#poetry", "spaces://#poetry/haiku", linkExpandKey("Board", "spaces://#poetry")]);
    });

    it("moves section state to a renamed focus and leaves other focuses alone", () => {
        expect(renameFocusInExpandKeys([sectionExpandKey("Writing", "Studio"), sectionExpandKey("Reading", "Studio"), "Studio/Poems"], "Writing", "Drafting"))
            .toEqual([sectionExpandKey("Drafting", "Studio"), sectionExpandKey("Reading", "Studio"), "Studio/Poems"]);
    });

    it("picks the state inside a folder without the folder's own row", () => {
        expect(expandKeysInside([
            "Studio",
            "Studio/Poems",
            "Studio 2/Poems",
            linkExpandKey("Studio", "Board"),
            linkExpandKey("Board", "Studio/Poems"),
            sectionExpandKey("Writing", "Studio/Poems"),
        ], "Studio")).toEqual(["Studio/Poems", linkExpandKey("Studio", "Board")]);
    });
});
