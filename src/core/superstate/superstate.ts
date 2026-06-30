import i18n from "shared/i18n";

import { UIManager } from "core/middleware/ui";
import { fileSystemSpaceInfoFromTag } from "core/spaceManager/filesystemAdapter/spaceInfo";
import { SpaceManager } from "core/spaceManager/spaceManager";
import { effectiveSpaceSort, saveSpaceCache } from "core/superstate/utils/spaces";
import { builtinSpaces } from "schemas/space";
import { pathIsSpace } from "core/utils/superstate/space";
import { tagSpacePathFromTag } from "core/utils/strings";
import { parsePathState } from "core/utils/superstate/parser";
import { serializePathState } from "core/utils/superstate/serializer";
import _ from "lodash";
import { isTagSpacePath, tagsSpacePath, tagSpaceNameFromPath } from "schemas/builtin";
import { Focus } from "shared/types/focus";
import { IndexMap } from "shared/types/indexMap";
import { PathState, SpaceState } from "shared/types/PathState";
import { LocalCachePersister } from "shared/types/persister";
import { MakeMDSettings } from "shared/types/settings";
import { SpaceDefinition, SpaceType } from "shared/types/spaceDef";
import { SpaceInfo } from "shared/types/spaceInfo";
import { orderArrayByArrayWithKey, uniq } from "shared/utils/array";
import { EventDispatcher } from "shared/utils/dispatchers/dispatcher";
import { safelyParseJSON } from "shared/utils/json";
import { API } from "./api";

import { Indexer } from "./workers/indexer/indexer";
import { PathLabel } from "shared/types/caches";

import { SuperstateEvent } from "shared/types/PathState";
import { ISuperstate, PathStateWithRank } from "shared/types/superstate";
import { ensureArray } from "core/utils/strings";

export type SuperProperty = {
    id: string;
    name: string;
};

const spaceDisplayMetadata = (metadata: SpaceDefinition = {}) => {
    return {
        color: metadata.color,
        sticker: metadata.sticker,
        defaultColor: metadata.defaultColor,
        defaultSticker: metadata.defaultSticker,
        fileColors: metadata["file-colors"],
    }
}

const tagSpaceInfoForCache = (space: SpaceInfo): SpaceInfo =>
    ({
        ...(({ dbPath: _dbPath, ...spaceInfo }) => spaceInfo)(space as SpaceInfo & { dbPath?: string }),
        defPath: "",
        notePath: "",
        folderPath: "",
    }) as SpaceInfo;

const tagSpaceInfoForStore = (): SpaceInfo =>
    ({
        defPath: "",
        notePath: "",
        folderPath: "",
    }) as unknown as SpaceInfo;

const tagSpaceMetadata = (metadata: SpaceDefinition = {}): SpaceDefinition => ({
    ...(metadata.color ? { color: metadata.color } : {}),
    ...(metadata.sort ? { sort: metadata.sort } : {}),
    "rank-order": ensureArray(metadata["rank-order"]),
    pinned: ensureArray(metadata.pinned),
});

const tagSpaceState = (space: SpaceInfo, metadata?: SpaceDefinition): SpaceState => ({
    type: "tag",
    name: space.name,
    path: space.path,
    metadata: tagSpaceMetadata(metadata),
    space: tagSpaceInfoForCache(space),
});

const tagSpaceStateForStore = (space: SpaceState): SpaceState =>
    ({
        type: "tag",
        name: tagSpaceNameFromPath(space.path),
        path: space.path,
        metadata: tagSpaceMetadata(space.metadata),
        space: tagSpaceInfoForStore(),
    }) as SpaceState;

const folderSpaceInfoForStore = (space: SpaceInfo): SpaceInfo =>
    ({
        defPath: space.defPath,
        folderPath: (space as any).folderPath,
        notePath: space.notePath,
    }) as unknown as SpaceInfo;

const folderSpaceStateForStore = (space: SpaceState): SpaceState =>
    ({
        type: space.type,
        name: space.name,
        path: space.path,
        metadata: space.metadata,
        space: folderSpaceInfoForStore(space.space),
    }) as SpaceState;

const folderSpaceStateFromStore = (space: SpaceState): SpaceState => ({
    ...space,
    space: {
        ...(({ dbPath: _dbPath, ...spaceInfo }) => spaceInfo)(space.space as SpaceInfo & { dbPath?: string }),
        name: space.name,
        path: space.path,
    } as SpaceInfo,
});

const tagPathStateForSpace = (space: SpaceState): PathState => ({
    path: space.path,
    name: space.name,
    type: "space",
    subtype: "tag",
    label: {
        sticker: "",
        color: space.metadata?.color ?? "",
    },
    tags: [],
    spaces: [],
    outlinks: [],
    hidden: false,
    metadata: {},
});

const fallbackStickerForPathState = (pathState: PathState): string => {
    if (!pathState) return "";
    if (pathState.type == "space") {
        if (pathState.path == "/") return "ui//home";
        if (isTagSpacePath(pathState.path)) return "lucide//hash";
        return "ui//folder";
    }
    const fileExtension = pathState.metadata?.file?.extension?.toLowerCase() || pathState.subtype?.toLowerCase() || pathState.path?.split(".").pop()?.toLowerCase();
    if (["png", "jpg", "jpeg", "avif", "webp", "gif"].includes(fileExtension)) return "ui//image";
    if (fileExtension == "canvas") return "ui//layout-dashboard";
    if (fileExtension == "base") return "ui//table";
    if (fileExtension == "excalidraw" || fileExtension == "excalidraw.md" || pathState.path?.toLowerCase().endsWith(".excalidraw.md")) return "ui//excalidraw";
    if (fileExtension == "md") return "ui//file-text";
    return "ui//file";
};

const emptyPathLabel = (): PathLabel => ({ sticker: "", color: "" });

const isFolderLikePathState = (pathState: PathState): boolean => pathState?.type == "space" || pathState?.subtype == "folder" || pathState?.metadata?.file?.isFolder;

const effectiveLabelForPathState = (pathState: PathState, spacesIndex: Map<string, SpaceState>, parentSpacePath?: string): PathLabel => {
    if (!pathState) return emptyPathLabel();

    const ownSpaceMetadata = spacesIndex.get(pathState.path)?.metadata ?? {};
    const parentMetadata = spacesIndex.get(parentSpacePath ?? pathState.parent)?.metadata ?? {};

    if (isFolderLikePathState(pathState)) {
        return {
            sticker: ownSpaceMetadata.sticker || parentMetadata.defaultSticker || fallbackStickerForPathState(pathState),
            color: ownSpaceMetadata.color ?? parentMetadata.defaultColor ?? "",
        };
    }

    const fileColors = parentMetadata["file-colors"] ?? {};
    return {
        sticker: fallbackStickerForPathState(pathState),
        color: fileColors[pathState.path] ?? parentMetadata.defaultColor ?? "",
    };
};

const pathStateWithEffectiveLabel = <T extends PathState>(pathState: T, spacesIndex: Map<string, SpaceState>, parentSpacePath?: string): T => ({
    ...pathState,
    label: pathState.label ?? emptyPathLabel(),
    effectiveLabel: effectiveLabelForPathState(pathState, spacesIndex, parentSpacePath),
});

export class Superstate implements ISuperstate {
    public static create(indexVersion: string, onChange: () => void, spaceManager: SpaceManager, uiManager: UIManager): Superstate {
        return new Superstate(indexVersion, onChange, spaceManager, uiManager);
    }
    public initialized: boolean;
    public eventsDispatcher: EventDispatcher<SuperstateEvent>;
    public spaceManager: SpaceManager;
    public settings: MakeMDSettings;
    public saveSettings: () => void;
    public api: API;

    public ui: UIManager;
    //Index
    public pathsIndex: Map<string, PathState>;
    public spacesIndex: Map<string, SpaceState>;

    //Persistant Cache
    public imagesCache: Map<string, string>;

    //Maps
    public spacesMap: IndexMap; //file to space mapping
    public linksMap: IndexMap; //link between paths
    public tagsMap: IndexMap; //file to tag mapping
    public liveSpaceLinkMap: IndexMap;
    private indexer: Indexer;
    private metadataChanges: Map<string, Promise<void>>;

    public focuses: Focus[];

    private constructor(
        public indexVersion: string,
        public onChange: () => void,
        spaceManager: SpaceManager,
        uiManager: UIManager,
    ) {
        this.eventsDispatcher = new EventDispatcher<SuperstateEvent>();
        //Initialize
        this.initialized = false;
        this.spaceManager = spaceManager;
        this.spaceManager.superstate = this;
        this.ui = uiManager;
        this.ui.superstate = this;

        this.api = new API(this);
        // Initialize SpaceManager's API reference
        spaceManager.api = new API(this, spaceManager);

        //Initiate Indexes
        this.pathsIndex = new Map();
        this.spacesIndex = new Map();
        this.focuses = [];
        //Initiate Maps
        this.spacesMap = new IndexMap();
        this.linksMap = new IndexMap();
        this.tagsMap = new IndexMap();
        this.liveSpaceLinkMap = new IndexMap();

        //Initiate Persistance
        this.imagesCache = new Map();

        //Intiate Workers
        this.indexer = new Indexer(2, this);
        this.metadataChanges = new Map();

        // window['make'] = this;
    }

    public async initializeIndex() {
        await this.loadFromCache();
    }
    public unload() {
        this.indexer.terminate();
    }

    public persister: LocalCachePersister;
    public async initialize() {
        if (!this.persister) {
            return;
        }
        const start = Date.now();

        this.initializeFocuses();
        await this.initializeSpaces();

        await this.initializeBuiltins();
        await this.initializeTags();

        await this.initializePaths();

        this.dispatchEvent("superstateUpdated", null);
        this.ui.notify(`Make.md - Superstate Loaded in ${(Date.now() - start) / 1000} seconds`, "console");
        this.persister.cleanType("space");
        this.persister.cleanType("path");
    }

    public async initializeSpaces() {
        const allSpaces = [...this.spaceManager.allSpaces().values()];

        const promises = allSpaces.map((f) => this.reloadSpace(f, null, true));
        [...this.spacesIndex.keys()].filter((f) => this.spacesIndex.get(f)?.type != "tag" && !allSpaces.some((g) => g.path == f)).forEach((f) => this.onSpaceDeleted(f));

        await Promise.all(promises);
    }

    private pathsForTagSpace(spacePath: string): string[] {
        if (!isTagSpacePath(spacePath))
            return [];

        const tag = '#' + tagSpaceNameFromPath(spacePath).toLowerCase();
        const indexedPaths = [...this.tagsMap.getInverse(tag)];
        const adapterPaths = this.spaceManager.pathsForTag?.(tag) ?? [];
        return uniq([...indexedPaths, ...adapterPaths]);
    }

    private syncSpaceRankOrder(spacePath: string, items: string[]): string[] {
        const spaceState = this.spacesIndex.get(spacePath);
        const currentOrder = ensureArray(spaceState?.metadata?.["rank-order"]);
        if (!spaceState || !["tag", "folder", "vault"].includes(spaceState.type)) return currentOrder;
        if (spaceState.type != "tag" && effectiveSpaceSort(spaceState.metadata?.sort, this.settings).field != "rank") return currentOrder;
        if (spaceState.type != "tag" && currentOrder.length == 0) return currentOrder;

        const nextOrder = [...currentOrder.filter((path) => items.includes(path)), ...items.filter((path) => !currentOrder.includes(path))];
        if (_.isEqual(currentOrder, nextOrder)) return currentOrder;

        const nextSpaceState = {
            ...spaceState,
            metadata: {
                ...spaceState.metadata,
                "rank-order": nextOrder,
            },
        };
        this.spacesIndex.set(spacePath, nextSpaceState);
        this.persister?.store(spacePath, JSON.stringify(nextSpaceState.type == "tag" ? tagSpaceStateForStore(nextSpaceState) : folderSpaceStateForStore(nextSpaceState)), "space", nextSpaceState.type == "tag" ? "" : undefined);
        return nextOrder;
    }

    public getSpaceItems(spacePath: string): PathStateWithRank[] {
        const isTagSpace = isTagSpacePath(spacePath);
        const items = isTagSpace ? this.pathsForTagSpace(spacePath) : [...this.spacesMap.getInverse(spacePath)];
        const ranks = this.syncSpaceRankOrder(spacePath, items);

        return items
            .map<PathStateWithRank>((f) => {
                this.spaceManager.loadPath(f);
                const pathCache = this.pathsIndex.get(f);
                if (!pathCache) return null;

                return {
                    ...pathStateWithEffectiveLabel(pathCache, this.spacesIndex, spacePath),
                    rank: ranks.indexOf(f),
                } as PathStateWithRank;
            })
            .filter((f) => f?.hidden != true && f.path != spacePath);
    }
    public async loadFromCache() {
        this.dispatchEvent("superstateReindex", null);
        const allPaths = await this.persister.loadAll("path");
        const allSpaces = await this.persister.loadAll("space");

        for (const s of allSpaces) {
            const space = safelyParseJSON(s.cache);
            if (space && space.type) {
                if (space.type != "tag") {
                    const defPath = space.space?.defPath ?? this.spaceManager.spaceInfoForPath(s.path)?.defPath;
                    if (!defPath || !(await this.spaceManager.pathExists(defPath))) {
                        this.persister.remove(s.path, "space");
                        continue;
                    }
                }
                const normalizedSpace = space.type == "tag" ? tagSpaceState({ ...space.space, name: space.name, path: space.path }, space.metadata) : folderSpaceStateFromStore(space);
                this.spacesIndex.set(s.path, normalizedSpace);
                const normalizedStore = normalizedSpace.type == "tag" ? tagSpaceStateForStore(normalizedSpace) : folderSpaceStateForStore(normalizedSpace);
                if (!_.isEqual(space, normalizedStore)) {
                    this.persister.store(s.path, JSON.stringify(normalizedStore), "space", normalizedSpace.type == "tag" ? "" : undefined);
                }
            }
        }

        allPaths.forEach((f) => {
            if (isTagSpacePath(f.path)) {
                return;
            }
            const cache = parsePathState(f.cache);
            if (cache) {
                this.pathsIndex.set(f.path, cache);
                this.tagsMap.set(f.path, new Set(cache.tags));
                this.spacesMap.set(f.path, new Set(cache.spaces));
                this.linksMap.set(f.path, new Set(cache.outlinks));
            }
        });
        this.dispatchEvent("superstateUpdated", null);
    }

    public dispatchEvent<K extends keyof SuperstateEvent>(event: K, payload: SuperstateEvent[K]) {
        this.eventsDispatcher.dispatchEvent(event, payload);
    }

    public pathStateForPath(path: string): PathState {
        if (isTagSpacePath(path)) {
            const spaceState = this.spacesIndex.get(path);
            if (spaceState?.type == "tag") return pathStateWithEffectiveLabel(tagPathStateForSpace(spaceState), this.spacesIndex);
        }
        const pathState = this.pathsIndex.get(path);
        if (pathState) return pathStateWithEffectiveLabel(pathState, this.spacesIndex);
        const spaceState = this.spacesIndex.get(path);
        if (spaceState?.type == "tag") return pathStateWithEffectiveLabel(tagPathStateForSpace(spaceState), this.spacesIndex);
        return null;
    }

    public async initializeBuiltins() {
        const allBuiltins = builtinSpaces;
        const promises = Object.keys(allBuiltins).map((f) => this.reloadPath("spaces://$" + f, true));
        await Promise.all(promises);
    }

    public async initializeTags() {
        return;
    }

    public async onSpaceDefinitionChanged(space: SpaceState, oldDef?: SpaceDefinition) {
        if (!space) return;
        const currentPaths = [...this.spacesMap.getInverse(space.path)];
        const oldLinks = ensureArray(oldDef?.links);
        const newLinks = ensureArray(space.metadata?.links);
        const linksChanged = !_.isEqual(newLinks, oldLinks);
        const diff = linksChanged ? [..._.difference(newLinks, oldLinks), ..._.difference(oldLinks, newLinks)] : [];
        const displayMetadataChanged = !_.isEqual(spaceDisplayMetadata(space.metadata), spaceDisplayMetadata(oldDef));

        if (displayMetadataChanged) {
            await Promise.all(currentPaths.map((path) => this.refreshPathEffectiveLabel(path, space.path)));
        }

        const cachedPromises = diff.map((f) => this.reloadPath(f, true).then(() => this.dispatchEvent("pathStateUpdated", { path: f })));
        await Promise.all(cachedPromises);
    }

    private async refreshPathEffectiveLabel(path: string, parentSpacePath?: string) {
        const pathState = this.pathsIndex.get(path);
        if (!pathState) return;
        const nextPathState = pathStateWithEffectiveLabel(pathState, this.spacesIndex, parentSpacePath);
        if (_.isEqual(pathState.effectiveLabel, nextPathState.effectiveLabel)) return;
        this.pathsIndex.set(path, nextPathState);
        await this.onPathReloaded(path);
        this.dispatchEvent("pathStateUpdated", { path });
    }

    public async initializeFocuses() {
        const allFocuses = await this.spaceManager.readFocuses();
        if (allFocuses.length == 0) {
            this.spaceManager.saveFocuses([{ name: i18n.labels.home, sticker: "ui//home", paths: ["/"] }]);
            return;
        }
        this.focuses = allFocuses;
        this.dispatchEvent("focusesChanged", null);
    }

    public async initializePaths() {
        this.dispatchEvent("superstateReindex", null);
        const allFiles = this.spaceManager.allPaths();

        const start = Date.now();
        await this.indexer.reload<{ [key: string]: { cache: PathState; changed: boolean } }>({ type: "paths", path: "" }).then(async (r) => {
            for await (const [path, { cache, changed }] of Object.entries(r)) {
                await this.pathReloaded(path, cache, changed, false);
            }
        });

        this.ui.notify(`Make.md - ${allFiles.length} Paths Cached in ${(Date.now() - start) / 1000} seconds`, "console");

        const allPaths = uniq([...this.spacesIndex.keys(), ...allFiles]);
        [...this.pathsIndex.keys()].filter((f) => !allPaths.some((g) => g == f)).forEach((f) => this.onPathDeleted(f));

        this.dispatchEvent("superstateUpdated", null);
    }

    public async onTagRenamed(tag: string, newTag: string) {
        const oldPath = tagSpacePathFromTag(tag);
        const newSpaceInfo = fileSystemSpaceInfoFromTag(this.spaceManager, newTag);
        const oldSpace = this.spacesIndex.get(oldPath);
        if (oldSpace?.type == "tag") {
            const newSpace = tagSpaceState(newSpaceInfo, oldSpace.metadata);
            this.spacesIndex.set(newSpaceInfo.path, newSpace);
            this.spacesIndex.delete(oldPath);
            this.persister.remove(oldPath, "space");
            this.persister.store(newSpaceInfo.path, JSON.stringify(tagSpaceStateForStore(newSpace)), "space", "");
        }
        let focusChanged = false;
        this.focuses.forEach((focus) => {
            if (focus.paths.includes(oldPath)) {
                focus.paths = focus.paths.map((f) => (f == oldPath ? newSpaceInfo.path : f));
                focusChanged = true;
            }
        });
        if (focusChanged) {
            await this.spaceManager.saveFocuses(this.focuses);
        }
        this.dispatchEvent("spaceChanged", { path: oldPath, newPath: newSpaceInfo.path });

        for (const spaceCache of this.spacesIndex.values()) {
            if (spaceCache.metadata?.contexts?.includes(tag)) {
                saveSpaceCache(this, spaceCache.space, { ...spaceCache.metadata, contexts: spaceCache.metadata.contexts.map((f) => (f == tag ? newTag : f)) });
            }
        }
        this.dispatchEvent("spaceStateUpdated", { path: tagsSpacePath });
    }

    public async onTagDeleted(tag: string) {
        this.tagsMap.getInverse(tag).forEach((path) => {
            this.deleteTagInPath(tag, path);
        });
        this.onSpaceDeleted(tagSpacePathFromTag(tag));
        for (const spaceCache of this.spacesIndex.values()) {
            if (spaceCache.metadata?.contexts?.includes(tag)) {
                saveSpaceCache(this, spaceCache.space, { ...spaceCache.metadata, contexts: spaceCache.metadata.contexts.filter((f) => f != tag) });
            }
        }
        this.dispatchEvent("spaceStateUpdated", { path: tagsSpacePath });
    }

    public async deleteTagInPath(tag: string, path: string) {
        let oldMetadata: PathState;
        if (this.pathsIndex.has(path)) {
            oldMetadata = this.pathsIndex.get(path);
        }
        if (oldMetadata) {
            const newMetadata = {
                ...oldMetadata,
                tags: oldMetadata.tags.filter((f) => f != tag),
                spaces: oldMetadata.spaces.filter((f) => f != tagSpacePathFromTag(tag)),
            };
            this.pathsIndex.set(path, newMetadata);
            this.tagsMap.set(path, new Set(newMetadata.tags));
            this.spacesMap.set(path, new Set(newMetadata.spaces));
        } else {
            await this.reloadPath(path);
        }
        this.onPathReloaded(path);
        this.dispatchEvent("pathStateUpdated", { path });
    }

    public async onMetadataChange(path: string) {
        const inFlight = this.metadataChanges.get(path);
        if (inFlight) {
            return inFlight;
        }
        const change = this.runMetadataChange(path).finally(() => {
            this.metadataChanges.delete(path);
        });
        this.metadataChanges.set(path, change);
        return change;
    }

    private async runMetadataChange(path: string) {
        if (!this.pathsIndex.has(path)) {
            return;
        }
        await this.reloadPath(path);
        const spaceState = this.spacesIndex.get(path);
        if (spaceState) {
            const nextSpaceState = await this.reloadSpace(spaceState.space);
            await this.onSpaceDefinitionChanged(nextSpaceState, spaceState.metadata);
        }
        this.dispatchEvent("pathStateUpdated", { path: path });
    }

    public reloadSpaceByPath(path: string, metadata?: SpaceDefinition) {
        return this.reloadSpace(this.spaceManager.spaceInfoForPath(path), metadata);
    }

    public async onPathRename(oldPath: string, newPath: string) {
        //assume that space indexer has updated all records properly
        const newFilePath = newPath;
        const oldFileCache = this.pathsIndex.get(oldPath);
        const oldSpaces = oldFileCache?.spaces ?? [];
        if (oldFileCache) {
            this.spacesMap.delete(oldPath);
            this.spacesMap.deleteInverse(oldPath);
            this.linksMap.delete(oldPath);
            this.linksMap.deleteInverse(oldPath);
            this.tagsMap.delete(oldPath);
            this.pathsIndex.delete(oldPath);

            // Index the new path FIRST so it's available when contexts reload
            await this.reloadPath(newFilePath, true);

            for (const space of oldSpaces.map((f) => this.spacesIndex.get(f)).filter((f) => f)) {
                const fileColors = space.metadata?.["file-colors"] ?? {};
                const nextFileColors = Object.keys(fileColors).reduce<Record<string, string>>((acc, key) => ({ ...acc, [key == oldPath ? newPath : key]: fileColors[key] }), {});
                await saveSpaceCache(this, space.space, {
                    ...space.metadata,
                    links: ensureArray(space.metadata?.links).map((f) => (f == oldPath ? newPath : f)),
                    "rank-order": ensureArray(space.metadata?.["rank-order"]).map((f) => (f == oldPath ? newPath : f)),
                    pinned: ensureArray(space.metadata?.pinned).map((f) => (f == oldPath ? newPath : f)),
                    "file-colors": nextFileColors,
                });
            }
        }

        let focusChanged = false;
        this.focuses.forEach((focus) => {
            if (focus.paths.includes(oldPath)) {
                focus.paths = focus.paths.map((f) => (f == oldPath ? newPath : f));
                focusChanged = true;
            }
        });
        if (focusChanged) {
            await this.spaceManager.saveFocuses(this.focuses);
            this.dispatchEvent("focusesChanged", null);
        }

        await this.reloadPath(newPath, true);
        this.persister.remove(oldPath, "path");

        const changedSpaces = uniq([...(this.spacesMap.get(newPath) ?? []), ...oldSpaces]);

        changedSpaces.forEach((f) => this.dispatchEvent("spaceStateUpdated", { path: f }));
        this.dispatchEvent("pathChanged", { path: oldPath, newPath: newPath });

        this.ui.viewsByPath(oldPath).forEach((view) => {
            view.openPath(newPath);
        });
    }

    public async onPathCreated(path: string) {
        await this.reloadPath(path, true);
        this.dispatchEvent("pathCreated", { path });
    }

    public onPathDeleted(path: string) {
        this.spacesMap.delete(path);
        this.linksMap.delete(path);
        this.linksMap.deleteInverse(path);
        this.persister.remove(path, "path");
        const fileCache = this.pathsIndex.get(path);

        if (!fileCache) {
            return;
        }

        (fileCache.spaces ?? [])
            .map((f) => this.spacesIndex.get(f))
            .filter((f) => f)
            .forEach((space) => {
                const { [path]: _removedColor, ...fileColors } = space.metadata?.["file-colors"] ?? {};
                saveSpaceCache(this, space.space, {
                    ...space.metadata,
                    links: ensureArray(space.metadata?.links).filter((f) => f != path),
                    "rank-order": ensureArray(space.metadata?.["rank-order"]).filter((f) => f != path),
                    pinned: ensureArray(space.metadata?.pinned).filter((f) => f != path),
                    "file-colors": fileColors,
                });
            });

        (fileCache.spaces ?? []).forEach((f) => {
            this.dispatchEvent("spaceStateUpdated", { path: f });
        });
        this.pathsIndex.delete(path);
        this.dispatchEvent("pathDeleted", { path });
    }

    public async onSpaceRenamed(oldPath: string, newSpaceInfo: SpaceInfo) {
        if (this.spacesIndex.has(oldPath)) {
            const oldmetadata = this.spacesIndex.get(oldPath).metadata;
            this.spacesIndex.set(newSpaceInfo.path, {
                ...this.spacesIndex.get(oldPath),
                path: newSpaceInfo.path,
                name: newSpaceInfo.name,
                space: newSpaceInfo,
            });
            this.spacesMap.rename(oldPath, newSpaceInfo.path);
            this.spacesMap.renameInverse(oldPath, newSpaceInfo.path);
            this.spacesIndex.delete(oldPath);
            await this.reloadSpace(newSpaceInfo, oldmetadata).then((f) => this.onSpaceDefinitionChanged(f, oldmetadata));
        }
    }
    public onSpaceDeleted(space: string) {
        if (this.spacesIndex.has(space)) {
            this.spacesIndex.delete(space);
        }
        this.spacesMap.delete(space);
        this.spacesMap.deleteInverse(space);
        this.persister.remove(space, "space");

        this.dispatchEvent("spaceDeleted", { path: space });
    }

    public allSpaces(ordered?: boolean): SpaceState[] {
        if (ordered) {
            return orderArrayByArrayWithKey([...this.spacesIndex.values()], this.spaceOrder(), "path");
        }
        return [...this.spacesIndex.values()];
    }
    public spaceOrder() {
        return [...this.focuses.flatMap((f) => f.paths)];
    }

    public async updateSpaceMetadata(spacePath: string, metadata: SpaceDefinition) {
        const space = this.spacesIndex.get(spacePath);
        const oldDef = space?.metadata;
        if (!space) {
            return this.reloadSpaceByPath(spacePath);
        }
        if (space.type == "tag") {
            const newSpaceCache = tagSpaceState(space.space, metadata);
            this.spacesIndex.set(spacePath, newSpaceCache);
            this.persister.store(spacePath, JSON.stringify(tagSpaceStateForStore(newSpaceCache)), "space", "");
            this.dispatchEvent("spaceStateUpdated", { path: space.path });
            return newSpaceCache;
        }
        let spaceDefChanged = false;

        const spaceSort = effectiveSpaceSort(metadata?.sort, this.settings);
        const sortable = spaceSort.field == "rank";
        if (!_.isEqual(space.metadata.links, metadata.links)) {
            spaceDefChanged = true;
        }
        const newSpaceCache: SpaceState = {
            ...space,
            metadata: metadata,
            sortable,
        };
        this.spacesIndex.set(spacePath, newSpaceCache);
        this.persister.store(spacePath, JSON.stringify(folderSpaceStateForStore(newSpaceCache)), "space");
        const pathState = this.pathsIndex.get(spacePath);
        if (pathState) {
            this.pathsIndex.set(spacePath, pathStateWithEffectiveLabel(pathState, this.spacesIndex));
            this.persister.store(spacePath, serializePathState(this.pathsIndex.get(spacePath)), "path");
            this.dispatchEvent("pathStateUpdated", { path: spacePath });
        }

        if (spaceDefChanged) {
            await this.onSpaceDefinitionChanged(newSpaceCache, oldDef);
        }
        this.dispatchEvent("spaceStateUpdated", { path: space.path });
        return newSpaceCache;
    }

    public async reloadSpace(space: SpaceInfo, spaceMetadata?: SpaceDefinition, initialized = true) {
        if (!space) return;
        const uri = this.spaceManager.uriByString(space.path);
        if (!uri) return null;
        const type: SpaceType = this.spaceManager.spaceTypeByString(uri);
        if (type == "tag") {
            const cache = tagSpaceState(space, spaceMetadata ?? this.spacesIndex.get(space.path)?.metadata);
            this.spacesIndex.set(space.path, cache);
            this.persister.store(space.path, JSON.stringify(tagSpaceStateForStore(cache)), "space", "");
            if (initialized) {
                this.dispatchEvent("spaceStateUpdated", { path: space.path });
            }
            return cache;
        }

        let pathState = this.pathsIndex.get(space.path);
        const metadata = spaceMetadata ?? (await this.spaceManager.spaceDefForSpace(space.path));
        if (!pathState) {
            const pathCache = await this.spaceManager.readPathCache(space.path);
            pathState = {
                path: space.path,
                name: space.name,
                tags: pathCache?.tags ?? [],
                spaces: [],
                outlinks: [],
                hidden: false,
                parent: pathCache?.parent ?? "",
                metadata: pathCache?.metadata,
                type: "space",
                subtype: type,
                label: pathCache?.label ?? emptyPathLabel(),
            };
            this.pathsIndex.set(space.path, pathState);
            this.persister.store(space.path, serializePathState(pathState), "path");
        }

        const spaceSort = effectiveSpaceSort(metadata?.sort, this.settings);
        const sortable = spaceSort.field == "rank" || !spaceSort;

        const cache: SpaceState = {
            name: space.name,
            space: space,
            path: space.path,
            type,
            metadata,
            dependencies: [],
            sortable,
        };
        this.spacesIndex.set(space.path, cache);
        if (pathState) {
            pathState = pathStateWithEffectiveLabel(pathState, this.spacesIndex);
            this.pathsIndex.set(space.path, pathState);
            this.persister.store(space.path, serializePathState(pathState), "path");
        }
        this.persister.store(space.path, JSON.stringify(folderSpaceStateForStore(cache)), "space");
        cache.metadata?.links?.forEach((f) => {
            if (pathIsSpace(this, f)) {
                this.spacesMap.set(f, new Set([...this.spacesMap.get(f), space.path]));
            }
        });
        if (initialized) {
            this.dispatchEvent("spaceStateUpdated", { path: space.path });

            return cache;
        }
    }
    private async pathReloaded(path: string, cache: PathState, changed: boolean, force: boolean) {
        if (!cache) return false;
        cache = pathStateWithEffectiveLabel(cache, this.spacesIndex);
        this.pathsIndex.set(path, cache);
        await this.onPathReloaded(path);
        if (cache.subtype == "image") {
            this.imagesCache.set(cache.metadata.file.filename, path);
        }
        if (!changed && !force) {
            return false;
        }

        this.tagsMap.set(path, new Set(cache.tags));
        this.linksMap.set(path, new Set(cache.outlinks));

        if (!_.isEqual(cache.spaces, Array.from(this.spacesMap.get(path)))) {
            this.spacesMap.set(path, new Set(cache.spaces));
        }
        if (force) {
            cache.spaces.forEach((f) => this.dispatchEvent("spaceStateUpdated", { path: f }));
        }
    }
    public async reloadPath(path: string, force?: boolean): Promise<boolean> {
        if (!path) return false;

        return this.indexer.reload<{ cache: PathState; changed: boolean }>({ type: "path", path: path }).then(async (r) => {
            await this.pathReloaded(path, r.cache, r.changed, force);

            return true;
        });
    }

    public async onPathReloaded(path: string) {
        let pathState: PathState;

        if (this.pathsIndex.has(path)) {
            pathState = this.pathsIndex.get(path);
        }
        if (!pathState) {
            return false;
        }

        await this.persister.store(path, serializePathState(pathState), "path");
    }
}
