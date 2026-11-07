import MakeMDPlugin from "main";
import { MarkdownView } from "obsidian";
import { escapeHtml } from "utils/html";
import { parseStickerString } from "utils/stickers";
import { stickerFromString } from "../ui/sticker";

export const dedupeTabHeaderIconEl = (iconEl?: HTMLElement) => {
    if (!iconEl) return;

    const seenIcons = new Set<string>();
    Array.from(iconEl.children).forEach((child) => {
        const iconKey = child.outerHTML.trim();
        if (seenIcons.has(iconKey)) {
            child.remove();
            return;
        }
        seenIcons.add(iconKey);
    });
};

export const markTabStickerIcon = (iconEl?: HTMLElement) => {
    if (!iconEl) return;
    Array.from(iconEl.children).forEach((child) => child.setAttribute("data-mk-tab-sticker", "true"));
};

// Resource paths may contain quotes or angle brackets; they must stay inside the attribute.
export const tabStickerImageMarkup = (path: string) => `<img src="${escapeHtml(path)}" />`;

export const modifyTabSticker = (plugin: MakeMDPlugin) => {
    const activeLeaf = plugin.app.workspace.activeLeaf;
    dedupeTabHeaderIconEl(activeLeaf?.tabHeaderInnerIconEl);

    const leaf = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;
    if (leaf) {
        if (leaf.view?.getViewType() != "markdown") return;
        const file = plugin.app.workspace.getActiveFile();
        if (!file) return;
        const pathCache = plugin.superstate.pathsIndex.get(file.path);
        const sticker = pathCache?.sticker;
        if (sticker && leaf.tabHeaderInnerIconEl) {
            const [stickerType, stickerPath] = parseStickerString(sticker);
            if (stickerType == "image") {
                const path = plugin.superstate.ui.getUIPath(stickerPath);
                if (path) {
                    leaf.tabHeaderInnerIconEl.innerHTML = tabStickerImageMarkup(path);
                    markTabStickerIcon(leaf.tabHeaderInnerIconEl);
                }
            } else {
                const icon = stickerFromString(sticker, plugin);
                leaf.tabHeaderInnerIconEl.innerHTML = icon;
                markTabStickerIcon(leaf.tabHeaderInnerIconEl);
            }
        }
        return;
    }
};
