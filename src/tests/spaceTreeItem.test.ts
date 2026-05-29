import { shouldShowFileTag } from "core/react/components/Navigator/SpaceTree/fileTags";

describe("shouldShowFileTag", () => {
    it("hides tags for registered file extensions", () => {
        expect(shouldShowFileTag(false, "md")).toBe(false);
        expect(shouldShowFileTag(false, "base")).toBe(false);
        expect(shouldShowFileTag(false, "canvas")).toBe(false);
        expect(shouldShowFileTag(false, "excalidraw")).toBe(false);
    });

    it("shows tags only for unregistered file extensions", () => {
        expect(shouldShowFileTag(false, "pdf")).toBe(true);
        expect(shouldShowFileTag(false, "")).toBe(false);
        expect(shouldShowFileTag(true, "pdf")).toBe(false);
    });
});
