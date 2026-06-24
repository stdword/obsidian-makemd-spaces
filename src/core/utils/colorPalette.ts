import i18n from "shared/i18n";

export interface ColorPaletteColor {
    name: string;
    value: string;
    category?: string;
}

export interface ColorPalette {
    id: string;
    name: string;
    colors: ColorPaletteColor[];
}

export const defaultColorPalettes: ColorPalette[] = [
    {
        id: "default-palette",
        name: "Default Colors",
        colors: [
            { name: i18n.colors.red, value: "var(--mk-color-red)", category: "brand" },
            { name: i18n.colors.pink, value: "var(--mk-color-pink)", category: "brand" },
            { name: i18n.colors.orange, value: "var(--mk-color-orange)", category: "brand" },
            { name: i18n.colors.yellow, value: "var(--mk-color-yellow)", category: "brand" },
            { name: i18n.colors.green, value: "var(--mk-color-green)", category: "brand" },
            { name: i18n.colors.turquoise, value: "var(--mk-color-turquoise)", category: "brand" },
            { name: i18n.colors.teal, value: "var(--mk-color-teal)", category: "brand" },
            { name: i18n.colors.blue, value: "var(--mk-color-blue)", category: "brand" },
            { name: i18n.colors.purple, value: "var(--mk-color-purple)", category: "brand" },
            { name: i18n.colors.brown, value: "var(--mk-color-brown)", category: "brand" },
            { name: i18n.colors.charcoal, value: "var(--mk-color-charcoal)", category: "brand" },
            { name: i18n.colors.gray, value: "var(--mk-color-gray)", category: "brand" },
        ],
    },
    {
        id: "monochrome-palette",
        name: "Monochrome Colors",
        colors: [
            { name: i18n.colors.base0, value: "var(--mk-color-base-0)", category: "base" },
            { name: i18n.colors.base10, value: "var(--mk-color-base-10)", category: "base" },
            { name: i18n.colors.base20, value: "var(--mk-color-base-20)", category: "base" },
            { name: i18n.colors.base30, value: "var(--mk-color-base-30)", category: "base" },
            { name: i18n.colors.base40, value: "var(--mk-color-base-40)", category: "base" },
            { name: i18n.colors.base50, value: "var(--mk-color-base-50)", category: "base" },
            { name: i18n.colors.base60, value: "var(--mk-color-base-60)", category: "base" },
            { name: i18n.colors.base70, value: "var(--mk-color-base-70)", category: "base" },
            { name: i18n.colors.base100, value: "var(--mk-color-base-100)", category: "base" },
        ],
    },
    {
        id: "pastel-palette",
        name: "Pastel Colors",
        colors: [
            { name: i18n.colors.lightPink, value: "#FFB6C1", category: "custom" },
            { name: i18n.colors.gold, value: "#FFD700", category: "custom" },
            { name: i18n.colors.paleGreen, value: "#98FB98", category: "custom" },
            { name: i18n.colors.skyBlue, value: "#87CEEB", category: "custom" },
            { name: i18n.colors.plum, value: "#DDA0DD", category: "custom" },
            { name: i18n.colors.khaki, value: "#F0E68C", category: "custom" },
            { name: i18n.colors.lightSalmon, value: "#FFA07A", category: "custom" },
            { name: i18n.colors.powderBlue, value: "#B0E0E6", category: "custom" },
            { name: i18n.colors.moccasin, value: "#FFE4B5", category: "custom" },
            { name: i18n.colors.lavender, value: "#E6E6FA", category: "custom" },
        ],
    },
];

export const getColorPalettes = (): ColorPalette[] => {
    return defaultColorPalettes;
};

// UI color arrays that combine CSS variables with palette colors
export const getBackgroundColors = (): [string, string][] => [
    ["Background", "var(--mk-ui-background)"],
    ["Background Variant", "var(--mk-ui-background-variant)"],
    ["Background Contrast", "var(--mk-ui-background-contrast)"],
    ["Background Active", "var(--mk-ui-background-active)"],
    ["Background Selected", "var(--mk-ui-background-selected)"],
];

export const getTextColors = (): [string, string][] => [
    ["Text Primary", "var(--mk-ui-text-primary)"],
    ["Text Secondary", "var(--mk-ui-text-secondary)"],
    ["Text Tertiary", "var(--mk-ui-text-tertiary)"],
];

export const shiftColor = (color: string, s: number, l: number) => {
    const rgb = hexToRgb(color);
    const hsl = rgbToHsl(...rgb);
    return rgbToHex(...hslToRgb(hsl[0], hsl[1] + s, hsl[2] + l));
};

export const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    let r, g, b;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

export const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0,
        s = 0,
        l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }

    return [h * 360, s * 100, l * 100];
};

export const hexToRgb = (hex: string): [number, number, number] | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null;
};

export const rgbToHex = (r: number, g: number, b: number): string => {
    return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
};
