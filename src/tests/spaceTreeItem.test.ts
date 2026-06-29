import { shouldShowFileTag } from "core/react/components/Navigator/SpaceTree/fileTags";
import { linkedItemIconPathState, shouldShowLinkedItemIcon } from "core/react/components/Navigator/SpaceTree/linkedItemIcon";
import { calculateFolderLineHeight } from "core/react/components/Navigator/SpaceTree/treeLineHeight";
import { canOpenTreeItemPath, isTagTreeItemPath } from "shared/schemas/builtin";
import { treeItemActiveColorVariables, treeItemColorVariables, treeItemDisplayColor, treeItemDisplayName } from "core/react/components/Navigator/SpaceTree/treeItemStyles";
import { canEditPathSticker } from "shared/components/PathSticker";
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

describe("calculateFolderLineHeight", () => {
    it("extends a parent folder line through expanded nested descendants", () => {
        const flattenedTree = [
            { id: "Atlas/AI", depth: 1, type: "space" },
            { id: "Atlas/AI/0 Notes", depth: 2, type: "space" },
            { id: "Atlas/AI/0 Notes/file-a.md", depth: 3, type: "file" },
            { id: "Atlas/AI/0 Notes/file-b.md", depth: 3, type: "file" },
            { id: "Atlas/AI/0 Notes/file-c.md", depth: 3, type: "file" },
            { id: "Atlas/AI/1 Collections", depth: 2, type: "space" },
            { id: "Atlas/AI/2 Resources", depth: 2, type: "space" },
            { id: "spaces://#psy/self", depth: 0, type: "group" },
        ] as any;
        const rowHeights = flattenedTree.map(() => 25);

        expect(calculateFolderLineHeight(flattenedTree, rowHeights, 0, false)).toBe(137);
    });
});

describe("linked item icon", () => {
    it("shows for items linked into a different tree space", () => {
        expect(
            shouldShowLinkedItemIcon({
                type: "file",
                depth: 1,
                space: "LinkedSpace",
                item: { path: "Folder/Note.md", parent: "Folder" },
            } as any),
        ).toBe(true);

        expect(
            shouldShowLinkedItemIcon({
                type: "space",
                depth: 1,
                space: "LinkedSpace",
                item: { path: "Folder/Subfolder", parent: "Folder" },
            } as any),
        ).toBe(true);

        expect(
            shouldShowLinkedItemIcon({
                type: "space",
                depth: 1,
                space: "LinkedSpace",
                item: { path: "spaces://#tag", parent: "spaces://#" },
            } as any),
        ).toBe(true);
    });

    it("hides for items shown in their own parent space", () => {
        expect(
            shouldShowLinkedItemIcon({
                type: "file",
                depth: 1,
                space: "Folder",
                item: { path: "Folder/Note.md", parent: "Folder" },
            } as any),
        ).toBe(false);

        expect(
            shouldShowLinkedItemIcon({
                type: "space",
                depth: 1,
                space: "Folder",
                item: { path: "Folder/Subfolder", parent: "Folder" },
            } as any),
        ).toBe(false);

        expect(
            shouldShowLinkedItemIcon({
                type: "group",
                depth: 1,
                space: "Folder",
                item: { path: "Folder", parent: "" },
            } as any),
        ).toBe(false);
    });

    it("uses a non-space lucide link sticker with a linked label", () => {
        expect(linkedItemIconPathState).toEqual({
            path: "",
            name: "linked",
            type: "file",
            label: { sticker: "lucide//link-2", color: "" },
        });
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

    it("positions the linked item icon relative to the primary path icon", () => {
        expect(navigatorCss).toMatch(/\.mk-tree-item\s*{[^}]*position:\s*relative/);
        expect(navigatorCss).toMatch(/\.mk-linked-item-icon\s*{[^}]*pointer-events:\s*none/);
    });
});

describe("treeItemColorVariables", () => {
    it("does not use a folder defaultColor as the folder's own display color", () => {
        expect(
            treeItemDisplayColor(
                {
                    type: "space",
                    subtype: "folder",
                    label: { sticker: "ui//folder", color: "" },
                } as any,
                "#ff6699",
            ),
        ).toBe("");
    });

    it("uses an explicit folder label color before any defaultColor", () => {
        expect(
            treeItemDisplayColor(
                {
                    type: "space",
                    subtype: "folder",
                    label: { sticker: "ui//folder", color: "#112233" },
                } as any,
                "#ff6699",
            ),
        ).toBe("#112233");
    });

    it("uses the custom file color for both text and icon", () => {
        expect(treeItemColorVariables("#ff6699", false)).toEqual({
            "--label-color": "#ff6699",
            "--icon-color": "#ff6699",
            position: "relative",
        });
    });

    it("keeps folder colors scoped to the icon so the folder name stays visible", () => {
        expect(treeItemColorVariables("#ff6699", true)).toEqual({
            "--icon-color": "#ffffff",
            position: "relative",
        });
    });
});

describe("treeItemDisplayName", () => {
    it("falls back to the space name when a vault path state has an empty name", () => {
        expect(
            treeItemDisplayName(
                { type: "space", subtype: "vault", path: "/", name: "" },
                { path: "/" },
                new Map([["/", { name: "Home" }]]),
            ),
        ).toBe("Home");
    });

    it("keeps non-empty path state names before fallbacks", () => {
        expect(
            treeItemDisplayName(
                { type: "space", path: "/", name: "Vault" },
                { path: "/" },
                new Map([["/", { name: "Home" }]]),
            ),
        ).toBe("Vault");
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

    it("does not color active folder names with the folder icon color", () => {
        expect(treeItemActiveColorVariables("#ff6699", true)).toEqual({
            "--icon-color": "#ffffff",
        });
    });
});
