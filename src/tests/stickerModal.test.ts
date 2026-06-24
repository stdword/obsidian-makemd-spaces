import { defaultStickerCategory } from "shared/components/StickerModal";

describe("StickerModal", () => {
    it("opens on the lucide sticker category by default", () => {
        expect(defaultStickerCategory).toBe("lucide");
    });
});
