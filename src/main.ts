import { DEFAULT_SETTINGS } from "core/schemas/settings";
import { App, MarkdownView, Plugin, TAbstractFile, TFile, TFolder, WorkspaceLeaf, addIcon } from "obsidian";
import { MakeMDPluginSettingsTab } from "./adapters/obsidian/settings";
import { FILE_TREE_VIEW_TYPE, FileTreeView } from "./adapters/obsidian/ui/navigator/NavigatorView";

import { defaultConfigFile, fileExtensionForFile, fileNameForFile, getAbstractFileAtPath, openTFile, openTFolder, openTagContext } from "adapters/obsidian/utils/file";
import { FilesystemMiddleware, FilesystemSpaceAdapter, SpaceManager, UIManager } from "makemd-core";

import { mkLogo } from "adapters/obsidian/ui/icons";
import { patchFilesPlugin } from "adapters/obsidian/utils/patches";
import { safelyParseJSON } from "shared/utils/json";
import { SPACE_SUB_FOLDER } from "shared/constants";

import { MDBFileTypeAdapter } from "adapters/mdb/mdbAdapter";
import { ObsidianAssetManager } from "adapters/obsidian/assets/ObsidianAssetManager";
import { ObsidianFileSystem } from "adapters/obsidian/filesystem/filesystem";

import { ObsidianCanvasFiletypeAdapter } from "adapters/obsidian/filetypes/canvasAdapter";
import { ObsidianMarkdownFiletypeAdapter } from "adapters/obsidian/filetypes/markdownAdapter";
import { ObsidianUI } from "adapters/obsidian/ui/ui";

import { modifyTabSticker } from "adapters/obsidian/utils/modifyTabSticker";

import { IconFileTypeAdapter } from "adapters/icons/iconsAdapter";
import { openBlinkModal } from "core/react/components/Blink/Blink";
import { LocalCachePersister } from "shared/types/persister";

import { LocalStorageCache } from "adapters/mdb/localCache/localCache";
import { JSONFiletypeAdapter } from "adapters/obsidian/filetypes/jsonAdapter";

import { attachCommands } from "commands";
import { Superstate } from "core/superstate/superstate";
import { defaultSpace, newPathInSpace } from "core/superstate/utils/spaces";
import "css/DefaultVibe.css";
import "css/Menus/ColorPicker.css";
import "css/Menus/InlineMenu.css";
import "css/Menus/MainMenu.css";
import "css/Menus/MakeMenu.css";
import "css/Menus/Menu.css";
import "css/Menus/StickerMenu.css";
import "css/Modal/Modal.css";
import "css/Obsidian/Mods.css";
import "css/Panels/Blink.css";
import "css/Panels/ContextBuilder.css";
import "css/Panels/FileContext.css";
import "css/Panels/Navigator/FileTree.css";
import "css/Panels/Navigator/Focuses.css";
import "css/Panels/Navigator/Navigator.css";
import "css/System/Settings.css";
import "css/UI/Buttons.css";
import { IMakeMDPlugin } from "shared/types/makemd";
import { ISuperstate } from "shared/types/superstate";
import { windowFromDocument } from "shared/utils/dom";
import { removeTrailingSlashFromFolder } from "shared/utils/paths";
import { getParentPathFromString } from "utils/path";

export default class MakeMDPlugin extends Plugin implements IMakeMDPlugin {
    app: App;
    files: FilesystemMiddleware;
    obsidianAdapter: ObsidianFileSystem;
    mdbFileAdapter: MDBFileTypeAdapter;

    activeEditorView?: MarkdownView;

    superstate: Superstate;
    ui: ObsidianUI;

    quickOpen(superstate: ISuperstate, mode?: number, onSelect?: (link: string) => void, source?: string) {
        console.log("TRACE", "quickOpen", { superstate, mode, onSelect, source });
        const win = windowFromDocument(this.app.workspace.getLeaf()?.containerEl.ownerDocument);
        openBlinkModal(superstate, mode, win, onSelect, source);
    }

    loadSuperState() {
        this.app.workspace.onLayoutReady(async () => {
            await this.superstate.initializeIndex();
            this.obsidianAdapter.loadCacheFromObsidianCache();
            this.openFileTreeLeaf(this.superstate.settings.openSpacesOnLaunch);

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
        document.body.querySelector(".app-container").setAttribute("vaul-drawer-wrapper", "");

        document.body.classList.toggle("mk-spaces-right", this.superstate.settings.spacesRightSplit);

        this.superstate.settings.readableLineWidth = this.app.vault.getConfig("readableLineLength");
        document.body.classList.toggle("mk-readable-line", this.superstate.settings.readableLineWidth);

        document.body.classList.toggle("mk-folder-lines", this.superstate.settings.folderIndentationLines);

        patchFilesPlugin(this);

        this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.activeFileChange()));
        this.registerEvent(this.app.workspace.on("layout-change", () => this.activeFileChange()));
    }

    getActiveFile() {
        let filePath = null;
        let state = null;
        const leaf = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;

        const activeView = leaf?.view;
        if (!activeView) return null;

        if (activeView.getViewType() == "markdown") {
            filePath = activeView.file.path;
            state = activeView.getState();
            modifyTabSticker(this);
        }

        if (!filePath || !state) return null;

        return {
            path: filePath,
            state: state,
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

    openPath = async (leaf: WorkspaceLeaf, path: string, flow?: boolean) => {
        const uri = this.superstate.spaceManager.uriByString(path);
        console.log("TRACE", "openPath", path);
        if (!uri) return;

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

        if (uri.scheme == "spaces" || uri.scheme == "mk-core") {
            openTagContext(leaf, uri.basePath, this.app);
            return;
        }
        this.files.getFile(path).then((f) => {
            if (f) {
                if (f.isFolder) {
                    openTFolder(leaf, getAbstractFileAtPath(this.app, f.path) as TFolder, this, flow);
                } else if (f) {
                    openTFile(leaf, getAbstractFileAtPath(this.app, f.path) as TFile, this.app);
                } else {
                    return;
                }
            } else {
                if (path.contains("/")) {
                    const folder = removeTrailingSlashFromFolder(getParentPathFromString(path));
                    const spaceFolder = this.superstate.spacesIndex.get(folder);
                    if (spaceFolder) {
                        newPathInSpace(this.superstate, spaceFolder, fileExtensionForFile(path), fileNameForFile(path));
                    }
                } else {
                    defaultSpace(this.superstate, this.superstate.pathsIndex.get(this.superstate.ui.activePath)).then((f) => {
                        if (f) newPathInSpace(this.superstate, f, fileExtensionForFile(path), fileNameForFile(path));
                    });
                }
            }
        });
    };

    async onload() {
        const start = Date.now();
        this.mdbFileAdapter = new MDBFileTypeAdapter(this);

        this.files = FilesystemMiddleware.create();
        this.obsidianAdapter = new ObsidianFileSystem(this, this.files);
        this.files.initiateFileSystemAdapter(this.obsidianAdapter, true);
        this.files.initiateFiletypeAdapter(this.mdbFileAdapter);

        this.files.initiateFiletypeAdapter(new ObsidianMarkdownFiletypeAdapter(this));
        this.files.initiateFiletypeAdapter(new ObsidianCanvasFiletypeAdapter(this));
        this.files.initiateFiletypeAdapter(new JSONFiletypeAdapter(this));
        this.files.initiateFiletypeAdapter(new IconFileTypeAdapter(this));

        const filesystemCosmoform = new FilesystemSpaceAdapter(this.files, SPACE_SUB_FOLDER);
        this.ui = new ObsidianUI(this);
        const uiManager = UIManager.create(this.ui);
        this.superstate = Superstate.create(
            "0.9",
            () => {
                this.debouncedRefresh();
            },
            new SpaceManager(),
            uiManager,
        );
        await this.loadSettings();

        this.superstate.spaceManager.addSpaceAdapter(filesystemCosmoform, true);

        addIcon("mk-logo", mkLogo);

        this.superstate.saveSettings = () => this.saveSettings();
        this.loadViews();

        const cachePersister: LocalCachePersister = new LocalStorageCache(`${SPACE_SUB_FOLDER}/${ObsidianFileSystem.stateFileName}`, this.mdbFileAdapter, ["path", "space", "frame", "context", "icon"]);

        if (this.superstate.settings.cacheIndex) {
            await cachePersister.initialize();
        }
        this.superstate.persister = cachePersister;

        // Replace AssetManager with ObsidianAssetManager for direct filesystem access
        this.superstate.assets = new ObsidianAssetManager(this.superstate.spaceManager, this.superstate.ui, cachePersister, this);
        // Don't initialize here as it will be called during superstate.initialize()

        this.loadSuperState();
        this.addSettingTab(new MakeMDPluginSettingsTab(this.app, this));
        await this.loadSpaces();
        this.loadContext();

        this.loadCommands();

        this.superstate.ui.notify(`Make.md - Plugin loaded in ${(Date.now() - start) / 1000} seconds`, "console");
    }

    onDelete = async (file: TAbstractFile) => {
        this.activeFileChange();
    };
    onRename = async (file: TAbstractFile, oldPath: string) => {
        this.activeFileChange();
    };

    openFileTreeLeaf = async (showAfterAttach: boolean) => {
        const leafs = this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE);
        if (leafs.length == 0) {
            const leaf = this.superstate.settings.spacesRightSplit ? this.app.workspace.getRightLeaf(false) : this.app.workspace.getLeftLeaf(false);
            await leaf.setViewState({ type: FILE_TREE_VIEW_TYPE });
            if (showAfterAttach && !this.app.workspace.leftSplit.collapsed) this.app.workspace.revealLeaf(leaf);
        } else {
            if (!this.app.workspace.leftSplit.collapsed && showAfterAttach) {
                const leafs = this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE);
                for (const leaf of leafs) {
                    if (leaf.view instanceof FileTreeView) leaf.view.destroy();
                    leaf.detach();
                }
                const leaf = this.superstate.settings.spacesRightSplit ? this.app.workspace.getRightLeaf(false) : this.app.workspace.getLeftLeaf(false);
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
    async saveSettings(refresh = true) {
        await this.saveData(this.superstate.settings);
        this.obsidianAdapter.setSettingsLastUpdatedDate();
        if (refresh) this.superstate.dispatchEvent("settingsChanged", null);
    }

    onunload() {
        this.superstate.persister.unload();
        this.detachFileTreeLeaves();
    }
}
