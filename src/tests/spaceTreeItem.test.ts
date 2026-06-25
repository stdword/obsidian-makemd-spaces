import { shouldShowFileTag } from "core/react/components/Navigator/SpaceTree/fileTags";
import { canOpenTreeItemPath, isTagTreeItemPath } from "core/react/components/Navigator/SpaceTree/treeItemPath";
import { treeItemActiveColorVariables, treeItemColorVariables } from "core/react/components/Navigator/SpaceTree/treeItemStyles";
import { canEditPathSticker, defaultStickerForPathState } from "shared/components/PathSticker";
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

describe("PathStickerView helpers", () => {
    it("uses a hash icon for tag spaces without a custom sticker", () => {
        expect(defaultStickerForPathState({ type: "space", subtype: "tag", label: { sticker: "", color: "" }, path: "spaces://#art" } as any)).toBe("lucide//hash");
    });

    it("does not allow tag spaces to open the sticker editor", () => {
        expect(canEditPathSticker({ type: "space", subtype: "tag", label: { sticker: "", color: "" }, path: "spaces://#art" } as any, true)).toBe(false);
    });

    it("uses tag path as a fallback for older tag space cache", () => {
        const tagPath = { type: "space", label: { sticker: "", color: "" }, path: "spaces://#art" } as any;

        expect(defaultStickerForPathState(tagPath)).toBe("lucide//hash");
        expect(canEditPathSticker(tagPath, true)).toBe(false);
    });
});

describe("canOpenTreeItemPath", () => {
    it("keeps tag space groups inside the navigator tree", () => {
        const tagPath = { type: "space", subtype: "tag", path: "spaces://#bio", label: { sticker: "", color: "" } } as any;

        expect(isTagTreeItemPath(tagPath)).toBe(true);
        expect(canOpenTreeItemPath(tagPath)).toBe(false);
    });

    it("recognizes tag space groups by path when older cache has no subtype", () => {
        const tagPath = { type: "space", path: "spaces://#bio", label: { sticker: "", color: "" } } as any;

        expect(isTagTreeItemPath(tagPath)).toBe(true);
        expect(canOpenTreeItemPath(tagPath)).toBe(false);
    });

    it("keeps folders and files openable", () => {
        expect(canOpenTreeItemPath({ type: "space", subtype: "folder", path: "Projects", label: { sticker: "", color: "" } })).toBe(true);
        expect(canOpenTreeItemPath({ type: "file", subtype: "md", path: "Note.md", label: { sticker: "", color: "" } })).toBe(true);
    });
});

describe("navigator file label color CSS", () => {
    const navigatorCss = fs.readFileSync(path.join(__dirname, "../css/Panels/Navigator/Navigator.css"), "utf8");

    it("applies custom file colors through text and icon variables", () => {
        expect(navigatorCss).toMatch(/\.mk-tree-text\.nav-file-title-content\s*{[^}]*color:\s*var\(--label-color\)/);
        expect(navigatorCss).toMatch(/\.nav-file-title\s*>\s*\.mk-path-icon\s*>\s*button\s*>\s*svg\s*{[^}]*color:\s*var\(--icon-color\)/);
    });

    it("aligns tag group rows with folder section rows", () => {
        expect(navigatorCss).toMatch(/\.mk-tree-tag\s+\.mk-tree-item\s*{[^}]*padding-left:\s*4px/);
        expect(navigatorCss).toMatch(/\.mk-tree-tag\s+\.mk-tree-text\s*{[^}]*font-size:\s*14px/);
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
