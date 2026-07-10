import { pathDisplayInfo } from "core/react/components/UI/pathDisplay";

describe("path display", () => {
    it.each([
        ["Workspace/Note.md", "file", "ui//file-text", "Note"],
        ["Workspace/Data.base", "file", "ui//table", "Data"],
        ["Workspace/Map.canvas", "file", "ui//layout-dashboard", "Map"],
        ["Workspace/Sketch.excalidraw.md", "file", "ui//excalidraw", "Sketch"],
        ["Workspace/Photo.png", "file", "ui//image", "Photo.png"],
        ["Workspace/Document.pdf", "file", "ui//file", "Document.pdf"],
        ["Workspace/Archive.zip", "file", "ui//file", "Archive.zip"],
        ["Workspace/Projects", "folder", "lucide//folder-closed", "Projects"],
        ["spaces://#art", "folder", "lucide//hash", "art"],
        ["/", "folder", "ui//home", "Home"],
    ] as const)("describes %s", (path, type, icon, title) => {
        expect(pathDisplayInfo(path, type)).toEqual({ icon, title });
    });
});
