jest.mock("main", () => jest.fn());
jest.mock(
    "obsidian",
    () => ({
        normalizePath: (path: string) => path,
        TFile: class TFile {},
        TFolder: class TFolder {},
    }),
    { virtual: true },
);

import { sanitizeFileName, sanitizeFolderName, UNNAMED_FILE } from "utils/sanitizers";
import { uniqueFileName, uniqueFolderName } from "adapters/obsidian/utils/file";

describe("file and folder name sanitizing", () => {
    it("strips illegal characters, control characters and trailing dots or spaces", () => {
        expect(sanitizeFileName('Re:port/<draft>*?"|')).toBe("Report");
        expect(sanitizeFileName("Notes... ")).toBe("Notes");
        expect(sanitizeFileName("tab\there")).toBe("tabhere");
    });

    it("never returns an empty name", () => {
        expect(sanitizeFileName("...")).toBe(UNNAMED_FILE);
        expect(sanitizeFileName("")).toBe(UNNAMED_FILE);
        expect(sanitizeFileName(undefined as unknown as string)).toBe(UNNAMED_FILE);
        expect(sanitizeFolderName("+")).toBe(UNNAMED_FILE);
    });

    it("keeps Windows reserved names by prefixing them", () => {
        expect(sanitizeFileName("con")).toBe("_con");
        expect(sanitizeFileName("NUL.txt")).toBe("_NUL.txt");
        expect(sanitizeFolderName("com1")).toBe("_com1");
        expect(sanitizeFileName("console")).toBe("console");
    });

    it("drops folder-only reserved prefixes", () => {
        expect(sanitizeFolderName("#tagged")).toBe("tagged");
        expect(sanitizeFileName("#tagged")).toBe("#tagged");
    });
});

describe("unique names after sanitizing", () => {
    const folder = { children: [{ name: "Untitled.md" }, { name: "Untitled 1.md" }] } as any;

    it("falls back to Untitled instead of producing a bare extension", () => {
        expect(uniqueFileName("Old.md", "...", "md", folder)).toBe("Untitled 2.md");
    });

    it("keeps a folder name instead of renaming the folder into its parent", () => {
        expect(uniqueFolderName("Old", "con", { children: [] } as any)).toBe("_con");
        expect(uniqueFolderName("Old", "..", { children: [] } as any)).toBe("Untitled");
    });
});
