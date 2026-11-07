import { filterFolderNoteChildren, folderPathForHiddenFolderNote, getFolderNotePath, navigatorActivePathForPath } from "integrations/folderNotesPluginIntegration";
import { PathStateWithRank } from "shared/types/superstate";

const item = (path: string, type = "file"): PathStateWithRank =>
    ({
        path,
        type,
        subtype: type == "space" ? "folder" : "md",
        name: path.split("/").pop(),
        parent: path.split("/").slice(0, -1).join("/"),
        metadata: {},
        tags: [],
        hidden: false,
        color: "",
        sticker: "",
        spaces: [],
        linkedSpaces: [],
        pinnedSpaces: [],
    }) as PathStateWithRank;

const superstateWithFolderNotes = (settings?: Record<string, unknown>) =>
    ({
        ui: {
            plugin: {
                app: {
                    plugins: {
                        getPlugin: jest.fn(() => (settings ? { settings } : null)),
                    },
                },
            },
        },
    }) as any;

const superstateWithFolderNotesInMainFrame = (settings?: Record<string, unknown>) =>
    ({
        ui: {
            mainFrame: {
                plugin: {
                    app: {
                        plugins: {
                            getPlugin: jest.fn(() => (settings ? { settings } : null)),
                        },
                    },
                },
            },
        },
    }) as any;

describe("FolderNotesPluginIntegration", () => {
    it("returns all folder items when the folder-notes plugin is not installed", () => {
        const items = [item("Projects/Alpha/Alpha.md"), item("Projects/Alpha/Notes.md")];

        const superstate = superstateWithFolderNotes();
        const folderNotePath = getFolderNotePath(superstate, "Projects/Alpha", items.map((item) => item.path));

        expect(folderNotePath).toBe("");
        expect(filterFolderNoteChildren(superstate, folderNotePath, items)).toBe(items);
    });

    it("hides only the first matching folder note using supported file type order", () => {
        const items = [item("Projects/Alpha/Alpha.md"), item("Projects/Alpha/Alpha.canvas"), item("Projects/Alpha/Notes.md")];
        const superstate = superstateWithFolderNotes({
            folderNoteName: "{{folder_name}}",
            supportedFileTypes: ["canvas", "md"],
            hideFolderNote: true,
        });

        const folderNotePath = getFolderNotePath(superstate, "Projects/Alpha", items.map((item) => item.path));
        const children = filterFolderNoteChildren(superstate, folderNotePath, items);

        expect(children.map((i) => i.path)).toEqual(["Projects/Alpha/Alpha.canvas", "Projects/Alpha/Notes.md"]);
        expect(folderNotePath).toBe("Projects/Alpha/Alpha.md");
    });

    it("reads folder-notes settings from the Obsidian UI main frame plugin", () => {
        const items = [item("Projects/Content/Content.canvas"), item("Projects/Content/Ideas.canvas")];
        const superstate = superstateWithFolderNotesInMainFrame({
            folderNoteName: "{{folder_name}}",
            supportedFileTypes: ["md", "canvas", "base"],
            hideFolderNote: true,
        });

        const folderNotePath = getFolderNotePath(superstate, "Projects/Content", items.map((item) => item.path));
        const children = filterFolderNoteChildren(superstate, folderNotePath, items);

        expect(children.map((i) => i.path)).toEqual(["Projects/Content/Ideas.canvas"]);
        expect(folderNotePath).toBe("Projects/Content/Content.canvas");
    });

    it("resolves a hidden folder note through its parent space notePath", () => {
        const notePath = "Projects/Alpha/Alpha.md";
        const superstate = Object.assign(superstateWithFolderNotes({ hideFolderNote: true }), {
            pathStateForPath: jest.fn(() => item(notePath)),
            spacesIndex: new Map([["Projects/Alpha", {
                path: "Projects/Alpha",
                type: "folder",
                space: { notePath },
            }]]),
        });

        expect(folderPathForHiddenFolderNote(superstate, notePath)).toBe("Projects/Alpha");
        expect(superstate.pathStateForPath).toHaveBeenCalledWith(notePath);
    });

    it("keeps a visible folder note as the reveal target", () => {
        const notePath = "Projects/Alpha/Alpha.md";
        const superstate = Object.assign(superstateWithFolderNotes({ hideFolderNote: false }), {
            pathStateForPath: jest.fn(() => item(notePath)),
            spacesIndex: new Map([["Projects/Alpha", {
                path: "Projects/Alpha",
                type: "folder",
                space: { notePath },
            }]]),
        });

        expect(folderPathForHiddenFolderNote(superstate, notePath)).toBeNull();
    });

    it("highlights the folder in the navigator when its hidden folder note is active", () => {
        const notePath = "Recipes/Soups/Soups.md";
        const superstate = Object.assign(superstateWithFolderNotes({ hideFolderNote: true }), {
            pathStateForPath: jest.fn(() => item(notePath)),
            spacesIndex: new Map([["Recipes/Soups", {
                path: "Recipes/Soups",
                type: "folder",
                space: { notePath },
            }]]),
        });

        expect(navigatorActivePathForPath(superstate, notePath)).toBe("Recipes/Soups");
        expect(navigatorActivePathForPath(superstate, "Recipes/Soups/Borscht.md")).toBe("Recipes/Soups/Borscht.md");
    });
});

describe("prioritizeFolderNoteFileTypes", () => {
    const { prioritizeFolderNoteFileTypes } = jest.requireActual("integrations/folderNotesPluginIntegration");

    it("orders md first and unknown types last without touching the input", () => {
        const supported = ["base", "pdf", "canvas", "md"];
        expect(prioritizeFolderNoteFileTypes(supported)).toEqual(["md", "canvas", "base", "pdf"]);
        expect(supported).toEqual(["base", "pdf", "canvas", "md"]);
    });

    it("is stable for equal ranks", () => {
        expect(prioritizeFolderNoteFileTypes(["pdf", "txt"])).toEqual(["pdf", "txt"]);
    });
});
