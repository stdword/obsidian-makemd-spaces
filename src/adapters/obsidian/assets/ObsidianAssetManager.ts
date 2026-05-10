import i18n from "shared/i18n";
import { SPACE_SUB_FOLDER } from "shared/constants";

import MakeMDPlugin from 'main';
import { normalizePath } from 'obsidian';
import { emojis } from 'shared/assets/emoji';
import {
  Asset,
  AssetCacheStats,
  AssetLoadOptions,
  AssetManagerEvents,
  AssetType,
  AudioAsset,
  ColorPaletteAsset,
  CoverImage,
  IAssetManager,
  IconAsset,
  IconMetadata,
  IconsetAsset,
  ImageAsset,
  ModelAsset,
  TextureAsset,
  VisualizationAsset,
  VisualizationConfig
} from 'shared/types/assets';
import { LocalCachePersister } from 'shared/types/persister';
import { SpaceManagerInterface } from 'shared/types/spaceManager';
import { IUIManager } from 'shared/types/uiManager';
import { ASSETS_SPACE_CONFIG } from 'shared/utils/assetSchemas';
import { lucideIcons } from '../ui/icons';

export class ObsidianAssetManager implements IAssetManager {
  private assets: Map<string, Asset> = new Map();
  private cache: Map<string, string> = new Map(); // id -> cached content (base64/text)
  private loadPromises: Map<string, Promise<Asset | null>> = new Map();
  private eventListeners: Map<string, Array<(...args: unknown[]) => void>> = new Map();
  private cacheStats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
  };
  
  // Icon caches and mappings
  public iconsCache: Map<string, string> = new Map(); // iconId -> svg/content
  public iconsetCaches: Map<string, Map<string, string>> = new Map(); // iconsetId -> Map<iconId, svg/content>
  private iconPathMetadata: Map<string, { iconsetId: string; iconId: string }> = new Map();
  public iconPathMapping: Map<string, string> = new Map(); // iconName -> full path to icon file
  
  // Cover images mapping
  public coverImages: Map<string, CoverImage> = new Map();

  private readonly ASSETS_SPACE_PATH = ASSETS_SPACE_CONFIG.ASSETS_SPACE_PATH;

  constructor(
    private spaceManager: SpaceManagerInterface,
    protected ui: IUIManager,
    protected persister: LocalCachePersister | undefined,
    private plugin: MakeMDPlugin
  ) {
    // Constructor
  }

  // This needs to be called during superstate initialization
  public async initialize(): Promise<void> {
    try {
      
      if (!await this.pathExists(SPACE_SUB_FOLDER)) {
        await this.createDirectory(SPACE_SUB_FOLDER);
      }
      
      await this.initializeAssets();
      
      // Load cached icons from persister if available
      if (this.persister) {
        await this.loadCachedIcons();
      }
      
    } catch (error) {
      console.error('[ObsidianAssetManager] Failed to initialize:', error);
    }
  }
  
  // Load cached icons from persister
  private async loadCachedIcons(): Promise<void> {
    if (!this.persister) return;
    
    try {
      const cachedIcons = await this.persister.loadAll('icon');
      for (const row of cachedIcons) {
        if (row.path && row.cache) {
          this.iconsCache.set(row.path, row.cache);
          
          // Extract icon name and cache with various keys
          const fileName = row.path.split('/').pop();
          let nameWithoutExt = '';
          
          if (fileName) {
            nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
            this.iconsCache.set(nameWithoutExt, row.cache);
          }
          
          // If the path looks like an iconset path (folder/file.ext), also cache with iconset format
          const pathParts = row.path.split('/');
          if (pathParts.length >= 2 && fileName && nameWithoutExt && !row.path.startsWith('http')) {
            // Extract iconset ID (first part of path) and icon name
            const iconsetId = pathParts[0];
            const iconName = nameWithoutExt;
            const iconsetKey = `${iconsetId}//${iconName}`;
            this.iconsCache.set(iconsetKey, row.cache);
          }
        }
      }
    } catch (error) {
      console.error('[ObsidianAssetManager] Failed to load cached icons:', error);
    }
  }

  // Initialize asset system by discovering existing assets
  private async initializeAssets(): Promise<void> {
    try {
      
      // Check if assets space exists
      const spaceExists = await this.pathExists(this.ASSETS_SPACE_PATH);

      await this.discoverAssets();
      
      await this.loadExistingAssets();
      
      // Migrate any existing icons from superstate cache
      this.migrateIconsFromSuperstate();
      
    } catch (error) {
      console.error('Failed to initialize assets:', error);
    }
  }

  // Load existing assets from JSON files and directories
  private async loadExistingAssets(): Promise<void> {
    try {
      // Ensure default iconsets exist
      await this.ensureDefaultIconsets();

      await this.ensureDefaultPalettes(new Set());

    } catch (error) {
      console.error('Failed to load existing assets:', error);
    }
  }

  // File system operations using Obsidian's adapter
  protected async readPath(path: string): Promise<string | null> {
    try {
      const normalPath = normalizePath(path);
      
      // Use the adapter directly to read from hidden folders like .space
      if (await this.plugin.app.vault.adapter.exists(normalPath)) {
        return await this.plugin.app.vault.adapter.read(normalPath);
      }
      
      return null;
    } catch (error) {
      console.error(`[ObsidianAssetManager] Failed to read path ${path}:`, error);
      return null;
    }
  }

  protected async writePath(path: string, content: string): Promise<void> {
    try {
      const normalPath = normalizePath(path);
      
      // Ensure parent directory exists
      const parentPath = normalPath.substring(0, normalPath.lastIndexOf('/'));
      if (parentPath && !await this.plugin.app.vault.adapter.exists(parentPath)) {
        await this.createDirectory(parentPath);
      }
      
      await this.plugin.app.vault.adapter.write(normalPath, content);
    } catch (error) {
      console.error(`[ObsidianAssetManager] Failed to write path ${path}:`, error);
      throw error;
    }
  }

  protected async createDirectory(path: string): Promise<void> {
    try {
      const normalPath = normalizePath(path);
      
      // Create directory hierarchy if needed
      const parts = normalPath.split('/');
      let currentPath = '';
      
      for (const part of parts) {
        if (!part) continue;
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!await this.plugin.app.vault.adapter.exists(currentPath)) {
          await this.plugin.app.vault.adapter.mkdir(currentPath);
        }
      }
    } catch (error) {
      console.error(`[ObsidianAssetManager] Failed to create directory ${path}:`, error);
      throw error;
    }
  }

  protected async pathExists(path: string): Promise<boolean> {
    try {
      const normalPath = normalizePath(path);
      return await this.plugin.app.vault.adapter.exists(normalPath);
    } catch (error) {
      console.error(`[ObsidianAssetManager] Failed to check path existence ${path}:`, error);
      return false;
    }
  }

  protected async listChildren(path: string, type: 'file' | 'folder' | 'all' = 'all'): Promise<string[]> {
    try {
      const normalPath = normalizePath(path);
      
      if (!await this.pathExists(normalPath)) {
        return [];
      }
      
      // Use adapter to list files
      const items = await this.plugin.app.vault.adapter.list(normalPath);
      
      let results: string[] = [];
      
      if (type === 'file' || type === 'all') {
        results = results.concat(items.files);
      }
      
      if (type === 'folder' || type === 'all') {
        results = results.concat(items.folders);
      }
      
      return results;
    } catch (error) {
      console.error(`[ObsidianAssetManager] Failed to list children of ${path}:`, error);
      return [];
    }
  }

  protected async deletePath(path: string): Promise<void> {
    try {
      const normalPath = normalizePath(path);
      if (await this.pathExists(normalPath)) {
        await this.plugin.app.vault.adapter.remove(normalPath);
      }
    } catch (error) {
      console.error(`[ObsidianAssetManager] Failed to delete path ${path}:`, error);
      throw error;
    }
  }

  // Migrate icons from superstate if available
  protected migrateIconsFromSuperstate(): void {
    if (this.spaceManager.superstate?.iconsCache) {
      const superstateCache = this.spaceManager.superstate.iconsCache as Map<string, string>;
      
      // Copy all entries from superstate cache
      for (const [key, value] of superstateCache.entries()) {
        if (!this.iconsCache.has(key)) {
          this.iconsCache.set(key, value);
        }
      }
      
    }
  }

  // Scan icon directory for icon files
  protected async scanIconDirectory(directoryPath: string): Promise<IconMetadata[]> {
    const icons: IconMetadata[] = [];
    
    try {
      const files = await this.listChildren(directoryPath, 'file');
      
      for (const filePath of files) {
        const fileName = filePath.split('/').pop();
        if (fileName && /\.(svg|png|jpg|jpeg|gif)$/i.test(fileName)) {
          const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
          
          icons.push({
            id: nameWithoutExt,
            name: nameWithoutExt,
            path: filePath,
          });
        }
      }
    } catch (error) {
      console.error(`[ObsidianAssetManager] Failed to scan icon directory ${directoryPath}:`, error);
    }
    
    return icons;
  }

  // Create icon assets from iconset
  private async createIconAssetsFromIconset(iconset: IconsetAsset): Promise<void> {
    // Create cache for this iconset
    const iconsetCache = new Map<string, string>();
    this.iconsetCaches.set(iconset.id, iconsetCache);
    
    // Establish full path for iconset icons
    for (const iconMetadata of iconset.icons) {
      if (iconMetadata.path) {
        const iconKey = `${iconset.id}//${iconMetadata.id}`;
        this.iconPathMapping.set(iconKey, iconMetadata.path);
        this.iconPathMapping.set(iconMetadata.id, iconMetadata.path);
        
        // Store metadata for reverse lookup
        this.iconPathMetadata.set(iconMetadata.path, {
          iconsetId: iconset.id,
          iconId: iconMetadata.id
        });
      }
    }
  }

  // Ensure default iconsets exist
  private async ensureDefaultIconsets(): Promise<void> {
    try {
      // Use imported lucide icons and emojis
      
      // Create lucide iconset if not exists
      if (!this.assets.has('lucide')) {
        
        // Convert lucide icons array to icon metadata
        const lucideIconMetadata: IconMetadata[] = lucideIcons.map(iconName => ({
          id: iconName,
          name: iconName,
          path: `lucide://${iconName}`,
        }));
        
        const lucideIconset: IconsetAsset = {
          id: 'lucide',
          name: 'Lucide Icons',
          path: 'builtin://lucide',
          type: 'iconset',
          icons: lucideIconMetadata,
          theme: 'auto',
          description: i18n.labels.lucideIconLibraryForObsidian,
          tags: ['default', 'builtin', 'lucide'],
          format: 'svg',
          created: Date.now(),
          modified: Date.now(),
        };
        
        this.assets.set(lucideIconset.id, lucideIconset);
        await this.createIconAssetsFromIconset(lucideIconset);
        this.dispatchEvent('assetLoaded', lucideIconset);
      }

      // Create emoji iconset if not exists
      if (!this.assets.has('emoji')) {
        
        // Convert emojis object to icon metadata
        const emojiIconMetadata: IconMetadata[] = [];
        Object.keys(emojis).forEach(category => {
          emojis[category].forEach((emoji: any) => {
            emojiIconMetadata.push({
              id: emoji.u,
              name: emoji.n[0], // Use first name
              path: `emoji://${emoji.u}`,
            });
          });
        });
        
        const emojiIconset: IconsetAsset = {
          id: 'emoji',
          name: 'Emoji',
          path: 'builtin://emoji',
          type: 'iconset',
          icons: emojiIconMetadata,
          theme: 'auto',
          description: i18n.labels.emojiIconLibrary,
          tags: ['default', 'builtin', 'emoji'],
          format: 'emoji',
          created: Date.now(),
          modified: Date.now(),
        };
        
        this.assets.set(emojiIconset.id, emojiIconset);
        await this.createIconAssetsFromIconset(emojiIconset);
        this.dispatchEvent('assetLoaded', emojiIconset);
      }
    } catch (error) {
      console.error('[ObsidianAssetManager] Failed to ensure default iconsets:', error);
    }
  }

  // Ensure default palettes
  private async ensureDefaultPalettes(loadedIds: Set<string>): Promise<void> {
    // Create default color palette if not exists
    if (!loadedIds.has('default-palette')) {
      const defaultPalette: ColorPaletteAsset = {
        id: 'default-palette',
        name: 'Default Colors',
        path: `${this.ASSETS_SPACE_PATH}/color-palettes/default-palette`,
        type: 'colorpalette',
        colors: [
          { name: i18n.colors.red, value: "var(--mk-color-red)", category: 'brand' },
          { name: i18n.colors.pink, value: "var(--mk-color-pink)", category: 'brand' },
          { name: i18n.colors.orange, value: "var(--mk-color-orange)", category: 'brand' },
          { name: i18n.colors.yellow, value: "var(--mk-color-yellow)", category: 'brand' },
          { name: i18n.colors.green, value: "var(--mk-color-green)", category: 'brand' },
          { name: i18n.colors.turquoise, value: "var(--mk-color-turquoise)", category: 'brand' },
          { name: i18n.colors.teal, value: "var(--mk-color-teal)", category: 'brand' },
          { name: i18n.colors.blue, value: "var(--mk-color-blue)", category: 'brand' },
          { name: i18n.colors.purple, value: "var(--mk-color-purple)", category: 'brand' },
          { name: i18n.colors.brown, value: "var(--mk-color-brown)", category: 'brand' },
          { name: i18n.colors.charcoal, value: "var(--mk-color-charcoal)", category: 'brand' },
          { name: i18n.colors.gray, value: "var(--mk-color-gray)", category: 'brand' },
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
          semanticTokens: {}
        },
        tags: ['default', 'theme'],
        category: 'theme',
        description: i18n.descriptions.defaultMakemlColorPaletteWithThemeColors,
        created: Date.now(),
        modified: Date.now(),
      };
      
      this.assets.set(defaultPalette.id, defaultPalette);
      this.dispatchEvent('assetLoaded', defaultPalette);
    }

    // Create monochrome palette if not exists
    if (!loadedIds.has('monochrome-palette')) {
      const monochromePalette: ColorPaletteAsset = {
        id: 'monochrome-palette',
        name: 'Monochrome Colors',
        path: `${this.ASSETS_SPACE_PATH}/color-palettes/monochrome-palette`,
        type: 'colorpalette',
        colors: [
          { name: i18n.labels.base0, value: "var(--mk-color-base-0)", category: 'base' },
          { name: i18n.labels.base10, value: "var(--mk-color-base-10)", category: 'base' },
          { name: i18n.labels.base20, value: "var(--mk-color-base-20)", category: 'base' },
          { name: i18n.labels.base30, value: "var(--mk-color-base-30)", category: 'base' },
          { name: i18n.labels.base40, value: "var(--mk-color-base-40)", category: 'base' },
          { name: i18n.labels.base50, value: "var(--mk-color-base-50)", category: 'base' },
          { name: i18n.labels.base60, value: "var(--mk-color-base-60)", category: 'base' },
          { name: i18n.labels.base70, value: "var(--mk-color-base-70)", category: 'base' },
          { name: i18n.labels.base100, value: "var(--mk-color-base-100)", category: 'base' },
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
          semanticTokens: {}
        },
        tags: ['default', 'monochrome', 'base'],
        category: 'theme',
        description: i18n.descriptions.monochromeColorPaletteWithBaseColors,
        created: Date.now(),
        modified: Date.now(),
      };
      
      this.assets.set(monochromePalette.id, monochromePalette);
      this.dispatchEvent('assetLoaded', monochromePalette);
    }

    // Create default gradient palette if not exists or if it's empty
    const existingGradientPalette = this.assets.get('default-gradient-palette') as ColorPaletteAsset;
    const needsGradientPalette = !loadedIds.has('default-gradient-palette') || 
      (existingGradientPalette && (!existingGradientPalette.colors || existingGradientPalette.colors.length === 0));
    
    if (needsGradientPalette) {
      const defaultGradientPalette: ColorPaletteAsset = {
        id: 'default-gradient-palette',
        name: i18n.labels.gradients,
        path: `${this.ASSETS_SPACE_PATH}/color-palettes/default-gradient-palette`,
        type: 'colorpalette',
        colors: [
          { name: "Warm Sunset", value: "linear-gradient(135deg, #ffff84 0%, #ff6164 50%, #b00012 100%)", category: 'custom' },
          { name: "Earth Tones", value: "linear-gradient(90deg, #a47451 0%, #9c9881 17%, #73a09d 33%, #3b899a 50%, #095b79 67%, #002847 83%, #000116 100%)", category: 'custom' },
          { name: "Golden Pink", value: "linear-gradient(45deg, #fada61 0%, #ff9188 50%, #ff5acd 100%)", category: 'custom' },
          { name: "Soft Pink", value: "linear-gradient(45deg, #fc8ec5 0%, #ff8dd3 25%, #ffa1d8 50%, #ffc1d2 75%, #ffe0c3 100%)", category: 'custom' },
          { name: "Purple Gold", value: "linear-gradient(45deg, #4159d0 0%, #c84fc0 50%, #ffcd70 100%)", category: 'custom' },
          { name: "Cyan Purple", value: "linear-gradient(45deg, #23d4fd 0%, #3a98f0 50%, #b721ff 100%)", category: 'custom' }
        ],
        designSystemMapping: {
          baseTokens: {},
          semanticTokens: {}
        },
        tags: ['default', 'gradients'],
        category: 'material',
        description: i18n.descriptions.defaultGradientPaletteWithBeautifulGradients,
        created: Date.now(),
        modified: Date.now(),
      };
      
      this.assets.set(defaultGradientPalette.id, defaultGradientPalette);
      this.dispatchEvent('assetLoaded', defaultGradientPalette);
    }
    
    // Create pastel palette if not exists
    if (!loadedIds.has('pastel-palette')) {
      const pastelPalette: ColorPaletteAsset = {
        id: 'pastel-palette',
        name: 'Pastel Colors',
        path: `${this.ASSETS_SPACE_PATH}/color-palettes/pastel-palette`,
        type: 'colorpalette',
        colors: [
          { name: "Light Pink", value: "#FFB6C1", category: 'custom' },
          { name: i18n.colors.gold, value: "#FFD700", category: 'custom' },
          { name: "Pale Green", value: "#98FB98", category: 'custom' },
          { name: "Sky Blue", value: "#87CEEB", category: 'custom' },
          { name: i18n.colors.plum, value: "#DDA0DD", category: 'custom' },
          { name: i18n.colors.khaki, value: "#F0E68C", category: 'custom' },
          { name: "Light Salmon", value: "#FFA07A", category: 'custom' },
          { name: "Powder Blue", value: "#B0E0E6", category: 'custom' },
          { name: i18n.colors.moccasin, value: "#FFE4B5", category: 'custom' },
          { name: i18n.colors.lavender, value: "#E6E6FA", category: 'custom' }
        ],
        designSystemMapping: {
          baseTokens: {},
          semanticTokens: {}
        },
        tags: ['default', 'pastel', 'light'],
        category: 'theme',
        description: i18n.descriptions.softPastelColorsForGentleVisualizations,
        created: Date.now(),
        modified: Date.now(),
      };
      
      this.assets.set(pastelPalette.id, pastelPalette);
      this.dispatchEvent('assetLoaded', pastelPalette);
    }
  }

  // Asset discovery
  public async discoverAssets(basePath?: string): Promise<Asset[]> {
    const discovered: Asset[] = [];
    // Basic implementation
    return discovered;
  }

  // Event handling
  private dispatchEvent(event: string, ...args: any[]): void {
    const handlers = this.eventListeners.get(event) || [];
    handlers.forEach(handler => handler(...args));
  }

  public on<K extends keyof AssetManagerEvents>(event: K, handler: AssetManagerEvents[K]): void {
    const handlers = this.eventListeners.get(event) || [];
    handlers.push(handler as any);
    this.eventListeners.set(event, handlers);
  }

  public off<K extends keyof AssetManagerEvents>(event: K, handler: AssetManagerEvents[K]): void {
    const handlers = this.eventListeners.get(event) || [];
    const index = handlers.indexOf(handler as any);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  // Icon methods
  public async getIcon(key: string): Promise<string | undefined> {
    try {
      // Check if already cached
      const cached = this.iconsCache.get(key);
      if (cached) return cached;
      
      // Try to load from path
      const path = this.iconPathMapping.get(key);
      if (path) {
        const content = await this.readPath(path);
        if (content && typeof content === 'string') {
          // Cache in memory
          this.cacheIconFromPath(path, content);
          
          // Cache in persister if available
          if (this.persister) {
            await this.persister.store(path, content, 'icon');
          }
          
          return content;
        }
      }
    } catch (error) {
      console.error(`[ObsidianAssetManager] Failed to get icon ${key}:`, error);
    }
    
    return undefined;
  }

  public getIconSync(key: string): string | undefined {
    return this.iconsCache.get(key);
  }

  public cacheIconFromPath(path: string, content: string): void {
    this.iconsCache.set(path, content);
    
    // Extract icon name and cache with various keys
    const fileName = path.split('/').pop();
    if (fileName) {
      const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
      this.iconsCache.set(nameWithoutExt, content);
    }
    
    // If this path has metadata, also cache with iconset key
    const metadata = this.iconPathMetadata.get(path);
    if (metadata) {
      const iconsetKey = `${metadata.iconsetId}//${metadata.iconId}`;
      this.iconsCache.set(iconsetKey, content);
      
      // Also add to iconset cache
      const iconsetCache = this.iconsetCaches.get(metadata.iconsetId);
      if (iconsetCache) {
        iconsetCache.set(metadata.iconId, content);
      }
    }
  }

  public hasIcon(iconName: string): boolean {
    return this.iconsCache.has(iconName) || this.iconPathMapping.has(iconName);
  }

  // Core asset operations
  public async loadAsset(path: string, options?: AssetLoadOptions): Promise<Asset | null> {
    // Basic implementation - can be expanded
    return null;
  }

  public getAsset(id: string): Asset | null {
    return this.assets.get(id) || null;
  }

  public getCachedAsset(id: string): Asset | null {
    return this.assets.get(id) || null;
  }

  public async updateAsset(asset: Asset): Promise<boolean> {
    this.assets.set(asset.id, asset);
    this.dispatchEvent('assetUpdated', asset);
    return true;
  }

  public async deleteAsset(id: string): Promise<boolean> {
    const asset = this.assets.get(id);
    if (asset) {
      this.assets.delete(id);
      this.dispatchEvent('assetDeleted', id);
      return true;
    }
    return false;
  }

  // Type-specific getters
  public getIcons(): IconAsset[] {
    return Array.from(this.assets.values()).filter(a => a.type === 'icon') as IconAsset[];
  }

  public getIconsets(): IconsetAsset[] {
    return Array.from(this.assets.values()).filter(a => a.type === 'iconset') as IconsetAsset[];
  }

  public getImages(): ImageAsset[] {
    return Array.from(this.assets.values()).filter(a => a.type === 'image') as ImageAsset[];
  }

  public getTextures(): TextureAsset[] {
    return Array.from(this.assets.values()).filter(a => a.type === 'texture') as TextureAsset[];
  }

  public getAudios(): AudioAsset[] {
    return Array.from(this.assets.values()).filter(a => a.type === 'audio') as AudioAsset[];
  }

  public getModels(): ModelAsset[] {
    return Array.from(this.assets.values()).filter(a => a.type === 'model') as ModelAsset[];
  }

  public getVisualizations(): VisualizationAsset[] {
    return Array.from(this.assets.values()).filter(a => a.type === 'visualization') as VisualizationAsset[];
  }

  public getColorPalettes(): ColorPaletteAsset[] {
    const palettes = Array.from(this.assets.values()).filter(a => a.type === 'colorpalette') as ColorPaletteAsset[];
    return palettes;
  }

  public async resetDefaultPalettes(): Promise<void> {
    // Remove existing default palettes
    const defaultPaletteIds = ['default-palette', 'monochrome-palette', 'default-gradient-palette', 'pastel-palette'];
    for (const paletteId of defaultPaletteIds) {
      this.assets.delete(paletteId);
    }
    
    // Force recreation of default palettes
    const emptyLoadedIds = new Set<string>();
    await this.ensureDefaultPalettes(emptyLoadedIds);
    
  }

  public async resetSinglePalette(paletteId: string): Promise<boolean> {
    const defaultPaletteIds = ['default-palette', 'monochrome-palette', 'default-gradient-palette', 'pastel-palette'];
    
    if (!defaultPaletteIds.includes(paletteId)) {
      return false;
    }
    
    this.assets.delete(paletteId);
    
    const emptyLoadedIds = new Set<string>();
    await this.ensureDefaultPalettes(emptyLoadedIds);
    
    return true;
  }

  // Other required methods
  public async reindexAssets(): Promise<void> {
    await this.initializeAssets();
  }

  public async refreshAsset(id: string): Promise<Asset | null> {
    const asset = this.assets.get(id);
    if (asset) {
      return this.loadAsset(asset.path);
    }
    return null;
  }

  public async preloadAssets(assetIds: string[]): Promise<Asset[]> {
    const promises = assetIds.map(id => {
      const asset = this.assets.get(id);
      return asset ? Promise.resolve(asset) : Promise.resolve(null);
    });
    const results = await Promise.all(promises);
    return results.filter(a => a !== null) as Asset[];
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
    this.dispatchEvent('cacheCleared');
  }

  public getCacheStats(): AssetCacheStats {
    const stats: AssetCacheStats = {
      totalAssets: this.assets.size,
      cachedAssets: this.cache.size,
      cacheSize: 0,
      hitRate: this.cacheStats.totalRequests > 0 
        ? (this.cacheStats.hits / this.cacheStats.totalRequests) * 100 
        : 0,
      byType: {} as any
    };
    
    // Calculate stats by type
    const types: AssetType[] = ['icon', 'iconset', 'image', 'texture', 'audio', 'model', 'visualization', 'colorpalette'];
    for (const type of types) {
      const assets = this.getAssetsByType(type);
      stats.byType[type] = {
        total: assets.length,
        cached: assets.filter(a => this.cache.has(a.id)).length,
        size: 0
      };
    }
    
    return stats;
  }

  public getAssetPath(id: string): string | null {
    const asset = this.assets.get(id);
    return asset ? asset.path : null;
  }

  public isAssetCached(id: string): boolean {
    return this.cache.has(id);
  }

  public getAssetsByType(type: AssetType): Asset[] {
    return Array.from(this.assets.values()).filter(a => a.type === type);
  }

  public searchAssets(query: string, type?: AssetType): Asset[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.assets.values()).filter(asset => {
      if (type && asset.type !== type) return false;
      return asset.name.toLowerCase().includes(lowerQuery) ||
             asset.id.toLowerCase().includes(lowerQuery);
    });
  }

  // Configuration management
  public async saveVisualizationConfig(config: VisualizationConfig): Promise<boolean> {
    // Implementation
    return true;
  }

  public async deleteVisualizationConfig(id: string): Promise<boolean> {
    return this.deleteAsset(id);
  }

  public async saveColorPalette(palette: ColorPaletteAsset): Promise<boolean> {
    try {
      this.assets.set(palette.id, palette);
      return true;
    } catch (error) {
      console.error('Failed to save color palette:', error);
      return false;
    }
  }

  public async deleteColorPalette(id: string): Promise<boolean> {
    try {
      const success = this.deleteAsset(id);
      return success;
    } catch (error) {
      console.error('Failed to delete color palette:', error);
      return false;
    }
  }

  public async loadColorPalette(path: string): Promise<ColorPaletteAsset | null> {
    const asset = await this.loadAsset(path);
    return asset && asset.type === 'colorpalette' ? asset as ColorPaletteAsset : null;
  }

  public async reloadColorPalette(id: string): Promise<ColorPaletteAsset | null> {
    const asset = await this.refreshAsset(id);
    return asset && asset.type === 'colorpalette' ? asset as ColorPaletteAsset : null;
  }

  // Iconset management
  public async loadIconset(path: string): Promise<IconsetAsset | null> {
    const asset = await this.loadAsset(path);
    return asset && asset.type === 'iconset' ? asset as IconsetAsset : null;
  }

  public async saveIconset(iconset: IconsetAsset): Promise<boolean> {
    try {
      // If icons array is empty, scan the folder to populate it
      if ((!iconset.icons || iconset.icons.length === 0) && iconset.path) {
        const scannedIcons = await this.scanIconDirectory(iconset.path);
        iconset.icons = scannedIcons;
      }
      
      // Store in memory
      this.assets.set(iconset.id, iconset);
      
      // Create icon assets and mappings
      await this.createIconAssetsFromIconset(iconset);
      
      // Dispatch event
      this.dispatchEvent('assetLoaded', iconset);
      
      return true;
    } catch (error) {
      console.error(`[ObsidianAssetManager] Failed to save iconset ${iconset.id}:`, error);
      return false;
    }
  }

  public async deleteIconset(id: string): Promise<boolean> {
    try {
      // Get the iconset to check if it's custom
      const iconset = this.assets.get(id) as IconsetAsset;
      
      // Remove from memory
      const deleted = this.deleteAsset(id);
      
      // Clear iconset cache
      this.iconsetCaches.delete(id);
      
      return deleted;
    } catch (error) {
      console.error(`[ObsidianAssetManager] Failed to delete iconset ${id}:`, error);
      return false;
    }
  }

  public getIconFromSet(iconsetId: string, iconId: string): IconMetadata | null {
    const iconset = this.assets.get(iconsetId) as IconsetAsset;
    if (iconset && iconset.type === 'iconset') {
      return iconset.icons.find(i => i.id === iconId) || null;
    }
    return null;
  }

  public getCachedIcon(iconId: string, iconsetId?: string): string | null {
    if (iconsetId) {
      const iconsetCache = this.iconsetCaches.get(iconsetId);
      if (iconsetCache) {
        return iconsetCache.get(iconId) || null;
      }
    }
    return this.iconsCache.get(iconId) || null;
  }

  public cacheIcon(key: string, content: string): void {
    this.iconsCache.set(key, content);
  }

  // Aliases
  public async deleteVisualization(id: string): Promise<boolean> {
    return this.deleteAsset(id);
  }

  public async deleteImage(id: string): Promise<boolean> {
    return this.deleteAsset(id);
  }

  // Helper methods
  private generateId(): string {
    return `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private pathToId(path: string): string {
    return path.replace(/[^a-zA-Z0-9]/g, '_');
  }

  private pathToName(path: string): string {
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    return filename.split('.')[0];
  }

  private detectAssetType(path: string): AssetType {
    const ext = this.getFileExtension(path).toLowerCase();
    
    if (['svg', 'png', 'jpg', 'jpeg', 'gif'].includes(ext)) {
      return 'icon';
    } else if (['webp', 'bmp'].includes(ext)) {
      return 'image';
    } else if (['mp3', 'wav', 'ogg', 'aac'].includes(ext)) {
      return 'audio';
    } else if (['gltf', 'glb', 'obj', 'fbx'].includes(ext)) {
      return 'model';
    }
    
    return 'icon'; // default
  }

  private getFileExtension(path: string): string {
    const parts = path.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  private cacheAssetContent(id: string, content: any): void {
    if (typeof content === 'string') {
      this.cache.set(id, content);
    } else if (content instanceof ArrayBuffer) {
      // Convert ArrayBuffer to base64 for caching
      const base64 = btoa(String.fromCharCode(...new Uint8Array(content)));
      this.cache.set(id, base64);
    }
  }

  // Load icon from path
  public async loadIconFromPath(path: string): Promise<string | undefined> {
    try {
      // Check if already cached
      const cached = this.iconsCache.get(path);
      if (cached) return cached;
      
      // Load from file using Obsidian adapter
      const content = await this.readPath(path);
      if (content && typeof content === 'string') {
        // Cache in memory
        this.cacheIconFromPath(path, content);
        
        // Cache in persister if available
        if (this.persister) {
          await this.persister.store(path, content, 'icon');
        }
        
        return content;
      }
    } catch (error) {
      console.error(`[ObsidianAssetManager] Failed to load icon from path ${path}:`, error);
    }
    
    return undefined;
  }

  // File operations
  protected async readJSONFile(path: string): Promise<any | null> {
    try {
      const content = await this.readPath(path);
      if (content) {
        return JSON.parse(content);
      }
    } catch (error) {
      console.error(`[ObsidianAssetManager] Failed to read JSON from ${path}:`, error);
    }
    return null;
  }

  protected async writeJSONFile(path: string, data: any): Promise<void> {
    try {
      const content = JSON.stringify(data, null, 2);
      await this.writePath(path, content);
    } catch (error) {
      console.error(`[ObsidianAssetManager] Failed to write JSON to ${path}:`, error);
      throw error;
    }
  }

  // Cover image management methods
  public async addCoverImage(url: string, name: string, tags: string[] = []): Promise<boolean> {
    try {
      const coverImage: CoverImage = {
        url,
        name,
        tags,
        created: Date.now(),
        modified: Date.now()
      };
      
      this.coverImages.set(url, coverImage);
      return true;
    } catch (error) {
      console.error(`[ObsidianAssetManager] Failed to add cover image ${url}:`, error);
      return false;
    }
  }

  public async removeCoverImage(url: string): Promise<boolean> {
    try {
      return this.coverImages.delete(url);
    } catch (error) {
      console.error(`[ObsidianAssetManager] Failed to remove cover image ${url}:`, error);
      return false;
    }
  }

  public getCoverImage(url: string): CoverImage | null {
    return this.coverImages.get(url) || null;
  }

  public getCoverImagesByTag(tag: string): CoverImage[] {
    const images: CoverImage[] = [];
    for (const image of this.coverImages.values()) {
      if (image.tags.includes(tag)) {
        images.push(image);
      }
    }
    return images;
  }

  public getCoverImagesByName(name: string): CoverImage[] {
    const lowerName = name.toLowerCase();
    const images: CoverImage[] = [];
    for (const image of this.coverImages.values()) {
      if (image.name.toLowerCase().includes(lowerName)) {
        images.push(image);
      }
    }
    return images;
  }

  public getAllCoverImages(): CoverImage[] {
    return Array.from(this.coverImages.values());
  }

}
