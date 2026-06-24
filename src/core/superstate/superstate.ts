import i18n from "shared/i18n";

import { UIManager } from "core/middleware/ui";
import { fileSystemSpaceInfoFromTag } from "core/spaceManager/filesystemAdapter/spaceInfo";
import { SpaceManager } from "core/spaceManager/spaceManager";
import { defaultSpaceSort, saveProperties, saveSpaceCache, saveSpaceMetadataValue } from "core/superstate/utils/spaces";
import { builtinSpaces } from "core/types/space";
import { folderForTagSpace, pathIsSpace } from "core/utils/spaces/space";
import { spacePathFromName, tagSpacePathFromTag } from "core/utils/strings";
import { parsePathState } from "core/utils/superstate/parser";
import { serializePathState } from "core/utils/superstate/serializer";
import { applyContextLabelsToPaths } from "core/superstate/cacheParsers";
import _, { debounce } from "lodash";
import { fieldTypeForField } from "schemas/mdb";
import { tagsSpacePath } from "shared/schemas/builtin";
import { normalizeContextPath, PathPropertyName } from "shared/types/context";
import { Focus } from "shared/types/focus";
import { IndexMap } from "shared/types/indexMap";
import { SpaceProperty } from "shared/types/mdb";
import { ContextState, PathState, SpaceState } from "shared/types/PathState";
import { LocalCachePersister } from "shared/types/persister";
import { MakeMDSettings } from "shared/types/settings";
import { FilterGroupDef, SpaceDefinition, SpaceType } from "shared/types/spaceDef";
import { SpaceInfo } from "shared/types/spaceInfo";
import { orderArrayByArrayWithKey, uniq } from "shared/utils/array";
import { EventDispatcher } from "shared/utils/dispatchers/dispatcher";
import { safelyParseJSON } from "shared/utils/json";
import { removeLinkInContexts, removePathInContexts, removeTagInContexts, renameLinkInContexts, renamePathInContexts, renameTagInContexts, updateContextWithProperties } from "../utils/contexts/context";
import { API } from "./api";

import { linkContextRow } from "core/utils/contexts/linkContextRow";
import { allMetadata } from "core/utils/metadata";
import { Metadata } from "shared/types/metadata";
import { Indexer } from "./workers/indexer/indexer";

import Fuse, { FuseIndex } from "fuse.js";
import { SuperstateEvent } from "shared/types/PathState";
import { ISuperstate, PathStateWithRank } from "shared/types/superstate";
import { parseMDBStringValue } from "utils/properties";
import { fastSearch, searchPath } from "./workers/search/impl";
export type SuperProperty = {
    id: string;
    name: string;
};

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
    public contextsIndex: Map<string, ContextState>;

    //Persistant Cache
    public imagesCache: Map<string, string>;

    public spacesDBLoaded: boolean;

    //Maps
    public spacesMap: IndexMap; //file to space mapping
    public linksMap: IndexMap; //link between paths
    public tagsMap: IndexMap; //file to tag mapping
    public liveSpaceLinkMap: IndexMap;
    //Workers
    public allMetadata: Record<
        string,
        {
            name: string;
            properties: Metadata[];
        }
    >;
    private contextStateQueue: Promise<unknown>;
    private indexer: Indexer;

    public focuses: Focus[];
    public searchIndex: FuseIndex<PathState>;
    public async search(_path: string, query?: string, queries?: FilterGroupDef[]) {
        const navigatorSearchResults = (paths: PathState[]) => paths.filter((f) => !f.path.startsWith("spaces://"));
        if (query) {
            return navigatorSearchResults(fastSearch(query, this.pathsIndex, 10, this.searchIndex));
        }
        return navigatorSearchResults(searchPath({ queries: queries, pathsIndex: this.pathsIndex, count: 10 }));
    }
    public reindexSearch() {
        this.indexer.reload<Record<string, unknown>>({ type: "index", path: "" }).then((r) => {
            this.searchIndex = Fuse.parseIndex(r as any);
        });
    }
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

        this.allMetadata = {};
        this.api = new API(this);
        // Initialize SpaceManager's API reference
        spaceManager.api = new API(this, spaceManager);

        //Initiate Indexes
        this.pathsIndex = new Map();
        this.spacesIndex = new Map();
        this.contextsIndex = new Map();
        this.focuses = [];
        //Initiate Maps
        this.spacesMap = new IndexMap();
        this.linksMap = new IndexMap();
        this.tagsMap = new IndexMap();
        this.liveSpaceLinkMap = new IndexMap();

        //Initiate Persistance
        this.imagesCache = new Map();
        this.contextStateQueue = Promise.resolve();

        //Intiate Workers
        this.indexer = new Indexer(2, this);

        this.eventsDispatcher.addListener("pathStateUpdated", () => {
            debounce(() => this.reindexSearch(), 300)();
        });
        this.eventsDispatcher.addListener("superstateReindex", () => {
            debounce(() => this.reindexSearch(), 300)();
        });
        // window['make'] = this;
    }

    public refreshMetadata() {
        this.allMetadata = allMetadata(this);
    }
    public async initializeIndex() {
        await this.loadFromCache();
    }

    public addToContextStateQueue(operation: () => Promise<unknown>) {
        //Simple queue (FIFO) for processing context changes
        this.contextStateQueue = this.contextStateQueue.then(operation).catch(() => {
            //do nuth'ing
        });
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
        await this.initializeContexts();

        this.refreshMetadata();
        this.dispatchEvent("superstateUpdated", null);
        this.ui.notify(`Make.md - Superstate Loaded in ${(Date.now() - start) / 1000} seconds`, "console");
        this.persister.cleanType("space");
        this.persister.cleanType("path");
        this.persister.cleanType("context");
    }

    public async initializeSpaces() {
        const allSpaces = [...this.spaceManager.allSpaces().values()];

        const promises = allSpaces.map((f) => this.reloadSpace(f, null, true));
        [...this.spacesIndex.keys()].filter((f) => !allSpaces.some((g) => g.path == f)).forEach((f) => this.onSpaceDeleted(f));

        await Promise.all(promises);
    }

    private pathsForTagSpace(spacePath: string): string[] {
        if (!spacePath?.startsWith("spaces://#")) return [];

        const tag = spacePath.slice("spaces://".length).toLowerCase();
        const indexedPaths = [...this.tagsMap.getInverse(tag)];
        const adapterPaths = this.spaceManager.pathsForTag?.(tag) ?? [];
        return uniq([...indexedPaths, ...adapterPaths]);
    }

    public getSpaceItems(spacePath: string): PathStateWithRank[] {
        const items = spacePath?.startsWith("spaces://#") ? this.pathsForTagSpace(spacePath) : [...this.spacesMap.getInverse(spacePath)];
        const ranks = this.contextsIndex.get(spacePath)?.paths ?? [];

        return items
            .map<PathStateWithRank>((f) => {
                this.spaceManager.loadPath(f);
                const pathCache = this.pathsIndex.get(f);

                return {
                    ...pathCache,
                    rank: ranks.indexOf(f),
                } as PathStateWithRank;
            })
            .filter((f) => f?.hidden != true && f.path != spacePath);
    }
    private async initializeContexts() {
        await this.indexer.reload<Map<string, { cache: ContextState; changed: boolean }>>({ type: "contexts", path: "" }).then(async (r) => {
            const promises = [...r.entries()].map(([path, { cache, changed }]) => this.contextReloaded(path, cache, changed, true));
            await Promise.all(promises);
        });
    }

    public async loadFromCache() {
        this.dispatchEvent("superstateReindex", null);
        const allPaths = await this.persister.loadAll("path");
        const allSpaces = await this.persister.loadAll("space");
        const allContexts = await this.persister.loadAll("context");

        allSpaces.forEach((s) => {
            const space = safelyParseJSON(s.cache);
            if (space && space.type) {
                this.spacesIndex.set(s.path, space);
            }
        });
        allContexts.forEach((s) => {
            const space = safelyParseJSON(s.cache);
            if (space) {
                this.contextsIndex.set(s.path, space);
            }
        });

        allPaths.forEach((f) => {
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

    public async initializeBuiltins() {
        const allBuiltins = builtinSpaces;
        const promises = Object.keys(allBuiltins).map((f) => this.reloadPath("spaces://$" + f, true));
        await Promise.all(promises);
    }

    public async initializeTags() {
        const allTags = this.spaceManager.readTags().map((f) => fileSystemSpaceInfoFromTag(this.spaceManager, f));
        const promises = [...allTags].map((l) => this.reloadSpace(l, null, true));
        await Promise.all(promises);
    }

    public async onSpaceDefinitionChanged(space: SpaceState, oldDef?: SpaceDefinition) {
        const currentPaths = this.spacesMap.getInverse(space.path);
        const newPaths: string[] = [];
        if (space.metadata?.links && !_.isEqual(space.metadata.links, oldDef?.links)) {
            newPaths.push(...space.metadata.links);
        }
        const diff = [..._.difference(newPaths, [...currentPaths]), ..._.difference([...currentPaths], newPaths)];
        const cachedPromises = diff.map((f) => this.reloadPath(f, true).then(() => this.dispatchEvent("pathStateUpdated", { path: f })));
        await Promise.all(cachedPromises);
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
        const oldPath = spacePathFromName(tag);
        const newSpaceInfo = fileSystemSpaceInfoFromTag(this.spaceManager, newTag);
        await this.onSpaceRenamed(oldPath, newSpaceInfo);
        await this.onPathRename(oldPath, newSpaceInfo.path);
        this.dispatchEvent("spaceChanged", { path: oldPath, newPath: newSpaceInfo.path });

        const allContextsWithTag: SpaceInfo[] = [];
        for (const [contextPath, spaceCache] of this.spacesIndex) {
            const contextCache = this.contextsIndex.get(contextPath);
            if (contextCache?.contexts.includes(tag)) {
                this.addToContextStateQueue(() => renameTagInContexts(this.spaceManager, tag, newTag, allContextsWithTag));
            }
            if (spaceCache.metadata?.contexts.includes(tag)) {
                saveSpaceCache(this, spaceCache.space, { ...spaceCache.metadata, contexts: spaceCache.metadata.contexts.map((f) => (f == tag ? newTag : f)) });
            }
        }
        this.dispatchEvent("spaceStateUpdated", { path: tagsSpacePath });
    }

    public async onTagDeleted(tag: string) {
        this.tagsMap.getInverse(tag).forEach((path) => {
            this.deleteTagInPath(tag, path);
        });
        const spacePath = folderForTagSpace(tag, this.settings);
        await this.spaceManager.deletePath(spacePath);
        this.onSpaceDeleted(tagSpacePathFromTag(tag));
        for (const spaceCache of this.spacesIndex.values()) {
            if (spaceCache.metadata?.contexts.includes(tag)) {
                saveSpaceCache(this, spaceCache.space, { ...spaceCache.metadata, contexts: spaceCache.metadata.contexts.filter((f) => f != tag) });
            }
        }
        const allContextsWithTag: SpaceInfo[] = [];
        for (const contextCache of this.contextsIndex.values()) {
            if (contextCache.contexts.includes(tag)) {
                allContextsWithTag.push(this.spaceManager.spaceInfoForPath(contextCache.path));
            }
        }

        this.addToContextStateQueue(() => removeTagInContexts(this.spaceManager, tag, allContextsWithTag));
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

    public onMetadataChange(path: string) {
        if (!this.pathsIndex.has(path)) {
            return;
        }
        this.reloadPath(path).then(() => {
            const pathState = this.pathsIndex.get(path);
            const spaceState = this.spacesIndex.get(path);
            if (spaceState) {
                this.reloadSpace(spaceState.space).then((f) => this.onSpaceDefinitionChanged(f, spaceState.metadata));
            }
            const allContextsWithFile = pathState.spaces.map((f) => this.spacesIndex.get(f)?.space).filter((f) => f);
            this.addToContextStateQueue(() => updateContextWithProperties(this, path, allContextsWithFile));
            this.dispatchEvent("pathStateUpdated", { path: path });
        });
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

            const allContextsWithPath = oldSpaces.map((f) => this.spacesIndex.get(f)).filter((f) => f);

            // Index the new path FIRST so it's available when contexts reload
            await this.reloadPath(newFilePath, true);

            await renamePathInContexts(
                this.spaceManager,
                oldPath,
                newFilePath,
                allContextsWithPath.map((f) => f.space),
            );
            // Remove any orphaned old path entries
            await removePathInContexts(
                this.spaceManager,
                oldPath,
                allContextsWithPath.map((f) => f.space),
            );
            for (const space of allContextsWithPath) {
                if (space.metadata?.links?.includes(oldPath)) {
                    this.addToContextStateQueue(() =>
                        saveSpaceMetadataValue(
                            this,
                            space.path,
                            "links",
                            space.metadata.links.map((f) => (f == oldPath ? newPath : f)),
                        ),
                    );
                }
                await this.reloadContext(space.space, { force: true, calculate: true });
            }
            const allContextsWithLink: SpaceInfo[] = [];
            for (const contextCache of this.contextsIndex.values()) {
                if (contextCache.outlinks.includes(oldPath)) {
                    allContextsWithLink.push(this.spacesIndex.get(contextCache.path).space);
                }
            }
            this.addToContextStateQueue(() => renameLinkInContexts(this.spaceManager, oldPath, newFilePath, allContextsWithLink).then(() => Promise.all(allContextsWithLink.map((c) => this.reloadContext(c, { force: true, calculate: true })))));
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
        //reload contexts to calculate proper paths
        const cachedPromises = changedSpaces.map((f) => this.reloadContext(this.spacesIndex.get(f)?.space, { force: false, calculate: true }));
        await Promise.all(cachedPromises);

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

        const allContextsWithFile = (fileCache.spaces ?? []).map((f) => this.spacesIndex.get(f)?.space).filter((f) => f);
        this.addToContextStateQueue(() => removePathInContexts(this.spaceManager, path, allContextsWithFile).then(() => allContextsWithFile.forEach((c) => this.reloadContext(c, { force: false, calculate: true }))));
        const allContextsWithLink: SpaceInfo[] = [];
        for (const contextCache of this.contextsIndex.values()) {
            if (contextCache.outlinks.includes(path) && this.spacesIndex.has(contextCache.path)) {
                allContextsWithLink.push(this.spacesIndex.get(contextCache.path).space);
            }
        }
        this.addToContextStateQueue(() => removeLinkInContexts(this.spaceManager, path, allContextsWithLink).then(() => allContextsWithFile.forEach((c) => this.reloadContext(c, { force: false, calculate: true }))));

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
            this.contextsIndex.delete(oldPath);
            await this.reloadSpace(newSpaceInfo, oldmetadata).then((f) => this.onSpaceDefinitionChanged(f, oldmetadata));
            await this.reloadContext(newSpaceInfo, { force: true, calculate: true });
        }
    }
    public onSpaceDeleted(space: string) {
        if (this.spacesIndex.has(space)) {
            this.spacesIndex.delete(space);
            this.contextsIndex.delete(space);
        }
        this.spacesMap.delete(space);
        this.spacesMap.deleteInverse(space);
        this.persister.remove(space, "space");

        this.dispatchEvent("spaceDeleted", { path: space });
    }

    public async reloadContextByPath(
        path: string,
        options?: {
            calculate?: boolean;
            force?: boolean;
        },
    ) {
        return this.reloadContext(this.spaceManager.spaceInfoForPath(path), options);
    }
    public async reloadContext(
        space: SpaceInfo,
        options?: {
            calculate?: boolean;
            force?: boolean;
        },
    ) {
        if (!space) return false;

        return this.indexer.reload<{ cache: ContextState; changed: boolean }>({ type: "context", path: space.path, payload: options }).then((r) => {
            return this.contextReloaded(space.path, r.cache, r.changed, options?.force);
        });
    }

    public async contextReloaded(path: string, cache: ContextState, changed: boolean, force?: boolean) {
        if (!cache) return false;
        if (!changed && !force) {
            return false;
        }

        this.contextsIndex.set(path, cache);
        applyContextLabelsToPaths(cache.contextTable, this.pathsIndex);
        const pathState = this.pathsIndex.get(path);
        if (pathState && cache.dbExists /* && !this.spacesIndex.get(path)?.space?.readOnly */) {
            const allRows = cache.contextTable?.rows ?? [];
            const allColumns = cache.contextTable?.cols ?? [];
            const updatedValues = allRows.filter((f) => {
                const path = normalizeContextPath(f[PathPropertyName]);
                const pathCache = this.pathsIndex.get(path);

                if (!pathCache) {
                    return false;
                }
                if (pathCache.type == "file" && pathCache.subtype != "md") return false;
                return allColumns.reduce((acc, col) => {
                    if (acc) return acc;
                    if (col.type != "fileprop" || col.primary == "true") return acc;
                    if (f[col.name]?.length > 0 && pathCache.metadata?.property?.[col.name] != f[col.name]) return true;
                    return acc;
                }, false);
            });
            if (updatedValues.length > 0) {
                updatedValues.forEach((f) =>
                    saveProperties(
                        this,
                        normalizeContextPath(f[PathPropertyName]),
                        allColumns.reduce((acc, col) => {
                            if (col.type == "fileprop" && col.primary != "true") {
                                return { ...acc, [col.name]: parseMDBStringValue(fieldTypeForField(col), f[col.name], true) };
                            }
                            return acc;
                        }, {}),
                    ),
                );
            }
        }
        if (cache.dbExists && changed) {
            await this.spaceManager.saveTable(path, cache.contextTable);
        }
        this.persister.store(path, JSON.stringify(cache), "context");
        this.dispatchEvent("contextStateUpdated", { path: path });

        return true;
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
        let spaceDefChanged = false;

        const spaceSort = metadata?.sort ?? { field: "rank", asc: true, group: true };
        const sortable = spaceSort.field == "rank";
        if (!_.isEqual(space.metadata.links, metadata.links)) {
            spaceDefChanged = true;
        }
        const newSpaceCache: SpaceState = {
            ...space,
            metadata: metadata,
            contexts: metadata?.contexts ?? [],
            sortable,
        };
        this.spacesIndex.set(spacePath, newSpaceCache);

        if (spaceDefChanged) {
            await this.onSpaceDefinitionChanged(newSpaceCache, oldDef);
        }
        this.dispatchEvent("spaceStateUpdated", { path: space.path });
        return newSpaceCache;
    }

    public async reloadSpace(space: SpaceInfo, spaceMetadata?: SpaceDefinition, initialized = true) {
        if (!space) return;
        const metadata = spaceMetadata ?? (await this.spaceManager.spaceDefForSpace(space.path));

        let pathState = this.pathsIndex.get(space.path);
        const uri = this.spaceManager.uriByString(space.path);
        if (!uri) return null;
        const type: SpaceType = this.spaceManager.spaceTypeByString(uri);
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
                label: pathCache?.label ?? { sticker: "", color: "" },
            };
            this.pathsIndex.set(space.path, pathState);
            this.persister.store(space.path, serializePathState(pathState), "path");
        }
        const propertyTypes: SpaceProperty[] = [];
        let properties = {};

        if (propertyTypes.length > 0) {
            properties = await this.spaceManager.readProperties(space.defPath).then((f) => linkContextRow(this.pathsIndex, this.contextsIndex, f, propertyTypes, pathState));
        }

        [...this.spacesMap.get(space.path)]
            .map((f) => this.contextsIndex.get(f))
            .forEach((f) => {
                if (f) {
                    const contextProps = f.contextTable?.cols ?? [];
                    propertyTypes.push(...contextProps);
                    properties = { ...properties, ...(f.contextTable?.rows.find((g) => normalizeContextPath(g[PathPropertyName]) == space.path) ?? {}) };
                }
            });

        const spaceSort = metadata?.sort ?? defaultSpaceSort;
        const sortable = spaceSort.field == "rank" || !spaceSort;
        const contexts: string[] = metadata?.contexts ?? [];

        const cache: SpaceState = {
            name: space.name,
            space: space,
            path: space.path,
            type,
            contexts: contexts.map((f) => f.toLowerCase()),
            metadata,
            dependencies: [],
            sortable,
            properties,
            propertyTypes,
        };
        this.spacesIndex.set(space.path, cache);
        this.persister.store(space.path, JSON.stringify(cache), "space");
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
            //initiate missing tags
            const promises = cache.tags
                .map((f) => fileSystemSpaceInfoFromTag(this.spaceManager, f))
                .filter((f) => !this.spacesIndex.has(f.path))
                .map(async (f) => {
                    await this.reloadSpace(f);
                    this.reloadContext(f, { force: false, calculate: true });
                    await this.reloadPath(f.path);
                    return;
                });
            const allPromises = Promise.all(promises);
            await allPromises.then(() => {
                this.dispatchEvent("spaceStateUpdated", { path: tagsSpacePath });
            });
        }
        if (force) {
            const allContextsWithFile = cache.spaces.map((f) => this.spacesIndex.get(f)?.space).filter((f) => f);

            this.addToContextStateQueue(() =>
                updateContextWithProperties(this, path, allContextsWithFile).then(() => {
                    allContextsWithFile.forEach((f) => {
                        this.dispatchEvent("spaceStateUpdated", { path: f.path });
                    });
                }),
            );
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
