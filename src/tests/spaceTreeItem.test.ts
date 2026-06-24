import { shouldShowFileTag } from "core/react/components/Navigator/SpaceTree/fileTags";
import { treeItemActiveColorVariables, treeItemColorVariables } from "core/react/components/Navigator/SpaceTree/treeItemStyles";
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

    it("applies custom file colors through text and icon variables", () => {
        expect(navigatorCss).toMatch(/\.mk-tree-text\.nav-file-title-content\s*{[^}]*color:\s*var\(--label-color\)/);
        expect(navigatorCss).toMatch(/\.nav-file-title\s*>\s*\.mk-path-icon\s*>\s*button\s*>\s*svg\s*{[^}]*color:\s*var\(--icon-color\)/);
    });
});

describe("treeItemColorVariables", () => {
    it("uses the custom file color for both text and icon", () => {
        expect(treeItemColorVariables("#ff6699", false)).toEqual({
            "--label-color": "#ff6699",
            "--icon-color": "#ff6699",
            position: "relative",
        });
    });

    it("keeps folder icons white on colored folder backgrounds", () => {
        expect(treeItemColorVariables("#ff6699", true)).toEqual({
            "--label-color": "#ff6699",
            "--icon-color": "#ffffff",
            position: "relative",
        });
    });
});

describe("treeItemActiveColorVariables", () => {
    it("keeps a colored active file icon in the file color", () => {
        expect(treeItemActiveColorVariables("#ff6699", false)).toEqual({
            "--label-color": "#ff6699",
            "--icon-color": "#ff6699",
        });
    });

    it("does not override the active icon color for uncolored files", () => {
        expect(treeItemActiveColorVariables("", false)).toEqual({});
    });
});
