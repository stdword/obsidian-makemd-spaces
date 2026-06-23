import { shouldShowFileTag } from "core/react/components/Navigator/SpaceTree/fileTags";
import fs from "fs";
import path from "path";

describe("shouldShowFileTag", () => {
    it("hides tags for registered file extensions", () => {
        expect(shouldShowFileTag(false, "md")).toBe(false);
        expect(shouldShowFileTag(false, "base")).toBe(false);
        expect(shouldShowFileTag(false, "canvas")).toBe(false);
        expect(shouldShowFileTag(false, "excalidraw")).toBe(false);
    });

    it("shows tags only for unregistered file extensions", () => {
        expect(shouldShowFileTag(false, "pdf")).toBe(true);
        expect(shouldShowFileTag(false, "")).toBe(false);
        expect(shouldShowFileTag(true, "pdf")).toBe(false);
    });
});

describe("navigator file label color CSS", () => {
    const navigatorCss = fs.readFileSync(path.join(__dirname, "../css/Panels/Navigator/Navigator.css"), "utf8");

    it("applies custom file colors to text without recoloring the file icon", () => {
        expect(navigatorCss).toMatch(/\.mk-tree-text\.nav-file-title-content\s*{[^}]*color:\s*var\(--label-color\)/);
        expect(navigatorCss).toMatch(/\.nav-file-title\s*>\s*\.mk-path-icon\s*>\s*button\s*>\s*svg\s*{[^}]*color:\s*var\(--icon-color\)/);
    });
});
