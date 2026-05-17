import MakeMDPlugin from "main";
import { MarkdownView } from "obsidian";
import { parseStickerString } from "shared/utils/stickers";
import { stickerFromString } from "../ui/sticker";

export const modifyTabSticker = (plugin: MakeMDPlugin) => {
    const leaf = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;
    if (leaf) {
        const file = plugin.app.workspace.getActiveFile();
        if (!file) return;
        const pathCache = plugin.superstate.pathsIndex.get(file.path);
        if (pathCache?.label.sticker && leaf.tabHeaderInnerIconEl) {
            const [stickerType, stickerPath] = parseStickerString(pathCache.label.sticker);
            if (stickerType == "image") {
                const path = plugin.superstate.ui.getUIPath(plugin.superstate.imagesCache.get(stickerPath));
                if (path) leaf.tabHeaderInnerIconEl.innerHTML = `<img src="${path}" />`;
            } else {
                const icon = stickerFromString(pathCache.label.sticker, plugin);
                leaf.tabHeaderInnerIconEl.innerHTML = icon;
            }
        }
        return;
    }
};
