import { processFolderNoteChildren } from "integrations/folderNotesPluginIntegration";
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

        const result = processFolderNoteChildren(superstateWithFolderNotes(), "Projects/Alpha", items);

        expect(result).toEqual({ children: items, folderNotePath: null });
    });

    it("hides only the first matching folder note using supported file type order", () => {
        const items = [item("Projects/Alpha/Alpha.md"), item("Projects/Alpha/Alpha.canvas"), item("Projects/Alpha/Notes.md")];
        const superstate = superstateWithFolderNotes({
            folderNoteName: "{{folder_name}}",
            supportedFileTypes: ["canvas", "md"],
        });

        const result = processFolderNoteChildren(superstate, "Projects/Alpha", items);

        expect(result.children.map((i) => i.path)).toEqual(["Projects/Alpha/Alpha.canvas", "Projects/Alpha/Notes.md"]);
        expect(result.folderNotePath).toBe("Projects/Alpha/Alpha.md");
    });

    it("reads folder-notes settings from the Obsidian UI main frame plugin", () => {
        const items = [item("Projects/Content/Content.canvas"), item("Projects/Content/Ideas.canvas")];
        const superstate = superstateWithFolderNotesInMainFrame({
            folderNoteName: "{{folder_name}}",
            supportedFileTypes: ["md", "canvas", "base"],
        });

        const result = processFolderNoteChildren(superstate, "Projects/Content", items);

        expect(result.children.map((i) => i.path)).toEqual(["Projects/Content/Ideas.canvas"]);
        expect(result.folderNotePath).toBe("Projects/Content/Content.canvas");
    });
});
