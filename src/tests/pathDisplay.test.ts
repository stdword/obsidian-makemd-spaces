import { pathDisplayInfo } from "core/react/components/UI/pathDisplay";

describe("path display", () => {
    it.each([
        ["Workspace/Note.md", "file", "ui//file-text", "Note", undefined],
        ["Workspace/Data.base", "file", "ui//table", "Data", undefined],
        ["Workspace/Map.canvas", "file", "ui//layout-dashboard", "Map", undefined],
        ["Workspace/Sketch.excalidraw.md", "file", "ui//excalidraw", "Sketch", undefined],
        ["Workspace/Photo.png", "file", "ui//image", "Photo", ".png"],
        ["Workspace/Document.pdf", "file", "ui//file", "Document", ".pdf"],
        ["Workspace/Archive.zip", "file", "ui//file", "Archive", ".zip"],
        ["Workspace/Projects", "folder", "lucide//folder-closed", "Projects", undefined],
        ["spaces://#art", "folder", "lucide//hash", "art", undefined],
        ["/", "folder", "ui//home", "Home", undefined],
    ] as const)("describes %s", (path, type, icon, title, extension?) => {
        expect(pathDisplayInfo(path, type)).toEqual({ icon, title, ...(extension ? { extension } : {}) });
    });
});
