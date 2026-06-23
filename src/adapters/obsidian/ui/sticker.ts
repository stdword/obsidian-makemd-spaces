import MakeMDPlugin from "main";
import { uiIconSet } from "shared/assets/icons";
import { emojiFromString, parseStickerString } from "shared/utils/stickers";
import { lucideIcon } from "./icons";

export const stickerFromString = (
    sticker: string,
    plugin: MakeMDPlugin,
    options?: {
        fontless?: boolean;
    },
) => {
    if (!sticker || typeof sticker != "string") return "";
    const [type, value] = parseStickerString(sticker);
    if (type == "" || type == "emoji") {
        // State-of-the-art solution for exact emoji bounding box fitting
        // Uses SVG foreignObject for perfect sizing and alignment
        const emoji = emojiFromString(value);

        // Method 1: SVG with foreignObject for precise control
        // Using 2x2 viewBox with 1.7px font-size for perfect alignment
        return `
            <svg viewBox="0 0 26 26" preserveAspectRatio="xMidYMid meet" style="width: var(--icon-size); height: var(--icon-size); display: inline-block; vertical-align: middle;">
                <foreignObject x="0" y="0" width="26" height="26">
                    <div xmlns="http://www.w3.org/1999/xhtml" style="
                        position: relative;
                        width: 26px;
                        height: 26px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">
                        <span class="mk-emoji-icon-span${options?.fontless ? " fontless" : ""}">${emoji}</span>
                    </div>
                </foreignObject>
            </svg>
        `;
    } else if (type == "ui")
        return uiIconSet[value];
    else if (type == "lucide")
        return lucideIcon(value);

    return "";
};
