// Obsidian internals the plugin relies on beyond the public API. Keep this list to what
// the code actually touches; `npx tsc` reports a removed member the moment it is used.
// The export makes this file a module, so the declaration below augments "obsidian"
// instead of replacing it.
export {};

declare module "obsidian" {
    interface App {
        plugins: any;
        dragManager: any;
        commands: {
            executeCommandById(id: string): void;
            commands: Record<string, Command>;
        };
        setting: {
            open(): void;
            openTabById(id: string): void;
        };
        showInFolder(path: string): void;
    }

    interface Vault {
        on(name: "raw", callback: (path: string) => any, ctx?: any): EventRef;
    }

    interface FileManager {
        createNewMarkdownFile: (folder: TFolder, name: string) => Promise<TFile>;
    }

    interface MetadataCache {
        getTags(): Record<string, number>;
    }

    interface WorkspaceParent {
        removeChild(leaf: WorkspaceLeaf, resize?: boolean): void;
    }

    interface Workspace {
        activeEditor: MarkdownFileInfo;
    }

    interface WorkspaceLeaf {
        containerEl: HTMLElement;
        tabHeaderInnerIconEl: HTMLElement;
    }

    interface View {
        file?: TAbstractFile;
    }
}
