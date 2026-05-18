import { hideFolderNoteFileFromItems } from "integrations/folderNotesPluginIntegration";
import { PathStateWithRank } from "shared/types/superstate";

const item = (path: string, type = "file"): PathStateWithRank =>
    ({
        path,
        type,
        label: {},
    } as PathStateWithRank);

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
    } as any);

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
    } as any);

describe("FolderNotesPluginIntegration", () => {
    it("returns all folder items when the folder-notes plugin is not installed", () => {
        const items = [item("Projects/Alpha/Alpha.md"), item("Projects/Alpha/Notes.md")];

        const filtered = hideFolderNoteFileFromItems(superstateWithFolderNotes(), "Projects/Alpha", items);

        expect(filtered).toEqual(items);
    });

    it("hides only the first matching folder note using supported file type order", () => {
        const items = [item("Projects/Alpha/Alpha.md"), item("Projects/Alpha/Alpha.canvas"), item("Projects/Alpha/Notes.md")];
        const superstate = superstateWithFolderNotes({
            folderNoteName: "{{folder_name}}",
            supportedFileTypes: ["canvas", "md"],
        });

        const filtered = hideFolderNoteFileFromItems(superstate, "Projects/Alpha", items);

        expect(filtered.map((i) => i.path)).toEqual(["Projects/Alpha/Alpha.md", "Projects/Alpha/Notes.md"]);
    });

    it("reads folder-notes settings from the Obsidian UI main frame plugin", () => {
        const items = [item("Efforts/core/PSY content production/PSY content production.canvas"), item("Efforts/core/PSY content production/Content Ideas.canvas")];
        const superstate = superstateWithFolderNotesInMainFrame({
            folderNoteName: "{{folder_name}}",
            supportedFileTypes: ["md", "canvas", "base"],
        });

        const filtered = hideFolderNoteFileFromItems(superstate, "Efforts/core/PSY content production", items);

        expect(filtered.map((i) => i.path)).toEqual(["Efforts/core/PSY content production/Content Ideas.canvas"]);
    });
});
