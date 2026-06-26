import { App, WorkspaceLeaf } from "obsidian";

export const openPathInElement = (app: App, parentLeaf: WorkspaceLeaf, _initiatingEl?: HTMLElement, fileName?: string, onShowCallback?: (leaf: { attachLeaf: () => WorkspaceLeaf; titleEl: HTMLElement }) => Promise<unknown>) => {
    const leaf = parentLeaf ?? app.workspace.getLeaf();
    const titleEl = document.createElement("div");
    if (fileName) {
        titleEl.textContent = fileName.substring(0, fileName.lastIndexOf("."));
    }
    onShowCallback?.({
        attachLeaf: () => leaf,
        titleEl,
    });
};
