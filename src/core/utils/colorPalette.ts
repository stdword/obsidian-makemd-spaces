import { Superstate } from "makemd-core";
import { ColorPaletteAsset } from "shared/types/assets";

export interface ColorPaletteColor {
    name: string;
    value: string;
    category?: string;
}

export const getColorPalettes = (superstate: Superstate): ColorPaletteAsset[] => {
    // Check both possible asset manager references
    const assetManager = (superstate as any).assetManager || (superstate as any).assets;

    if (!assetManager) {
        console.warn("[ColorPalette] AssetManager not available in superstate");
        return [];
    }

    // Asset manager will ensure defaults exist if none are found
    const palettes = assetManager.getColorPalettes() || [];

    return palettes;
};

export const getColorPaletteById = (superstate: Superstate, paletteId: string): ColorPaletteAsset | undefined => {
    const palettes = getColorPalettes(superstate);
    return palettes.find((p) => p.id === paletteId);
};

export const getDefaultPalette = (superstate: Superstate): ColorPaletteAsset | undefined => {
    return getColorPaletteById(superstate, "default-palette");
};

export const getMonochromePalette = (superstate: Superstate): ColorPaletteAsset | undefined => {
    return getColorPaletteById(superstate, "monochrome-palette");
};

export const getThemeColors = (superstate: Superstate): ColorPaletteColor[] => {
    const defaultPalette = getDefaultPalette(superstate);
    return defaultPalette?.colors || [];
};

export const getMonochromeColors = (superstate: Superstate): ColorPaletteColor[] => {
    const monochromePalette = getMonochromePalette(superstate);
    return monochromePalette?.colors || [];
};

export const getAllColors = (superstate: Superstate): ColorPaletteColor[] => {
    const palettes = getColorPalettes(superstate);
    return palettes.flatMap((p) => p.colors);
};

export const getColorByName = (superstate: Superstate, name: string): string | undefined => {
    const colors = getAllColors(superstate);
    const color = colors.find((c) => c.name.toLowerCase() === name.toLowerCase());
    return color?.value;
};

// Legacy compatibility arrays for easier migration
export const getColors = (superstate: Superstate): [string, string][] => {
    return getThemeColors(superstate).map((c) => [c.name, c.value] as [string, string]);
};

export const getColorsBase = (superstate: Superstate): [string, string][] => {
    return getMonochromeColors(superstate).map((c) => [c.name, c.value] as [string, string]);
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
