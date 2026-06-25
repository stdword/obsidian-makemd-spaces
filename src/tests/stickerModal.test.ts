import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StickerModal, { defaultStickerCategory } from "shared/components/StickerModal";

describe("StickerModal", () => {
    it("opens on the lucide sticker category by default", () => {
        expect(defaultStickerCategory).toBe("lucide");
    });

    it("does not render a manual find button because sticker search is live", () => {
        const ui = {
            allStickers: (): any[] => [],
        };

        const markup = renderToStaticMarkup(React.createElement(StickerModal, { ui: ui as any, selectedSticker: jest.fn() }));

        expect(markup).not.toContain(">Find</button>");
    });
});
