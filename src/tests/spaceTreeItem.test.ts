import { FOLDER_NOTE_TREE_CLASS, linkedItemIcon, pathStateForTreeItem, shouldShowLinkedItemIcon, shouldShowPinnedItemIcon, toggleSelectedPath, folderClickPlan } from "core/react/components/Navigator/SpaceTree/SpaceTreeItem";
import { filterLinkedTagSpaceItems } from "core/react/components/Navigator/SpaceTree/SpaceTreeView";
import { canOpenTreeItemPath, isFilter, isTagTreeItemPath } from "schemas/builtin";
import { treeItemActiveColorVariables, treeItemColorVariables, treeItemDisplayColor, treeItemDisplayName } from "core/react/components/Navigator/SpaceTree/treeItemStyles";
import fs from "fs";
import path from "path";

describe("canOpenTreeItemPath", () => {
    it("keeps tag space groups inside the navigator tree", () => {
        const tagPath = { type: "space", subtype: "tag", path: "spaces://#bio" } as any;

        expect(isTagTreeItemPath(tagPath)).toBe(true);
        expect(canOpenTreeItemPath(tagPath)).toBe(false);
    });

    it("recognizes tag space groups by path when older cache has no subtype", () => {
        const tagPath = { type: "space", path: "spaces://#bio" } as any;

        expect(isTagTreeItemPath(tagPath)).toBe(true);
        expect(canOpenTreeItemPath(tagPath)).toBe(false);
    });

    it("keeps folders and files openable", () => {
        expect(canOpenTreeItemPath({ type: "space", subtype: "folder", path: "Projects", sticker: "", color: "" } as any)).toBe(true);
        expect(canOpenTreeItemPath({ type: "file", subtype: "md", path: "Note.md", sticker: "", color: "" } as any)).toBe(true);
    });
});

describe("linked item icon", () => {
    it("uses filter for a filtered link and link for a regular link", () => {
        expect(linkedItemIcon({ filtered: true } as any)).toBe("lucide//filter");
        expect(linkedItemIcon({ filtered: false } as any)).toBe("lucide//link-2");
    });
    it("shows for items linked into a different tree space", () => {
        expect(
            shouldShowLinkedItemIcon({
                type: "file",
                depth: 1,
                space: "LinkedSpace",
                item: { path: "Folder/Note.md", parent: "Folder", linkedSpaces: ["LinkedSpace"] },
            } as any),
        ).toBe(true);

        expect(
            shouldShowLinkedItemIcon({
                type: "space",
                depth: 1,
                space: "LinkedSpace",
                item: { path: "Folder/Subfolder", parent: "Folder", linkedSpaces: ["LinkedSpace"] },
            } as any),
        ).toBe(true);

        expect(
            shouldShowLinkedItemIcon({
                type: "space",
                depth: 1,
                space: "LinkedSpace",
                item: { path: "spaces://#tag", parent: "spaces://#", linkedSpaces: ["LinkedSpace"] },
            } as any),
        ).toBe(true);
    });

    it("shows immediately when item state records the current tree space as linked", () => {
        expect(
            shouldShowLinkedItemIcon({
                type: "space",
                depth: 1,
                space: "Projects",
                item: {
                    path: "Projects/LinkedFolder",
                    parent: "Projects",
                    linkedSpaces: ["Projects"],
                    hidden: true,
                },
            } as any),
        ).toBe(true);
    });

    it("shows for virtual tag spaces linked into a folder", () => {
        expect(
            shouldShowLinkedItemIcon({
                type: "space",
                depth: 1,
                space: "FixtureFolder",
                item: {
                    path: "spaces://#fixture-tag",
                    type: "space",
                    subtype: "tag",
                    linkedSpaces: [],
                },
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
});

describe("linked tag space filter", () => {
    it("recognizes a filtered link when the queried path already contains filter params", () => {
        const parentSpace = { metadata: { links: ["spaces://#topic?filter"] } } as any;

        expect(isFilter("spaces://#topic?filter", parentSpace)).toBe(true);
        expect(isFilter("spaces://#topic", parentSpace)).toBe(true);
    });

    it("keeps only recursive descendants of the containing folder", () => {
        const items = [
            { path: "Folder/Sub/Item.md" },
            { path: "Folder/Direct.md" },
            { path: "Other/Item.md" },
            { path: "Folderish/Item.md" },
        ] as any;
        expect(filterLinkedTagSpaceItems(items, "Folder").map((item) => item.path)).toEqual([
            "Folder/Sub/Item.md",
            "Folder/Direct.md",
        ]);
    });

    it("does not show the containing folder represented by its folder note", () => {
        const items = [
            { path: "Folder", type: "space" },
            { path: "Folder/Sub/Item.md", type: "file" },
        ] as any;
        expect(filterLinkedTagSpaceItems(items, "Folder").map((item) => item.path)).toEqual(["Folder/Sub/Item.md"]);
    });

    it("keeps hierarchical tag spaces while filtering physical paths", () => {
        const items = [
            { path: "spaces://#topic/done", type: "space", subtype: "tag" },
            { path: "Folder/Included.md", type: "file" },
            { path: "Outside/Untitled.md", type: "file" },
        ] as any;

        expect(filterLinkedTagSpaceItems(items, "Folder").map((item) => item.path)).toEqual([
            "spaces://#topic/done",
            "Folder/Included.md",
        ]);
    });
});

describe("pinned item icon", () => {
    it("uses the tree node pinned state instead of stale path state metadata", () => {
        expect(
            shouldShowPinnedItemIcon({
                type: "space",
                depth: 1,
                space: "Projects",
                pinned: false,
                item: {
                    path: "Projects/Topics",
                    pinnedSpaces: ["Projects"],
                },
            } as any),
        ).toBe(false);
    });
});

describe("folder note style", () => {
    it("uses a namespaced class that Folder Notes does not manage", () => {
        expect(FOLDER_NOTE_TREE_CLASS).toBe("mk-has-folder-note");

        const navigatorCss = fs.readFileSync(path.resolve(__dirname, "../css/Panels/Navigator/Navigator.css"), "utf8");
        expect(navigatorCss).toContain(".folder-note-cursive .mk-has-folder-note .nav-folder-title-content");
    });
});


describe("selected active row style", () => {
    it("shows the selection on the active row so alt-click toggling is visible", () => {
        const navigatorCss = fs.readFileSync(path.resolve(__dirname, "../css/Panels/Navigator/Navigator.css"), "utf8");
        const rule = navigatorCss.match(/\.mk-tree-item\.is-active\.is-selected:not\(\.clone\) \{([^}]*)\}/);
        expect(rule).not.toBeNull();
        expect(rule[1]).toContain("var(--nav-item-background-selected)");
        expect(navigatorCss.indexOf(".mk-tree-item.is-active.is-selected")).toBeGreaterThan(navigatorCss.indexOf(".mk-tree-item.is-active:not(.clone)"));
    });

    it("keeps the selection color when the navigator pane loses focus", () => {
        const navigatorCss = fs.readFileSync(path.resolve(__dirname, "../css/Panels/Navigator/Navigator.css"), "utf8");
        expect(navigatorCss).not.toContain(".workspace-leaf:not(.mod-active) .is-selected");
    });
});

describe("treeItemColorVariables", () => {
    it("uses the current tag-space file color instead of stale global path color", () => {
        const path = "Notes/Tagged.md";
        const space = "spaces://#project";
        const superstate = {
            pathStateForPath: jest.fn(() => ({ path, type: "file", color: "" })),
            spacesIndex: new Map([[space, {
                metadata: {
                    "file-colors": { [path]: "#ff6699" },
                },
            }]]),
        } as any;

        expect(pathStateForTreeItem(superstate, {
            path,
            space,
            item: { path, type: "file", color: "" },
        } as any).color).toBe("#ff6699");
    });

    it("does not use a folder defaultColor as the folder's own display color", () => {
        expect(
            treeItemDisplayColor(
                {
                    type: "space",
                    subtype: "folder",
                    sticker: "lucide//folder-closed",
                    color: "",
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
                    color: "#112233",
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
                {
                    type: "space",
                    subtype: "vault",
                    path: "/",
                    name: "",
                    parent: "",
                    metadata: {},
                    tags: [],
                    hidden: false,
                    color: "",
                    sticker: "ui//home",
                    spaces: [],
                    linkedSpaces: [],
                    pinnedSpaces: [],
                },
                { path: "/" } as any,
                new Map([["/", { name: "Home" }]]),
            ),
        ).toBe("Home");
    });

    it("keeps non-empty path state names before fallbacks", () => {
        expect(
            treeItemDisplayName(
                {
                    type: "space",
                    subtype: "vault",
                    path: "/",
                    name: "Vault",
                    parent: "",
                    metadata: {},
                    tags: [],
                    hidden: false,
                    color: "",
                    sticker: "ui//home",
                    spaces: [],
                    linkedSpaces: [],
                    pinnedSpaces: [],
                },
                { path: "/" } as any,
                new Map([["/", { name: "Home" }]]),
            ),
        ).toBe("Vault");
    });
});

describe("tree item modifier hover behavior", () => {
    const treeItemSource = fs.readFileSync(path.join(__dirname, "../core/react/components/Navigator/SpaceTree/SpaceTreeItem.tsx"), "utf8");

    it("does not open hover previews when Cmd or Ctrl is pressed over a tree item", () => {
        expect(treeItemSource).not.toContain('"hover"');
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

describe("toggleSelectedPath", () => {
    const alpha = { id: "Vault/alpha.md", path: "Vault/alpha.md" } as any;
    const beta = { id: "Vault/beta.md", path: "Vault/beta.md" } as any;

    it("adds an unselected item to the selection", () => {
        expect(toggleSelectedPath([alpha], beta)).toEqual([alpha, beta]);
    });

    it("removes an already selected item on a repeated alt-click", () => {
        expect(toggleSelectedPath([alpha, beta], beta)).toEqual([alpha]);
    });

    it("clears the selection when the only selected item is toggled", () => {
        expect(toggleSelectedPath([alpha], alpha)).toEqual([]);
    });
});

describe("folderClickPlan", () => {
    it("selects an unselected folder and opens its folder note without folding", () => {
        expect(folderClickPlan(false, 0, "Trips/Norway/Norway.md")).toEqual({ select: true, openPath: "Trips/Norway/Norway.md" });
    });

    it("only selects an unselected folder that has no folder note", () => {
        expect(folderClickPlan(false, 0, null)).toEqual({ select: true, openPath: null });
    });

    it("does nothing when the folder is the single selected item", () => {
        expect(folderClickPlan(true, 1, "Trips/Norway/Norway.md")).toEqual({ select: false, openPath: null });
    });

    it("narrows a multi-selection down to the clicked folder", () => {
        expect(folderClickPlan(true, 3, null)).toEqual({ select: true, openPath: null });
    });
});

describe("folder row click behavior", () => {
    const treeItemSource = fs.readFileSync(path.join(__dirname, "../core/react/components/Navigator/SpaceTree/SpaceTreeItem.tsx"), "utf8");

    it("does not expose data-path so Folder Notes leaves title clicks to the row handler", () => {
        expect(treeItemSource).not.toMatch(/\bdata-path=/);
        expect(treeItemSource).toContain("data-tree-path=");
    });

    it("folds a folder on double click instead of single click", () => {
        expect(treeItemSource).toContain("onDoubleClick=");
        expect(treeItemSource).not.toContain("expandFolderOnClick");
    });
});
