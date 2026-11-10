import { movePath, parseURI } from "utils/uri";

describe("parseURI", () => {
    it("keeps question marks and percent signs in plain vault paths", () => {
        const path = "Projects/Brand for 99% of People?.md";

        const uri = parseURI(path);

        expect(uri.fullPath).toBe(path);
        expect(uri.path).toBe(path);
        expect(uri.query).toBeNull();
    });

    it("does not throw on malformed percent escapes in explicit URI query strings", () => {
        const uri = parseURI("spaces://$tags/?q=99% of People");

        expect(uri.query).toEqual({ q: "99% of People" });
    });
});

describe("movePath", () => {
    it("moves a path into another folder", () => {
        expect(movePath("Архив/Заметки", "Проекты/Важное")).toBe("Проекты/Важное/Заметки");
    });

    it("moves a path to the vault root without a leading slash", () => {
        expect(movePath("Архив/Заметки", "/")).toBe("Заметки");
        expect(movePath("Архив/План.md", "")).toBe("План.md");
    });
});
