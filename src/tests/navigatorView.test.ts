import { readFileSync } from "fs";

describe("FileTreeView.onClose", () => {
    it("does not recreate the view when the panel is closed", () => {
        const source = readFileSync("src/adapters/obsidian/ui/navigator/NavigatorView.tsx", "utf8");
        const onClose = source.slice(source.indexOf("async onClose()"), source.indexOf("destroy() {"));
        expect(onClose).not.toContain("setViewState");
        expect(onClose).not.toContain("getLeftLeaf");
        expect(onClose).toContain("this.destroy();");
    });
});
