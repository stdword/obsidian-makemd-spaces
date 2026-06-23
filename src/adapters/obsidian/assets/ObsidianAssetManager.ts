import i18n from "shared/i18n";
import { Asset, AssetCacheStats, AssetLoadOptions, AssetManagerEvents, AssetType, AudioAsset, ColorPaletteAsset, CoverImage, IAssetManager, ImageAsset, ModelAsset, TextureAsset, VisualizationAsset, VisualizationConfig } from "shared/types/assets";

export class ObsidianAssetManager implements IAssetManager {
    private assets: Map<string, Asset> = new Map();
    private cache: Map<string, string> = new Map();
    private eventListeners: Map<string, Array<(...args: unknown[]) => void>> = new Map();
    private cacheStats = {
        hits: 0,
        misses: 0,
        totalRequests: 0,
    };

    public coverImages: Map<string, CoverImage> = new Map();

    public async initialize(): Promise<void> {
        await this.ensureDefaultPalettes(new Set());
    }

    private async ensureDefaultPalettes(loadedIds: Set<string>): Promise<void> {
        if (!loadedIds.has("default-palette")) {
            this.assets.set("default-palette", {
                id: "default-palette",
                name: "Default Colors",
                path: "default-palette",
                type: "colorpalette",
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
                gradients: [],
                designSystemMapping: {
                    baseTokens: {
                        "mk-color-red": "var(--mk-color-red)",
                        "mk-color-blue": "var(--mk-color-blue)",
                        "mk-color-green": "var(--mk-color-green)",
                        "mk-color-purple": "var(--mk-color-purple)",
                        "mk-color-orange": "var(--mk-color-orange)",
                        "mk-color-yellow": "var(--mk-color-yellow)",
                        "mk-color-pink": "var(--mk-color-pink)",
                        "mk-color-turquoise": "var(--mk-color-turquoise)",
                        "mk-color-teal": "var(--mk-color-teal)",
                        "mk-color-brown": "var(--mk-color-brown)",
                        "mk-color-charcoal": "var(--mk-color-charcoal)",
                        "mk-color-gray": "var(--mk-color-gray)",
                    },
                    semanticTokens: {},
                },
                tags: ["default", "theme"],
                category: "theme",
                description: i18n.descriptions.defaultMakemlColorPaletteWithThemeColors,
                created: Date.now(),
                modified: Date.now(),
            });
        }

        if (!loadedIds.has("monochrome-palette")) {
            this.assets.set("monochrome-palette", {
                id: "monochrome-palette",
                name: "Monochrome Colors",
                path: "monochrome-palette",
                type: "colorpalette",
                colors: [
                    { name: i18n.labels.base0, value: "var(--mk-color-base-0)", category: "base" },
                    { name: i18n.labels.base10, value: "var(--mk-color-base-10)", category: "base" },
                    { name: i18n.labels.base20, value: "var(--mk-color-base-20)", category: "base" },
                    { name: i18n.labels.base30, value: "var(--mk-color-base-30)", category: "base" },
                    { name: i18n.labels.base40, value: "var(--mk-color-base-40)", category: "base" },
                    { name: i18n.labels.base50, value: "var(--mk-color-base-50)", category: "base" },
                    { name: i18n.labels.base60, value: "var(--mk-color-base-60)", category: "base" },
                    { name: i18n.labels.base70, value: "var(--mk-color-base-70)", category: "base" },
                    { name: i18n.labels.base100, value: "var(--mk-color-base-100)", category: "base" },
                ],
                gradients: [],
                designSystemMapping: {
                    baseTokens: {
                        "mk-color-base-0": "var(--mk-color-base-0)",
                        "mk-color-base-10": "var(--mk-color-base-10)",
                        "mk-color-base-20": "var(--mk-color-base-20)",
                        "mk-color-base-30": "var(--mk-color-base-30)",
                        "mk-color-base-40": "var(--mk-color-base-40)",
                        "mk-color-base-50": "var(--mk-color-base-50)",
                        "mk-color-base-60": "var(--mk-color-base-60)",
                        "mk-color-base-70": "var(--mk-color-base-70)",
                        "mk-color-base-80": "var(--mk-color-base-80)",
                        "mk-color-base-90": "var(--mk-color-base-90)",
                        "mk-color-base-100": "var(--mk-color-base-100)",
                    },
                    semanticTokens: {},
                },
                tags: ["default", "monochrome", "base"],
                category: "theme",
                description: i18n.descriptions.monochromeColorPaletteWithBaseColors,
                created: Date.now(),
                modified: Date.now(),
            });
        }

        if (!loadedIds.has("default-gradient-palette")) {
            this.assets.set("default-gradient-palette", {
                id: "default-gradient-palette",
                name: i18n.labels.gradients,
                path: "default-gradient-palette",
                type: "colorpalette",
                colors: [
                    { name: "Warm Sunset", value: "linear-gradient(135deg, #ffff84 0%, #ff6164 50%, #b00012 100%)", category: "custom" },
                    { name: "Earth Tones", value: "linear-gradient(90deg, #a47451 0%, #9c9881 17%, #73a09d 33%, #3b899a 50%, #095b79 67%, #002847 83%, #000116 100%)", category: "custom" },
                    { name: "Golden Pink", value: "linear-gradient(45deg, #fada61 0%, #ff9188 50%, #ff5acd 100%)", category: "custom" },
                    { name: "Soft Pink", value: "linear-gradient(45deg, #fc8ec5 0%, #ff8dd3 25%, #ffa1d8 50%, #ffc1d2 75%, #ffe0c3 100%)", category: "custom" },
                    { name: "Purple Gold", value: "linear-gradient(45deg, #4159d0 0%, #c84fc0 50%, #ffcd70 100%)", category: "custom" },
                    { name: "Cyan Purple", value: "linear-gradient(45deg, #23d4fd 0%, #3a98f0 50%, #b721ff 100%)", category: "custom" },
                ],
                designSystemMapping: {
                    baseTokens: {},
                    semanticTokens: {},
                },
                tags: ["default", "gradients"],
                category: "material",
                description: i18n.descriptions.defaultGradientPaletteWithBeautifulGradients,
                created: Date.now(),
                modified: Date.now(),
            });
        }

        if (!loadedIds.has("pastel-palette")) {
            this.assets.set("pastel-palette", {
                id: "pastel-palette",
                name: "Pastel Colors",
                path: "pastel-palette",
                type: "colorpalette",
                colors: [
                    { name: "Light Pink", value: "#FFB6C1", category: "custom" },
                    { name: i18n.colors.gold, value: "#FFD700", category: "custom" },
                    { name: "Pale Green", value: "#98FB98", category: "custom" },
                    { name: "Sky Blue", value: "#87CEEB", category: "custom" },
                    { name: i18n.colors.plum, value: "#DDA0DD", category: "custom" },
                    { name: i18n.colors.khaki, value: "#F0E68C", category: "custom" },
                    { name: "Light Salmon", value: "#FFA07A", category: "custom" },
                    { name: "Powder Blue", value: "#B0E0E6", category: "custom" },
                    { name: i18n.colors.moccasin, value: "#FFE4B5", category: "custom" },
                    { name: i18n.colors.lavender, value: "#E6E6FA", category: "custom" },
                ],
                designSystemMapping: {
                    baseTokens: {},
                    semanticTokens: {},
                },
                tags: ["default", "pastel", "light"],
                category: "theme",
                description: i18n.descriptions.softPastelColorsForGentleVisualizations,
                created: Date.now(),
                modified: Date.now(),
            });
        }
    }

    private dispatchEvent(event: string, ...args: any[]): void {
        const handlers = this.eventListeners.get(event) || [];
        handlers.forEach((handler) => handler(...args));
    }

    public on<K extends keyof AssetManagerEvents>(event: K, handler: AssetManagerEvents[K]): void {
        const handlers = this.eventListeners.get(event) || [];
        handlers.push(handler as any);
        this.eventListeners.set(event, handlers);
    }

    public off<K extends keyof AssetManagerEvents>(event: K, handler: AssetManagerEvents[K]): void {
        const handlers = this.eventListeners.get(event) || [];
        const index = handlers.indexOf(handler as any);
        if (index > -1) handlers.splice(index, 1);
    }

    public async loadAsset(path: string, options?: AssetLoadOptions): Promise<Asset | null> {
        return this.assets.get(path) ?? null;
    }

    public getAsset(id: string): Asset | null {
        return this.assets.get(id) || null;
    }

    public getCachedAsset(id: string): Asset | null {
        return this.assets.get(id) || null;
    }

    public async updateAsset(asset: Asset): Promise<boolean> {
        this.assets.set(asset.id, asset);
        this.dispatchEvent("assetUpdated", asset);
        return true;
    }

    public async deleteAsset(id: string): Promise<boolean> {
        const asset = this.assets.get(id);
        if (!asset) return false;
        this.assets.delete(id);
        this.dispatchEvent("assetDeleted", id);
        return true;
    }

    public getImages(): ImageAsset[] {
        return Array.from(this.assets.values()).filter((a) => a.type === "image") as ImageAsset[];
    }

    public getTextures(): TextureAsset[] {
        return Array.from(this.assets.values()).filter((a) => a.type === "texture") as TextureAsset[];
    }

    public getAudios(): AudioAsset[] {
        return Array.from(this.assets.values()).filter((a) => a.type === "audio") as AudioAsset[];
    }

    public getModels(): ModelAsset[] {
        return Array.from(this.assets.values()).filter((a) => a.type === "model") as ModelAsset[];
    }

    public getVisualizations(): VisualizationAsset[] {
        return Array.from(this.assets.values()).filter((a) => a.type === "visualization") as VisualizationAsset[];
    }

    public getColorPalettes(): ColorPaletteAsset[] {
        return Array.from(this.assets.values()).filter((a) => a.type === "colorpalette") as ColorPaletteAsset[];
    }

    public async resetDefaultPalettes(): Promise<void> {
        ["default-palette", "monochrome-palette", "default-gradient-palette", "pastel-palette"].forEach((paletteId) => this.assets.delete(paletteId));
        await this.ensureDefaultPalettes(new Set());
    }

    public async resetSinglePalette(paletteId: string): Promise<boolean> {
        if (!["default-palette", "monochrome-palette", "default-gradient-palette", "pastel-palette"].includes(paletteId)) return false;
        this.assets.delete(paletteId);
        await this.ensureDefaultPalettes(new Set());
        return true;
    }

    public async discoverAssets(basePath?: string): Promise<Asset[]> {
        return [];
    }

    public async reindexAssets(): Promise<void> {
        await this.initialize();
    }

    public async refreshAsset(id: string): Promise<Asset | null> {
        return this.assets.get(id) || null;
    }

    public async preloadAssets(assetIds: string[]): Promise<Asset[]> {
        return assetIds.map((id) => this.assets.get(id)).filter((asset): asset is Asset => Boolean(asset));
    }

    public clearCache(type?: AssetType): void {
        if (type) {
            for (const [id, asset] of this.assets.entries()) {
                if (asset.type === type) {
                    this.assets.delete(id);
                    this.cache.delete(id);
                }
            }
        } else {
            this.cache.clear();
        }
        this.dispatchEvent("cacheCleared");
    }

    public getCacheStats(): AssetCacheStats {
        const stats: AssetCacheStats = {
            totalAssets: this.assets.size,
            cachedAssets: this.cache.size,
            cacheSize: 0,
            hitRate: this.cacheStats.totalRequests > 0 ? (this.cacheStats.hits / this.cacheStats.totalRequests) * 100 : 0,
            byType: {} as any,
        };

        const types: AssetType[] = ["image", "texture", "audio", "model", "visualization", "colorpalette"];
        for (const type of types) {
            const assets = this.getAssetsByType(type);
            stats.byType[type] = {
                total: assets.length,
                cached: assets.filter((a) => this.cache.has(a.id)).length,
                size: 0,
            };
        }

        return stats;
    }

    public getAssetPath(id: string): string | null {
        return this.assets.get(id)?.path ?? null;
    }

    public isAssetCached(id: string): boolean {
        return this.cache.has(id);
    }

    public getAssetsByType(type: AssetType): Asset[] {
        return Array.from(this.assets.values()).filter((a) => a.type === type);
    }

    public searchAssets(query: string, type?: AssetType): Asset[] {
        const lowerQuery = query.toLowerCase();
        return Array.from(this.assets.values()).filter((asset) => {
            if (type && asset.type !== type) return false;
            return asset.name.toLowerCase().includes(lowerQuery) || asset.id.toLowerCase().includes(lowerQuery);
        });
    }

    public async saveVisualizationConfig(config: VisualizationConfig): Promise<boolean> {
        return true;
    }

    public async deleteVisualizationConfig(id: string): Promise<boolean> {
        return this.deleteAsset(id);
    }

    public async saveColorPalette(palette: ColorPaletteAsset): Promise<boolean> {
        this.assets.set(palette.id, palette);
        return true;
    }

    public async deleteColorPalette(id: string): Promise<boolean> {
        return this.deleteAsset(id);
    }

    public async loadColorPalette(path: string): Promise<ColorPaletteAsset | null> {
        const asset = await this.loadAsset(path);
        return asset && asset.type === "colorpalette" ? asset : null;
    }

    public async reloadColorPalette(id: string): Promise<ColorPaletteAsset | null> {
        const asset = await this.refreshAsset(id);
        return asset && asset.type === "colorpalette" ? asset : null;
    }

    public async addCoverImage(url: string, name: string, tags: string[] = []): Promise<boolean> {
        this.coverImages.set(url, {
            url,
            name,
            tags,
            created: Date.now(),
            modified: Date.now(),
        });
        return true;
    }

    public async removeCoverImage(url: string): Promise<boolean> {
        return this.coverImages.delete(url);
    }

    public getCoverImage(url: string): CoverImage | null {
        return this.coverImages.get(url) || null;
    }

    public getCoverImagesByTag(tag: string): CoverImage[] {
        return Array.from(this.coverImages.values()).filter((image) => image.tags.includes(tag));
    }

    public getCoverImagesByName(name: string): CoverImage[] {
        const lowerName = name.toLowerCase();
        return Array.from(this.coverImages.values()).filter((image) => image.name.toLowerCase().includes(lowerName));
    }

    public getAllCoverImages(): CoverImage[] {
        return Array.from(this.coverImages.values());
    }

    public async deleteVisualization(id: string): Promise<boolean> {
        return this.deleteAsset(id);
    }

    public async deleteImage(id: string): Promise<boolean> {
        return this.deleteAsset(id);
    }
}
