import { UIManager } from "core/middleware/ui";
import { fileSystemSpaceInfoFromTag } from "core/spaceManager/filesystemAdapter/spaceInfo";
import { SpaceManager } from "core/spaceManager/spaceManager";
import { effectiveSpaceSort, saveSpaceCache } from "core/utils/superstate/spaces";
import { canonicalTagSpacePath, isSpaceSeparatorPath, replaceTagSpaceLinkPath, sameTagSpaceLink, tagSpacePathFromTag } from "schemas/builtin";
import { pathIsSpace } from "core/utils/superstate/space";
import { parsePathState } from "core/utils/superstate/parser";
import { serializePathState } from "core/utils/superstate/serializer";
import _ from "lodash";
import { isTagSpacePath, tagSpaceNameFromPath } from "schemas/builtin";
import { Focus, renameFocusExcludedPaths } from "shared/types/focus";
import { IndexMap } from "shared/types/indexMap";
import { FilesystemSpaceInfo, PathState, SpaceState } from "shared/types/PathState";
import { LocalCachePersister } from "shared/types/persister";
import { MakeMDSettings, renameExpandedSpacePaths } from "shared/types/settings";
import { SpaceDefinition } from "shared/types/spaceDef";
import { orderArrayByArrayWithKey, uniq } from "utils/array";
import { EventDispatcher } from "utils/dispatcher";
import { safelyParseJSON } from "utils/json";
import { excludePathPredicate, isSpaceInternalPath } from "utils/hide";

import { Indexer } from "./workers/indexer/indexer";

import { SuperstateEvent, SpaceType } from "shared/types/PathState";
import { ISuperstate, PathStateWithRank } from "shared/types/superstate";
import { ensureArray } from "core/utils/schema";
import { pathDisplayInfo } from "core/react/components/UI/pathDisplay";
import { getFolderNotePath } from "integrations/folderNotesPluginIntegration";


const spaceDisplayMetadata = (metadata?: SpaceDefinition | null) => {
    metadata ??= {};
    return {
        color: metadata.color,
        sticker: metadata.sticker,
        defaultColor: metadata.defaultColor,
        defaultSticker: metadata.defaultSticker,
        fileColors: metadata["file-colors"],
    }
}

const tagSpaceInfoForCache = (): FilesystemSpaceInfo => ({
    defPath: "",
    notePath: "",
    folderPath: "",
}) as FilesystemSpaceInfo;

const tagSpaceMetadata = (metadata: SpaceDefinition = {}): SpaceDefinition => ({
    ...(metadata.color ? { color: metadata.color } : {}),
    ...(metadata.sort ? { sort: metadata.sort } : {}),
    "rank-order": ensureArray(metadata["rank-order"]),
    pinned: ensureArray(metadata.pinned),
    "file-colors": metadata["file-colors"] ?? {},
});

const tagSpaceState = (space: SpaceState, metadata?: SpaceDefinition): SpaceState => ({
    type: "tag",
    name: space.name,
    path: space.path,
    metadata: tagSpaceMetadata(metadata),
    space: tagSpaceInfoForCache(),
});

const tagSpaceStateForStore = (space: SpaceState): SpaceState => ({
    type: "tag",
    name: tagSpaceNameFromPath(space.path),
    path: space.path,
    metadata: tagSpaceMetadata(space.metadata),
    space: tagSpaceInfoForCache(),
}) as SpaceState;

const folderSpaceInfoForStore = (space: SpaceState): FilesystemSpaceInfo => ({
    defPath: space.space.defPath,
    folderPath: space.space.folderPath,
    notePath: space.space.notePath,
}) as FilesystemSpaceInfo;

const folderSpaceStateForStore = (space: SpaceState): SpaceState => ({
    type: space.type,
    name: space.name,
    path: space.path,
    metadata: space.metadata,
    space: folderSpaceInfoForStore(space),
}) as SpaceState;

const folderSpaceStateFromStore = (space: SpaceState): SpaceState => ({
    ...space,
    space: space.space,
});

const tagPathStateForSpace = (space: SpaceState): PathState => ({
    type: "space",
    subtype: "tag",
    path: space.path,
    name: space.name,
    tags: [],
    spaces: [],
    linkedSpaces: [],
    pinnedSpaces: [],
    hidden: false,
    parent: "",
    color: "",
    sticker: "lucide//hash",
    metadata: {},
});

const isFolderLikePathState = (pathState: PathState): boolean => pathState?.type == "space" || pathState?.subtype == "folder";

const effectiveDisplayForPathState = (pathState: PathState, spacesIndex: Map<string, SpaceState>, parentSpacePath?: string): Pick<PathState, "color" | "sticker"> => {
    if (!pathState) return { color: "", sticker: "" };
    const ownSpaceMetadata = spacesIndex.get(pathState.path)?.metadata ?? {};
    const parentMetadata = spacesIndex.get(parentSpacePath ?? pathState.parent)?.metadata ?? {};

    if (isFolderLikePathState(pathState)) {
        return {
            sticker: ownSpaceMetadata.sticker || parentMetadata.defaultSticker || pathDisplayInfo(pathState.path, "folder").icon,
            color: ownSpaceMetadata.color ?? parentMetadata.defaultColor ?? "",
        };
    }

    const fileColors = parentMetadata["file-colors"] ?? {};
    return {
        sticker: pathDisplayInfo(pathState.path).icon,
        color: fileColors[pathState.path] ?? parentMetadata.defaultColor ?? "",
    };
};

const pathStateWithEffectiveDisplay = <T extends PathState>(pathState: T, spacesIndex: Map<string, SpaceState>, parentSpacePath?: string): T => ({
    ...pathState,
    ...effectiveDisplayForPathState(pathState, spacesIndex, parentSpacePath),
});

const replacePathInList = (items: unknown, oldPath: string, newPath: string): string[] => uniq(ensureArray(items).map((path) => (path == oldPath ? newPath : path)));

const parentPathForPath = (path: string): string => {
    const index = path.lastIndexOf("/");
    return index == -1 ? "" : path.slice(0, index);
};

const replaceOrUnpinMovedPath = (items: unknown, oldPath: string, newPath: string, spacePath: string): string[] => {
    const movedOutOfFolderSpace = parentPathForPath(oldPath) == spacePath && parentPathForPath(newPath) != spacePath;
    if (movedOutOfFolderSpace) return ensureArray(items).filter((path) => path != oldPath && path != newPath);
    return replacePathInList(items, oldPath, newPath);
};

const replacePathInFileColors = (fileColors: Record<string, string> = {}, oldPath: string, newPath: string): Record<string, string> =>
    Object.keys(fileColors).reduce<Record<string, string>>((acc, key) => {
        const nextKey = key == oldPath ? newPath : key;
        return {
            ...acc,
            [nextKey]: fileColors[key],
        };
    }, {});

export class Superstate implements ISuperstate {
    private initializing = false;
    public static create(indexVersion: string, onChange: () => void, spaceManager: SpaceManager, uiManager: UIManager): Superstate {
        return new Superstate(indexVersion, onChange, spaceManager, uiManager);
    }
    public initialized: boolean;
    public eventsDispatcher: EventDispatcher<SuperstateEvent>;
    public spaceManager: SpaceManager;
    public settings: MakeMDSettings;
    public saveSettings: (refresh?: boolean) => Promise<void>;

    public ui: UIManager;

    private renameExpandedSpaces(oldPath: string, newPath: string) {
        if (!this.settings) return false;
        const expandedSpaces = renameExpandedSpacePaths(this.settings.expandedSpaces ?? [], oldPath, newPath);
        if (expandedSpaces === this.settings.expandedSpaces) return false;
        this.settings.expandedSpaces = expandedSpaces;
        return true;
    }

    //Index
    public pathsIndex: Map<string, PathState>;
    public spacesIndex: Map<string, SpaceState>;

    //Maps
    public spacesMap: IndexMap; //file to space mapping
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

        //Initiate Indexes
        this.pathsIndex = new Map();
        this.spacesIndex = new Map();
        this.focuses = [];

        //Initiate Maps
        this.spacesMap = new IndexMap();
        this.tagsMap = new IndexMap();
        this.liveSpaceLinkMap = new IndexMap();

        //Intiate Workers
        this.indexer = new Indexer(2, this);
        this.metadataChanges = new Map();
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
        this.initializing = true;
        try {
            this.initializeFocuses();
            await this.initializeSpaces();
            await this.initializeTags();
            await this.initializePaths();

            this.dispatchEvent("superstateUpdated", null);
            this.ui.notify(`Spaces :: Superstate Loaded in ${(Date.now() - start) / 1000} seconds`, "console");
            this.persister.cleanType("space");
            this.persister.cleanType("path");
        } finally {
            this.initializing = false;
        }
    }

    public async initializeSpaces() {
        const allSpaces = [...this.spaceManager.allSpaces(true).values()];

        const promises = allSpaces.map((f) => this.reloadSpace(f, null, true));
        const deletedSpaces = [...this.spacesIndex.keys()].filter((f) => this.spacesIndex.get(f)?.type != "tag" && !allSpaces.some((g) => g.path == f));

        await Promise.all([...promises, ...deletedSpaces.map((path) => this.onSpaceDeleted(path))]);
    }

    private pathsForTagSpace(spacePath: string): string[] {
        if (!isTagSpacePath(spacePath))
            return [];

        const tag = '#' + tagSpaceNameFromPath(spacePath).toLowerCase();
        const childTagPrefix = tag + "/";
        const descendantTags = uniq([
            ...[...this.tagsMap.invMap.keys()].filter((indexedTag) => indexedTag.startsWith(childTagPrefix)),
            ...(this.spaceManager.readTags?.() ?? []).map((indexedTag) => indexedTag.toLowerCase()).filter((indexedTag) => indexedTag.startsWith(childTagPrefix)),
        ]);
        const groupBySubtags = effectiveSpaceSort(this.spacesIndex.get(spacePath)?.metadata?.sort, this.settings).subtags == true;
        if (!groupBySubtags) {
            const tags = [tag, ...descendantTags];
            const indexedPaths = tags.flatMap((indexedTag) => [...this.tagsMap.getInverse(indexedTag)]);
            const adapterPaths = tags.flatMap((indexedTag) => this.spaceManager.pathsForTag?.(indexedTag) ?? []);
            return uniq([...indexedPaths, ...adapterPaths].map((path) => this.folderPathForTaggedFolderNote(path) ?? path));
        }
        const childTagPaths = uniq(descendantTags.map((descendantTag) => childTagPrefix + descendantTag.slice(childTagPrefix.length).split("/")[0]))
            .map((childTag) => {
                const childPath = tagSpacePathFromTag(childTag);
                if (!this.spacesIndex.has(childPath))
                    this.spacesIndex.set(childPath, tagSpaceState(fileSystemSpaceInfoFromTag(this.spaceManager, childTag)));
                return childPath;
            });
        const indexedPaths = [...this.tagsMap.getInverse(tag)];
        const adapterPaths = this.spaceManager.pathsForTag?.(tag) ?? [];
        return uniq([
            ...childTagPaths,
            ...[...indexedPaths, ...adapterPaths].map((path) => this.folderPathForTaggedFolderNote(path) ?? path),
        ]);
    }

    private folderPathForTaggedFolderNote(path: string): string | null {
        const pathState = this.pathStateForPath(path);
        if (pathState?.type != "file" || pathState.subtype?.toLowerCase() != "md" || !pathState.parent)
            return null;

        const parentSpace = this.spacesIndex.get(pathState.parent);
        return parentSpace?.type == "folder" && parentSpace.space?.notePath == path ? parentSpace.path : null;
    }

    private syncSpaceRankOrder(spacePath: string, items: string[]): string[] {
        const spaceState = this.spacesIndex.get(spacePath);
        const currentOrder = ensureArray(spaceState?.metadata?.["rank-order"]);
        if (this.initializing) return currentOrder;
        if (!spaceState || !["tag", "folder", "vault"].includes(spaceState.type)) return currentOrder;
        if (spaceState.type != "tag" && effectiveSpaceSort(spaceState.metadata?.sort, this.settings).field != "rank") return currentOrder;
        if (spaceState.type != "tag" && currentOrder.length == 0) return currentOrder;

        const nextOrder = [
            ...currentOrder.filter((path) => isSpaceSeparatorPath(path) || items.includes(path)),
            ...items.filter((path) => !currentOrder.includes(path)),
        ];
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

    private isPathExplicitlyShownInSpace(path: string, spacePath: string): boolean {
        const metadata = this.spacesIndex.get(spacePath)?.metadata;
        return ensureArray(metadata?.links).some((link) => sameTagSpaceLink(link, path)) || ensureArray(metadata?.pinned).some((pinned) => sameTagSpaceLink(pinned, path));
    }

    private isHiddenSpaceRoot(spacePath: string): boolean {
        return this.pathsIndex.get(spacePath)?.hidden == true;
    }

    private indexedDirectChildrenForSpace(spacePath: string): string[] {
        return [...this.pathsIndex.values()]
            .filter((pathState) => pathState?.parent == spacePath && pathState.path != spacePath)
            .map((pathState) => pathState.path);
    }

    public getSpaceItems(spacePath: string): PathStateWithRank[] {
        const isTagSpace = isTagSpacePath(spacePath);
        const hiddenSpaceRoot = this.isHiddenSpaceRoot(spacePath);
        let items = isTagSpace ? this.pathsForTagSpace(spacePath) : [...this.spacesMap.getInverse(spacePath)];
        if (!isTagSpace && hiddenSpaceRoot) {
            items = uniq([...this.indexedDirectChildrenForSpace(spacePath), ...items]);
        }
        const ranks = this.syncSpaceRankOrder(spacePath, items);

        return items
            .map<PathStateWithRank>((f) => {
                this.spaceManager.loadPath(f);
                const pathCache = this.pathStateForPath(f);
                if (!pathCache) return null;

                return {
                    ...pathStateWithEffectiveDisplay(pathCache, this.spacesIndex, spacePath),
                    ...(isTagSpace && pathCache.subtype == "tag" ? { name: pathCache.name.split("/").pop() ?? pathCache.name } : {}),
                    rank: ranks.indexOf(f),
                } as PathStateWithRank;
            })
            .filter((f) => f && (f.hidden != true || this.isPathExplicitlyShownInSpace(f.path, spacePath) || hiddenSpaceRoot) && f.path != spacePath);
    }
    public async loadFromCache() {
        this.dispatchEvent("superstateReindex", null);
        const allPaths = await this.persister.loadAll("path");
        const allSpaces = await this.persister.loadAll("space");

        for (const s of allSpaces) {
            const space = safelyParseJSON(s.cache) as SpaceState;
            if (space && space.type) {
                if (space.type != "tag") {
                    const defPath = space.space?.defPath ?? this.spaceManager.spaceInfoForPath(s.path)?.space.defPath;
                    if (!defPath || !(await this.spaceManager.pathExists(defPath))) {
                        this.persister.remove(s.path, "space");
                        continue;
                    }
                }
                const normalizedSpace = space.type == "tag" ? tagSpaceState(space, space.metadata) : folderSpaceStateFromStore(space);
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
            if (spaceState?.type == "tag") return pathStateWithEffectiveDisplay(tagPathStateForSpace(spaceState), this.spacesIndex);
        }
        const pathState = this.pathsIndex.get(path);
        if (pathState) return pathStateWithEffectiveDisplay(pathState, this.spacesIndex);
        const spaceState = this.spacesIndex.get(path);
        if (spaceState?.type == "tag") return pathStateWithEffectiveDisplay(tagPathStateForSpace(spaceState), this.spacesIndex);
        return null;
    }

    public async initializeTags() {
        return;
    }

    public async onSpaceDefinitionChanged(space: SpaceState, oldDef?: SpaceDefinition) {
        if (!space) return;
        const currentPaths = [...this.spacesMap.getInverse(space.path)];
        const oldLinks = uniq(ensureArray(oldDef?.links).map(canonicalTagSpacePath));
        const newLinks = uniq(ensureArray(space.metadata?.links).map(canonicalTagSpacePath));
        const linksChanged = !_.isEqual(newLinks, oldLinks);
        const addedLinks = linksChanged ? _.difference(newLinks, oldLinks) : [];
        const removedLinks = linksChanged ? _.difference(oldLinks, newLinks) : [];
        const diff = [...addedLinks, ...removedLinks];
        const displayMetadataChanged = !_.isEqual(spaceDisplayMetadata(space.metadata), spaceDisplayMetadata(oldDef));

        addedLinks.forEach((path) => {
            this.spacesMap.set(path, new Set([...this.spacesMap.get(path), space.path]));
        });
        removedLinks.forEach((path) => {
            this.spacesMap.set(path, new Set([...this.spacesMap.get(path)].filter((linkedSpace) => linkedSpace != space.path)));
        });

        if (displayMetadataChanged) {
            await Promise.all(currentPaths.map((path) => this.refreshPathDisplay(path, space.path)));
        }

        const cachedPromises = diff.map((f) => {
            if (isTagSpacePath(f)) {
                this.dispatchEvent("pathStateUpdated", { path: f });
                return Promise.resolve();
            }
            return this.reloadPath(f, true).then(() => this.dispatchEvent("pathStateUpdated", { path: f }));
        });
        await Promise.all(cachedPromises);
    }

    private async refreshPathDisplay(path: string, parentSpacePath?: string) {
        const pathState = this.pathsIndex.get(path);
        if (!pathState) return;
        const nextPathState = pathStateWithEffectiveDisplay(pathState, this.spacesIndex, parentSpacePath);
        if (pathState.color == nextPathState.color && pathState.sticker == nextPathState.sticker) return;
        this.pathsIndex.set(path, nextPathState);
        await this.onPathReloaded(path);
        this.dispatchEvent("pathStateUpdated", { path });
    }

    public async initializeFocuses() {
        const allFocuses = await this.spaceManager.readFocuses();
        if (allFocuses.length == 0) {
            const display = pathDisplayInfo("/");
            this.spaceManager.saveFocuses([{
                    name: display.title,
                    sticker: display.icon,
                    paths: ["/"],
            }]);
            return;
        }
        this.focuses = allFocuses;
        this.dispatchEvent("focusesChanged", null);
    }

    public async initializePaths() {
        this.dispatchEvent("superstateReindex", null);
        const allFiles = this.spaceManager.allPaths(undefined, true);

        const start = Date.now();
        await this.indexer.reload<{ [key: string]: { cache: PathState; changed: boolean } }>({ type: "paths", path: "" }).then(async (r) => {
            for await (const [path, { cache, changed }] of Object.entries(r)) {
                await this.pathReloaded(path, cache, changed, false);
            }
        });

        this.ui.notify(`Make.md - ${allFiles.length} Paths Cached in ${(Date.now() - start) / 1000} seconds`, "console");

        const allPaths = uniq([...this.spacesIndex.keys(), ...allFiles]);
        const stalePaths = [...this.pathsIndex.keys()].filter((f) => !allPaths.some((g) => g == f));
        for (const path of stalePaths) {
            await this.onPathDeleted(path);
        }

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
            const excludedPaths = renameFocusExcludedPaths(focus["excluded-paths"], oldPath, newSpaceInfo.path);
            if (excludedPaths !== focus["excluded-paths"]) {
                focus["excluded-paths"] = excludedPaths;
                focusChanged = true;
            }
        });
        const expandedSpacesChanged = this.renameExpandedSpaces(oldPath, newSpaceInfo.path);
        const focusesSave = focusChanged ? this.spaceManager.saveFocuses(this.focuses) : Promise.resolve();
        const settingsSave = expandedSpacesChanged && this.saveSettings ? this.saveSettings(false) : Promise.resolve();
        if (expandedSpacesChanged) this.dispatchEvent("settingsChanged", null);
        await Promise.all([focusesSave, settingsSave]);
        this.dispatchEvent("spaceChanged", { path: oldPath, newPath: newSpaceInfo.path });
    }

    public async onTagDeleted(tag: string) {
        const tagPath = tagSpacePathFromTag(tag);
        const referencingSpaces = [...this.spacesIndex.values()].filter((space) =>
            space.path != tagPath && (
                ensureArray(space.metadata.links).some((path) => sameTagSpaceLink(path, tagPath)) ||
                ensureArray(space.metadata.pinned).includes(tagPath) ||
                ensureArray(space.metadata["rank-order"]).includes(tagPath) ||
                Object.prototype.hasOwnProperty.call(space.metadata["file-colors"] ?? {}, tagPath)
            )
        );
        for (const space of referencingSpaces) {
            const { [tagPath]: _removedColor, ...fileColors } = space.metadata["file-colors"] ?? {};
            await saveSpaceCache(this, space, {
                ...space.metadata,
                links: ensureArray(space.metadata.links).filter((path) => !sameTagSpaceLink(path, tagPath)),
                pinned: ensureArray(space.metadata.pinned).filter((path) => path != tagPath),
                "rank-order": ensureArray(space.metadata["rank-order"]).filter((path) => path != tagPath),
                "file-colors": fileColors,
            });
        }

        const nextFocuses = this.focuses.map((focus) => ({
            ...focus,
            paths: focus.paths.filter((path) => path != tagPath),
        }));
        if (!_.isEqual(nextFocuses, this.focuses))
            await this.spaceManager.saveFocuses(nextFocuses);

        await this.onSpaceDeleted(tagPath);
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
        const oldPathState = this.pathsIndex.get(path);
        const oldTagSpaces = this.loadedTagSpacesForPath(oldPathState);
        await this.reloadPath(path);
        const newTagSpaces = this.loadedTagSpacesForPath(this.pathsIndex.get(path));
        const spaceState = this.spacesIndex.get(path);
        if (spaceState) {
            const nextSpaceState = await this.reloadSpace(spaceState);
            await this.onSpaceDefinitionChanged(nextSpaceState, spaceState.metadata);
        }
        uniq([...oldTagSpaces, ...newTagSpaces]).forEach((spacePath) => {
            this.dispatchEvent("spaceStateUpdated", { path: spacePath });
        });
        this.dispatchEvent("pathStateUpdated", { path: path });
    }

    public reloadSpaceByPath(path: string, metadata?: SpaceDefinition) {
        return this.reloadSpace(this.spaceManager.spaceInfoForPath(path), metadata);
    }

    private folderNotePathForSpace(spacePath: string): string {
        return getFolderNotePath(this, spacePath, this.spaceManager.childrenForSpace(spacePath) ?? []);
    }

    private async refreshFolderNoteForSpace(spacePath: string) {
        const space = this.spacesIndex.get(spacePath);
        if (!space || space.type == "tag") return;
        const notePath = this.folderNotePathForSpace(spacePath);
        if ((space.space?.notePath ?? "") == notePath) return;

        const nextSpace = {
            ...space,
            space: {
                ...space.space,
                notePath,
            },
        };
        this.spacesIndex.set(spacePath, nextSpace);
        await this.persister.store(spacePath, JSON.stringify(folderSpaceStateForStore(nextSpace)), "space");
        this.dispatchEvent("spaceStateUpdated", { path: spacePath });
    }

    private loadedTagSpacesForPath(pathState?: PathState): string[] {
        return uniq(
            (pathState?.tags ?? [])
                .flatMap((tag) => {
                    const parts = tag.replace(/^#/, "").split("/");
                    return parts.map((_, index) => tagSpacePathFromTag("#" + parts.slice(0, index + 1).join("/")));
                })
                .filter((spacePath) => this.spacesIndex.get(spacePath)?.type == "tag"),
        );
    }

    public async onPathRename(oldPath: string, newPath: string) {
        //assume that space indexer has updated all records properly
        const newFilePath = newPath;
        const oldPathState = this.pathsIndex.get(oldPath);
        const oldParent = oldPathState?.parent;
        const oldSpaces = oldPathState?.spaces ?? [];
        const oldTagSpaces = this.loadedTagSpacesForPath(oldPathState);
        if (oldPathState) {
            this.spacesMap.delete(oldPath);
            this.spacesMap.deleteInverse(oldPath);
            this.tagsMap.delete(oldPath);
            this.pathsIndex.delete(oldPath);

            // Index the new path first so link and rank updates can resolve it.
            await this.reloadPath(newFilePath, true);

            for (const space of oldSpaces.map((f) => this.spacesIndex.get(f)).filter((f) => f)) {
                const metadata = {
                    ...space.metadata,
                    links: replacePathInList(space.metadata?.links, oldPath, newPath),
                    "rank-order": replacePathInList(space.metadata?.["rank-order"], oldPath, newPath),
                    pinned: replaceOrUnpinMovedPath(space.metadata?.pinned, oldPath, newPath, space.path),
                    "file-colors": replacePathInFileColors(space.metadata?.["file-colors"], oldPath, newPath),
                };
                const folderPath = space.space?.folderPath ?? space.path;
                if (space.type == "tag" || await this.spaceManager.pathExists(folderPath))
                    await saveSpaceCache(this, space, metadata);
                else
                    await this.updateSpaceMetadata(space.path, metadata);
            }
        }

        let focusChanged = false;
        this.focuses.forEach((focus) => {
            if (focus.paths.includes(oldPath)) {
                focus.paths = focus.paths.map((f) => (f == oldPath ? newPath : f));
                focusChanged = true;
            }
            const excludedPaths = renameFocusExcludedPaths(focus["excluded-paths"], oldPath, newPath);
            if (excludedPaths !== focus["excluded-paths"]) {
                focus["excluded-paths"] = excludedPaths;
                focusChanged = true;
            }
        });
        const expandedSpacesChanged = this.renameExpandedSpaces(oldPath, newPath);
        const focusesSave = focusChanged ? this.spaceManager.saveFocuses(this.focuses) : Promise.resolve();
        const settingsSave = expandedSpacesChanged && this.saveSettings ? this.saveSettings(false) : Promise.resolve();
        if (expandedSpacesChanged) this.dispatchEvent("settingsChanged", null);
        await Promise.all([focusesSave, settingsSave]);

        await this.reloadPath(newPath, true);
        const newParent = this.pathsIndex.get(newPath)?.parent;
        await Promise.all(uniq([oldParent, newParent].filter((path) => path)).map((path) => this.refreshFolderNoteForSpace(path)));
        this.persister.remove(oldPath, "path");

        const changedSpaces = uniq([...(this.spacesMap.get(newPath) ?? []), ...oldSpaces, ...oldTagSpaces]);

        changedSpaces.forEach((f) => this.dispatchEvent("spaceStateUpdated", { path: f }));
        this.dispatchEvent("pathChanged", { path: oldPath, newPath: newPath });

        this.ui.viewsByPath(oldPath).forEach((view) => {
            view.openPath(newPath);
        });
    }

    public async onPathCreated(path: string) {
        await this.reloadPath(path, true);
        const parent = this.pathsIndex.get(path)?.parent;
        if (parent) await this.refreshFolderNoteForSpace(parent);
        this.dispatchEvent("pathCreated", { path });
    }

    private async keepHiddenPathOnDelete(path: string): Promise<boolean> {
        if (isSpaceInternalPath(path)) return false;
        if (!excludePathPredicate(this.settings, path)) return false;
        if (!(await this.spaceManager.pathExists(path))) return false;

        await this.reloadPath(path, true);
        this.dispatchEvent("pathStateUpdated", { path });
        return true;
    }

    public async onPathDeleted(path: string) {
        if (await this.keepHiddenPathOnDelete(path)) return;

        this.spacesMap.delete(path);
        this.persister.remove(path, "path");
        const fileCache = this.pathsIndex.get(path);

        if (!fileCache) {
            return;
        }

        const affectedTagSpaces = this.loadedTagSpacesForPath(fileCache);
        this.tagsMap.delete(path);

        const affectedSpaces = (fileCache.spaces ?? [])
            .map((f) => this.spacesIndex.get(f))
            .filter((f) => f);
        await Promise.all(
            affectedSpaces.map((space) => {
                const { [path]: _removedColor, ...fileColors } = space.metadata?.["file-colors"] ?? {};
                return saveSpaceCache(this, space, {
                    ...space.metadata,
                    links: ensureArray(space.metadata?.links).filter((f) => !sameTagSpaceLink(f, path)),
                    "rank-order": ensureArray(space.metadata?.["rank-order"]).filter((f) => f != path),
                    pinned: ensureArray(space.metadata?.pinned).filter((f) => f != path),
                    "file-colors": fileColors,
                });
            }),
        );

        uniq([...(fileCache.spaces ?? []), ...affectedTagSpaces]).forEach((f) => {
            this.dispatchEvent("spaceStateUpdated", { path: f });
        });
        this.pathsIndex.delete(path);
        if (fileCache.parent) await this.refreshFolderNoteForSpace(fileCache.parent);
        this.dispatchEvent("pathDeleted", { path });
    }

    public async onSpaceRenamed(oldPath: string, newSpaceInfo: SpaceState) {
        if (this.spacesIndex.has(oldPath)) {
            const referencingSpaces = [...this.spacesIndex.values()].filter((space) =>
                space.path != oldPath && (
                    ensureArray(space.metadata?.links).some((link) => sameTagSpaceLink(link, oldPath)) ||
                    ensureArray(space.metadata?.["rank-order"]).includes(oldPath) ||
                    ensureArray(space.metadata?.pinned).includes(oldPath) ||
                    Object.prototype.hasOwnProperty.call(space.metadata?.["file-colors"] ?? {}, oldPath)
                )
            );
            for (const space of referencingSpaces) {
                const metadata = {
                    ...space.metadata,
                    links: ensureArray(space.metadata?.links).map((link) => sameTagSpaceLink(link, oldPath) ? replaceTagSpaceLinkPath(link, newSpaceInfo.path) : link),
                    "rank-order": replacePathInList(space.metadata?.["rank-order"], oldPath, newSpaceInfo.path),
                    pinned: replaceOrUnpinMovedPath(space.metadata?.pinned, oldPath, newSpaceInfo.path, space.path),
                    "file-colors": replacePathInFileColors(space.metadata?.["file-colors"], oldPath, newSpaceInfo.path),
                };
                const folderPath = space.space?.folderPath ?? space.path;
                if (space.type == "tag" || await this.spaceManager.pathExists(folderPath))
                    await saveSpaceCache(this, space, metadata);
                else
                    await this.updateSpaceMetadata(space.path, metadata);
            }
            const oldmetadata = this.spacesIndex.get(oldPath).metadata;
            this.spacesIndex.set(newSpaceInfo.path, {
                ...this.spacesIndex.get(oldPath),
                path: newSpaceInfo.path,
                name: newSpaceInfo.name,
                space: newSpaceInfo.space,
            });
            this.spacesMap.rename(oldPath, newSpaceInfo.path);
            this.spacesMap.renameInverse(oldPath, newSpaceInfo.path);
            this.spacesIndex.delete(oldPath);
            await this.reloadSpace(newSpaceInfo, oldmetadata).then((f) => this.onSpaceDefinitionChanged(f, oldmetadata));
        }

        let focusChanged = false;
        this.focuses.forEach((focus) => {
            if (!focus.paths.includes(oldPath)) return;
            focus.paths = focus.paths.map((path) => path == oldPath ? newSpaceInfo.path : path);
            focusChanged = true;
        });
        if (focusChanged) await this.spaceManager.saveFocuses(this.focuses);
    }
    public async onSpaceDeleted(space: string) {
        if (this.spacesIndex.has(space)) {
            this.spacesIndex.delete(space);
        }
        this.spacesMap.delete(space);
        this.spacesMap.deleteInverse(space);
        this.persister.remove(space, "space");

        const nextFocuses = this.focuses.map((focus) => ({
            ...focus,
            paths: focus.paths.filter((path) => path != space),
        }));
        if (!_.isEqual(nextFocuses, this.focuses)) await this.spaceManager.saveFocuses(nextFocuses);

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
            const newSpaceCache = tagSpaceState(space, metadata);
            this.spacesIndex.set(spacePath, newSpaceCache);
            this.persister.store(spacePath, JSON.stringify(tagSpaceStateForStore(newSpaceCache)), "space", "");
            this.dispatchEvent("spaceStateUpdated", { path: space.path });
            return newSpaceCache;
        }
        let spaceDefinitionChanged = false;

        if (!_.isEqual(space.metadata.links, metadata.links)) {
            spaceDefinitionChanged = true;
        }
        const newSpaceCache: SpaceState = {
            ...space,
            metadata: metadata,
        };
        this.spacesIndex.set(spacePath, newSpaceCache);
        this.persister.store(spacePath, JSON.stringify(folderSpaceStateForStore(newSpaceCache)), "space");
        const pathState = this.pathsIndex.get(spacePath);
        if (pathState) {
            this.pathsIndex.set(spacePath, pathStateWithEffectiveDisplay(pathState, this.spacesIndex));
            this.persister.store(spacePath, serializePathState(this.pathsIndex.get(spacePath)), "path");
            this.dispatchEvent("pathStateUpdated", { path: spacePath });
        }

        if (spaceDefinitionChanged) {
            await this.onSpaceDefinitionChanged(newSpaceCache, oldDef);
        }
        this.dispatchEvent("spaceStateUpdated", { path: space.path });
        return newSpaceCache;
    }

    public async reloadSpace(space: SpaceState, spaceMetadata?: SpaceDefinition, initialized = true) {
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
        const metadata = spaceMetadata ?? (await this.spaceManager.spaceDefinitionForPath(space.path));
        if (!pathState) {
            const pathCache = await this.spaceManager.readPathCache(space.path);
            pathState = {
                path: space.path,
                name: space.name,
                tags: pathCache?.tags ?? [],
                spaces: [],
                linkedSpaces: [],
                pinnedSpaces: [],
                hidden: false,
                parent: pathCache?.parent ?? "",
                metadata: pathCache?.metadata ?? {},
                type: "space",
                subtype: type,
                color: "",
                sticker: pathDisplayInfo(space.path, "folder").icon,
            };
            this.pathsIndex.set(space.path, pathState);
            this.persister.store(space.path, serializePathState(pathState), "path");
        }

        const cache: SpaceState = {
            name: space.name,
            space: {
                ...space.space,
                notePath: this.folderNotePathForSpace(space.path),
            },
            path: space.path,
            type,
            metadata,
        };
        this.spacesIndex.set(space.path, cache);
        if (pathState) {
            pathState = pathStateWithEffectiveDisplay(pathState, this.spacesIndex);
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
        cache = pathStateWithEffectiveDisplay(cache, this.spacesIndex);
        this.pathsIndex.set(path, cache);
        await this.onPathReloaded(path);
        if (!changed && !force) {
            return false;
        }

        this.tagsMap.set(path, new Set(cache.tags));

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
