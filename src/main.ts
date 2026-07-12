import { DEFAULT_SETTINGS } from "schemas/settings";
import { App, MarkdownView, Plugin, TAbstractFile, TFile, WorkspaceLeaf } from "obsidian";
import { MakeMDPluginSettingsTab } from "./adapters/obsidian/settings";
import { FILE_TREE_VIEW_TYPE, FileTreeView } from "./adapters/obsidian/ui/navigator/NavigatorView";

import { defaultConfigFile, fileExtensionForFile, fileNameForFile, getAbstractFileAtPath, openTFile } from "adapters/obsidian/utils/file";
import { FilesystemMiddleware, FilesystemSpaceAdapter, SpaceManager, UIManager } from "makemd-core";

import { patchFilesPlugin } from "adapters/obsidian/utils/patches";
import { safelyParseJSON } from "utils/json";
import { SPACE_FOLDER } from "schemas/constants";

import { ObsidianFileSystem } from "adapters/obsidian/filesystem/filesystem";

import { ObsidianBaseFiletypeAdapter } from "adapters/obsidian/filetypes/baseAdapter";
import { ObsidianCanvasFiletypeAdapter } from "adapters/obsidian/filetypes/canvasAdapter";
import { ObsidianMarkdownFiletypeAdapter } from "adapters/obsidian/filetypes/markdownAdapter";
import { ObsidianUI } from "adapters/obsidian/ui/ui";

import { modifyTabSticker } from "adapters/obsidian/utils/modifyTabSticker";

import { LocalCachePersister } from "shared/types/persister";
import { LocalStorageCache } from "adapters/mdb/localCache/localCache";
import { LocalSqliteStorage } from "adapters/mdb/localCache/sqliteStorage";
import { JSONFiletypeAdapter } from "adapters/obsidian/filetypes/jsonAdapter";

import { attachCommands } from "commands";
import { Superstate } from "core/superstate/superstate";
import { defaultSpace, newPathInSpace } from "core/utils/superstate/spaces";
import "css/DefaultVibe.css";
import "css/Menus/ColorPicker.css";
import "css/Menus/MainMenu.css";
import "css/Menus/Menu.css";
import "css/Menus/SearchMenu.css";
import "css/Menus/StickerMenu.css";
import "css/Modal/Modal.css";
import "css/Panels/Navigator/FileTree.css";
import "css/Panels/Navigator/Focuses.css";
import "css/Panels/Navigator/Navigator.css";
// import "css/System/Settings.css";
import "css/UI/Buttons.css";
import { IMakeMDPlugin } from "shared/types/makemd";
import { removeTrailingSlashFromFolder } from "utils/paths";
import { getParentPathFromString } from "utils/path";

export default class MakeMDPlugin extends Plugin implements IMakeMDPlugin {
    app: App;
    files: FilesystemMiddleware;
    obsidianAdapter: ObsidianFileSystem;

    activeEditorView?: MarkdownView;

    superstate: Superstate;
    ui: ObsidianUI;

    loadSuperState() {
        this.app.workspace.onLayoutReady(async () => {
            await this.superstate.initializeIndex();
            await this.obsidianAdapter.loadFilesFromObsidian();
            await this.superstate.initialize();
            await this.openFileTreeLeaf(this.superstate.settings.openSpacesOnLaunch);

            this.registerEvent(this.app.vault.on("delete", this.onDelete));
            this.registerEvent(this.app.vault.on("rename", this.onRename));
        });
    }
    loadViews() {
        this.registerView(FILE_TREE_VIEW_TYPE, (leaf) => {
            return new FileTreeView(leaf, this.superstate, this.ui);
        });
    }
    async loadSpaces() {
        document.body.classList.toggle("mk-folder-lines", this.superstate.settings.folderIndentationLines);

        patchFilesPlugin(this);

        this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.activeFileChange()));
        this.registerEvent(this.app.workspace.on("layout-change", () => this.activeFileChange()));
    }

    getActiveFile() {
        modifyTabSticker(this);
        const file = this.app.workspace.getActiveFile();
        if (!file) return null;

        const state = this.app.workspace.getMostRecentLeaf()?.view.getState() ?? {};

        return {
            path: file.path,
            state,
        };
    }
    activeFileChange() {
        const activeFile = this.getActiveFile();
        if (activeFile) {
            if (this.superstate.ui.activePath == activeFile?.path) {
                this.superstate.ui.setActiveState(activeFile.state);
                return;
            }
            this.superstate.ui.setActivePath(activeFile.path);
            this.superstate.ui.setActiveState(activeFile.state);
        }
    }

    loadCommands() {
        attachCommands(this);
    }
    loadContext() {
        this.app.workspace.onLayoutReady(async () => {
            setTimeout(() => this.activeFileChange(), 2000);
        });
    }

    public basics: unknown;
    private debouncedRefresh: () => void = () => null;

    openPath = async (leaf: WorkspaceLeaf, path: string, _flow?: boolean) => {
        const uri = this.superstate.spaceManager.uriByString(path);
        if (!uri)
            return;

        if (uri.scheme == "https" || uri.scheme == "http") {
            if (this.superstate.spacesIndex.has(path)) {
                const space = this.superstate.spacesIndex.get(path)?.space.notePath;
                const file = space ? (getAbstractFileAtPath(this.app, space) as TFile) : null;
                if (file) await openTFile(leaf, file, this.app);
                return;
            }
            window.open(uri.fullPath, "_blank");
            return;
        }

        if (uri.scheme == "obsidian" && uri.authority == "settings") {
            this.app.setting.open();
            this.app.setting.openTabById(this.manifest.id);
            return;
        }
        if (uri.scheme == "obsidian") {
            await leaf.setViewState({
                type: uri.authority,
            });
            return;
        }

        if (uri.scheme == "spaces")
            return;

        const f = await this.files.getFile(path);
        if (f) {
            if (f.isFolder)
                return;

            await openTFile(leaf, getAbstractFileAtPath(this.app, f.path) as TFile, this.app);
        } else {
            if (path.contains("/")) {
                const folder = removeTrailingSlashFromFolder(getParentPathFromString(path));
                const spaceFolder = this.superstate.spacesIndex.get(folder);
                if (spaceFolder)
                    await newPathInSpace(this.superstate, spaceFolder, fileExtensionForFile(path), fileNameForFile(path));
            } else {
                const f = await defaultSpace(this.superstate, this.superstate.pathsIndex.get(this.superstate.ui.activePath));
                if (f) await newPathInSpace(this.superstate, f, fileExtensionForFile(path), fileNameForFile(path));
            }
        }
    };

    async onload() {
        const start = Date.now();

        this.files = FilesystemMiddleware.create();
        this.obsidianAdapter = new ObsidianFileSystem(this, this.files);
        this.files.initiateFileSystemAdapter(this.obsidianAdapter, true);

        this.files.initiateFiletypeAdapter(new JSONFiletypeAdapter(this));

        this.files.initiateFiletypeAdapter(new ObsidianMarkdownFiletypeAdapter(this));
        this.files.initiateFiletypeAdapter(new ObsidianCanvasFiletypeAdapter(this));
        this.files.initiateFiletypeAdapter(new ObsidianBaseFiletypeAdapter(this));

        const filesystemCosmoform = new FilesystemSpaceAdapter(this.files, SPACE_FOLDER);
        this.ui = new ObsidianUI(this);
        const uiManager = UIManager.create(this.ui);
        this.superstate = Superstate.create(
            "0.9",
            () => { this.debouncedRefresh(); },
            new SpaceManager(),
            uiManager,
        );
        await this.loadSettings();

        this.superstate.spaceManager.addSpaceAdapter(filesystemCosmoform, true);

        this.superstate.saveSettings = (refresh = true) => this.saveSettings(refresh);
        this.loadViews();

        const cachePersister: LocalCachePersister = new LocalStorageCache(`${SPACE_FOLDER}/${ObsidianFileSystem.stateFileName}`, new LocalSqliteStorage(this, this.files), ["path", "space"]);

        await cachePersister.initialize()
        this.superstate.persister = cachePersister;

        this.loadSuperState();
        this.addSettingTab(new MakeMDPluginSettingsTab(this.app, this));
        await this.loadSpaces();
        this.loadContext();

        this.loadCommands();

        this.superstate.ui.notify(`Make.md - Plugin loaded in ${(Date.now() - start) / 1000} seconds`, "console");
    }

    onDelete = async (_file: TAbstractFile) => {
        this.activeFileChange();
    };
    onRename = async (_file: TAbstractFile, _oldPath: string) => {
        this.activeFileChange();
    };

    openFileTreeLeaf = async (showAfterAttach: boolean) => {
        const leafs = this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE);
        if (leafs.length == 0) {
            const leaf = this.app.workspace.getLeftLeaf(false) || this.app.workspace.getRightLeaf(false);
            await leaf.setViewState({ type: FILE_TREE_VIEW_TYPE });
            if (showAfterAttach && !this.app.workspace.leftSplit.collapsed)
                this.app.workspace.revealLeaf(leaf);
        } else {
            if (!this.app.workspace.leftSplit.collapsed && showAfterAttach) {
                for (const leaf of leafs) {
                    if (leaf.view instanceof FileTreeView)
                        leaf.view.destroy();
                    leaf.detach();
                }
                const leaf = this.app.workspace.getLeftLeaf(false) || this.app.workspace.getRightLeaf(false);
                await leaf.setViewState({ type: FILE_TREE_VIEW_TYPE });
                this.app.workspace.revealLeaf(leaf);
            }
        }

        this.closeDuplicateFileTreeLeaves();
    };
    closeDuplicateFileTreeLeaves = () => {
        try {
            //@ts-ignore
            this.app.workspace.leftSplit.children[0].children.filter((f, i, a) => i != a.findIndex((g) => g.view.getViewType() == f.view.getViewType())).forEach((g) => this.app.workspace.leftSplit.children[0].removeChild(g));
        } catch {}
    };
    detachFileTreeLeaves = () => {
        const leafs = this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE);
        for (const leaf of leafs) {
            if (leaf.view instanceof FileTreeView) leaf.view.destroy();
            leaf.detach();
        }
    };

    async loadSettings() {
        this.superstate.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        if (this.superstate.settings.hiddenExtensions.length == 1 && this.superstate.settings.hiddenExtensions[0] == ".mdb") {
            this.superstate.settings.hiddenExtensions = DEFAULT_SETTINGS.hiddenExtensions;
        }
        const userConfig = safelyParseJSON(await defaultConfigFile(this));
        this.superstate.settings.newFileFolderPath = userConfig.newFileFolderPath;
        this.superstate.settings.newFileLocation = userConfig.newFileLocation;
        this.saveSettings();
    }

    // @param refresh: `false` persists settings only; `true` also broadcasts `settingsChanged`
    //     so subscribers can rebuild state derived from global plugin settings.
    async saveSettings(refresh = true) {
        await this.saveData(this.superstate.settings);
        this.obsidianAdapter.setSettingsLastUpdatedDate();

        if (refresh)
            this.superstate.dispatchEvent("settingsChanged", null);
    }

    async onunload() {
        this.superstate?.unload();
        await this.superstate?.persister?.unload();
        this.detachFileTreeLeaves();
        this.ui?.destroy();
    }
}
