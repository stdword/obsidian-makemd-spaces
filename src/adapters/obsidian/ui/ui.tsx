import MakeMDPlugin from "main";
import { Sticker, Superstate, UIAdapter, UIManager } from "makemd-core";
import i18n from "shared/i18n";
import { Menu, Notice, Platform, TFile, getIcon } from "obsidian";
import React from "react";

import { Container } from "react-dom";
import { Root, createRoot } from "react-dom/client";
import { emojis } from "shared/assets/emoji";
import { Pos, Rect } from "shared/types/Pos";
import { EmojiData } from "shared/types/emojis";
import { TargetLocation } from "shared/types/path";
import { MenuObject } from "shared/types/menu";
import { openPathInElement } from "adapters/obsidian/utils/openPathInElement";
import { getParentPathFromString } from "utils/path";
import { urlRegex } from "utils/regex";
import { ConfirmationModal } from "core/react/components/UI/Modals/ConfirmationModal";
import { removeSpace } from "core/utils/superstate/spaces";
import { getLineRangeFromRef } from "utils/obsidian";
import { getAbstractFileAtPath, getLeaf } from "../utils/file";
import { modifyTabSticker } from "../utils/modifyTabSticker";
import { WindowManager } from "./WindowManager";
import { lucideIcons } from "./icons";
import { showModal } from "./modal";
import { showMainMenu } from "./showMainMenu";
import { stickerFromString } from "./sticker";
import { isTagSpacePath, tagSpaceNameFromPath } from "schemas/builtin";

export class ObsidianUI implements UIAdapter {
    public manager: UIManager;
    public root: Root;
    private rootEl: HTMLDivElement;
    private destroyed = false;
    private floatingMenus = new Set<MenuObject>();
    public constructor(public plugin: MakeMDPlugin) {
        const newDiv = document.createElement("div");
        document.body.appendChild(newDiv);
        newDiv.className = "mk-root";
        this.rootEl = newDiv;
        this.createRoot = () => null;
        this.getRoot = () => null;
        this.root = createRoot(newDiv);
        this.root.render(<WindowManager ui={this}></WindowManager>);
    }

    public destroy = () => {
        if (this.destroyed) return;
        this.destroyed = true;
        Array.from(this.floatingMenus).forEach((menu) => menu.hide(false, true));
        this.floatingMenus.clear();
        this.manager?.destroy();
        this.root.unmount();
        this.rootEl.remove();
    };

    private trackMenuObject(menu: MenuObject): MenuObject {
        this.floatingMenus.add(menu);
        const hide = menu.hide;
        menu.hide = (suppress?: boolean, immediate?: boolean) => {
            this.floatingMenus.delete(menu);
            hide(suppress, immediate);
        };
        return menu;
    }

    public createRoot: typeof createRoot;
    public getRoot: (container: Container) => Root;

    public availableViews = () => {
        //@ts-ignore
        return Object.keys(this.plugin.app.viewRegistry.typeByExtension);
    };

    public quickOpen = (mode?: number, _offset?: Rect, _win?: Window, onSelect?: (link: string) => void, source?: string) => {
        this.plugin.quickOpen(this.manager.superstate, mode, onSelect, source);
    };
    public mainMenu = (el: HTMLElement, superstate: Superstate) => {
        showMainMenu(el, superstate, this.plugin);
    };
    public onMetadataRefresh = () => {
        modifyTabSticker(this.plugin);
    };
    public navigationHistory = () => {
        return this.plugin.app.workspace.getLastOpenFiles();
    };
    public isPluginEnabled = (id: string) => Boolean(this.plugin.app.plugins.getPlugin(id));
    public createExcalidrawDrawing = async (folder?: string) => {
        const excalidraw = this.plugin.app.plugins.getPlugin("obsidian-excalidraw-plugin");
        if (!excalidraw?.createAndOpenDrawing) return;

        const path = await excalidraw.createAndOpenDrawing("Untitled.excalidraw.md", "new-tab", folder == "/" ? "" : folder);
        if (path) {
            this.manager.setActivePath(path);
        }
    };
    public getSticker = (icon: string, options?: Record<string, any>) => {
        return stickerFromString(icon, this.plugin, options);
    };

    public getOS = () => {
        return Platform.isMacOS ? "mac" : Platform.isWin ? "windows" : Platform.isLinux ? "linux" : Platform.isIosApp ? "ios" : Platform.isAndroidApp ? "android" : "unknown";
    };
    public openToast = (content: string) => {
        new Notice(content);
    };
    public openPalette = (modal: JSX.Element, win: Window, className: string) => {
        return this.trackMenuObject(
            showModal({
                ui: this,
                fc: modal,
                isPalette: true,
                className,
                win,
            }),
        );
    };

    public openModal = (title: string, modal: JSX.Element, win?: Window, className?: string, props?: any) => {
        return this.trackMenuObject(
            showModal({
                ui: this,
                fc: modal,
                title: title,
                className,
                props,
                win,
            }),
        );
    };
    public openPopover = (_position: Pos, _popover: JSX.Element) => {};

    public dragStarted = (e: React.DragEvent<HTMLDivElement>, paths: string[]) => {
        if (paths.length == 0) return;
        if (paths.length == 1) {
            const path = paths[0];
            const file = getAbstractFileAtPath(this.plugin.app, path);
            if (!file) {
                if (isTagSpacePath(path)) {
                    this.plugin.app.dragManager.onDragStart(e.nativeEvent, {
                        icon: "lucide-tags",
                        source: undefined,
                        title: `#${tagSpaceNameFromPath(path)}`,
                        type: "file",
                    });
                }
                return;
            }
            if (file instanceof TFile) {
                const dragData = this.plugin.app.dragManager.dragFile(e.nativeEvent, file);
                this.plugin.app.dragManager.onDragStart(e.nativeEvent, dragData);
            } else {
                this.plugin.app.dragManager.onDragStart(e.nativeEvent, {
                    icon: "lucide-folder",
                    source: undefined,
                    title: file.name,
                    type: "file",
                    file: file,
                });
                this.plugin.app.dragManager.dragFolder(e.nativeEvent, file, true);
            }
        } else {
            const files = paths.map((f) => getAbstractFileAtPath(this.plugin.app, f)).filter((f) => f);
            this.plugin.app.dragManager.onDragStart(
                { ...e, doc: document },
                {
                    icon: "lucide-files",
                    source: undefined,
                    title: i18n.labels.filesCount.replace("{$1}", files.length.toString()),
                    type: "files",
                    files: files,
                },
            );

            this.plugin.app.dragManager.dragFiles({ ...e, doc: document }, files, true);
        }
    };

    public setDragLabel = (label: string) => {
        this.plugin.app.dragManager.setAction(label);
    };

    public dragEnded = (_e: React.DragEvent<HTMLDivElement>) => {};

    public allStickers = () => {
        const allLucide: Sticker[] = lucideIcons.map((f) => ({
            name: f,
            type: "lucide",
            keywords: f,
            value: f,
            html: getIcon(f).outerHTML,
        }));

        const allEmojis: Sticker[] = Object.keys(emojis as EmojiData).reduce(
            (p, c: string) => [
                ...p,
                ...emojis[c].map((e) => ({
                    type: "emoji",
                    name: e.n[0],
                    value: e.u,
                    html: e.u,
                })),
            ],
            [],
        );

        return [...allEmojis, ...allLucide];
    };

    public getUIPath = (path: string): string => {
        const file = this.plugin.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) return `${this.plugin.app.vault.getResourcePath(file)}?${Math.floor(Math.random() * 1000)}`;
        else if (path?.match(urlRegex)) return path;

        const returnPath = getParentPathFromString(this.plugin.app.vault.getResourcePath(this.plugin.app.vault.getRoot() as any));
        return `${returnPath}${path}?${Math.floor(Math.random() * 1000)}`;
    };
    public viewsByPath = (path: string) => {
        const abstractFile = getAbstractFileAtPath(this.plugin.app, path);
        if (abstractFile instanceof TFile) {
            return this.plugin.app.workspace
                .getLeavesOfType("markdown")
                .filter((f) => {
                    return f.view.file?.path == path;
                })
                .map((f) => {
                    return {
                        path: f.view.file?.path as string,
                        openPath: (_path: string) => {
                            f.openFile(abstractFile as TFile);
                        },
                        parent: null as any,
                        children: [] as any[],
                    };
                });
        }
        return [];
    };
    public openPath = async (path: string, newLeaf: TargetLocation, source?: any, props?: Record<string, any>) => {
        if (newLeaf == "system") {
            // @ts-ignore
            this.plugin.app.showInFolder(path);
            return;
        }

        if (source) {
            const uri = this.plugin.superstate.spaceManager.uriByString(path);
            openPathInElement(
                this.plugin.app,
                this.plugin.app.workspace.getLeaf(), // workspaceLeafForDom(this.plugin.app, source),
                source,
                null,
                async (editor) => {
                    const leaf = editor.attachLeaf();
                    if (this.plugin.app.vault.getAbstractFileByPath(uri.basePath) instanceof TFile) {
                        await leaf.openFile(this.plugin.app.vault.getAbstractFileByPath(uri.basePath) as TFile);

                        const selectiveRange = getLineRangeFromRef(uri.basePath, uri.refStr, this.plugin.app);
                        if (!leaf.view?.editor) {
                            return;
                        }
                        if (props?.readOnly) {
                            leaf.setViewState({
                                type: "markdown",
                                state: { mode: "preview" },
                            });
                        } else {
                            if (selectiveRange[0] && selectiveRange[1]) {
                                leaf.view.editor?.cm.dispatch({
                                    // annotations: [editableRange.of(selectiveRange)],
                                });
                            }
                        }
                    } else {
                        await this.plugin.openPath(leaf, path, true);
                    }
                },
            );
            return;
        }
        const leaf = getLeaf(this.plugin.app, newLeaf);
        await this.plugin.openPath(leaf, path);
    };
    public hasNativePathMenu = (_path: string) => {
        return true;
    };
    public nativePathMenu = (e: React.MouseEvent, path: string) => {
        const file = this.plugin.app.vault.getAbstractFileByPath(path);
        if (file) {
            const fileMenu = new Menu();
            fileMenu.addItem((item) => {
                item.setTitle("Delete");
                item.setIcon("trash");
                item.onClick(() => {
                    if (file instanceof TFile) {
                        this.plugin.app.vault.delete(file);
                        return;
                    }
                    this.openModal(
                        i18n.labels.deleteFolder,
                        <ConfirmationModal
                            confirmAction={() => {
                                removeSpace(this.manager.superstate, path);
                            }}
                            confirmLabel={i18n.buttons.delete}
                            message={i18n.descriptions.deleteFolder}
                        ></ConfirmationModal>,
                        window,
                    );
                });
            });
            this.plugin.app.workspace.trigger("file-menu", fileMenu, file, "file-explorer");
            const rect = e.currentTarget.getBoundingClientRect();
            fileMenu.showAtPosition({ x: rect.left, y: rect.bottom });
        }
    };
}
