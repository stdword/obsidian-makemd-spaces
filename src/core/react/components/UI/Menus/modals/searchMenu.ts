import { SelectMenuProps, SelectOption, SelectSection } from "shared/types/menu";
import { MakeMDSettings } from "shared/types/settings";
import i18n from "shared/i18n";
import { Superstate } from "makemd-core";
import { Rect } from "shared/types/Pos";
import { syncTagSpacesFromObsidian } from "core/superstate/utils/tags";
import { SpaceInfo } from "shared/types/spaceInfo";
import { excludePathPredicate } from "utils/hide";

export type SearchMenuTab = "folders" | "files" | "tags" | "refs";
export function getSearchMenuTabs(settings: MakeMDSettings, tabs: SearchMenuTab[]) {
    const desc = {
        folders: {
            label: i18n.labels.folders,
            limit: settings?.searchMenuFoldersLimit,
            allowCreation: false,
        },
        files: {
            label: i18n.labels.files,
            limit: settings?.searchMenuFilesLimit,
            allowCreation: false,
        },
        tags: {
            label: i18n.labels.tags,
            limit: settings?.searchMenuTagsLimit,
            allowCreation: true,
        },
        refs: {
            label: i18n.labels.refs,
            limit: settings?.searchMenuRefsLimit,
            allowCreation: true,
        },
    }
    return tabs.map(t => ({id: t, ...desc[t]}))
}


const folderSortParts = (path: string) => {
    const parts = path.split("/").filter((part) => part.length > 0);
    return {
        depth: parts.length,
        parent: parts.slice(0, -1).join("/"),
        name: parts[parts.length - 1] ?? "",
        path,
    };
};
export const searchMenuOptionSort = (a: SelectOption, b: SelectOption) => {
    if (a.value == "/" || b.value == "/")
        return a.value == "/" ? -1 : 1;

    if (a.section == "folders" && b.section == "folders") {
        const aFolder = folderSortParts(a.value);
        const bFolder = folderSortParts(b.value);
        if (aFolder.depth != bFolder.depth)
            return aFolder.depth - bFolder.depth;
        const parentSort = aFolder.parent.localeCompare(bFolder.parent, undefined, { numeric: true, sensitivity: "base" });
        if (parentSort != 0)
            return parentSort;
        const nameSort = aFolder.name.localeCompare(bFolder.name, undefined, { numeric: true, sensitivity: "base" });
        return nameSort != 0 ? nameSort : aFolder.path.localeCompare(bFolder.path, undefined, { numeric: true, sensitivity: "base" });
    }

    const aSort = a.section == "folders" ? a.value : a.name;
    const bSort = b.section == "folders" ? b.value : b.name;
    return aSort.localeCompare(bSort, undefined, { numeric: true, sensitivity: "base" });
};

const pathStickerForSearch = (superstate: Superstate, path: string) => {
    const pathState = (superstate as any).pathStateForPath?.(path) ?? superstate.pathsIndex.get(path);
    return pathState?.effectiveLabel?.sticker ?? pathState?.label?.sticker;
};

const spacesForSearch = (superstate: Superstate, ordered: boolean, hidden?: boolean, includeUnindexedFolders?: boolean) => {
    const spaces = [...superstate.allSpaces(ordered, hidden)];
    if (!hidden || !includeUnindexedFolders) return spaces;

    const indexedPaths = new Set(spaces.map((space) => space.path));
    const adapterSpaces: SpaceInfo[] = (superstate.spaceManager as any)?.allSpaces?.(true) ?? [];
    const missingFolderSpaces = adapterSpaces
        .filter((space) => !indexedPaths.has(space.path))
        .map((space) => ({
            name: space.name,
            path: space.path,
            type: space.path == "/" ? "vault" : "folder",
            metadata: {},
            space,
        }));

    return [...spaces, ...missingFolderSpaces];
};

const isHiddenForSearch = (superstate: Superstate, path: string) => {
    const pathState = (superstate as any).pathStateForPath?.(path) ?? superstate.pathsIndex.get(path);
    return pathState?.hidden == true || excludePathPredicate(superstate.settings, path);
};

const searchMenuOptions = (superstate: Superstate, tabs: SearchMenuTab[], visibleTagPaths: Set<string>, hidden?: boolean, includeUnindexedFolders?: boolean): SelectOption[] => {
    const suggestions: SelectOption[] = [];

    if (tabs.includes('files'))
        suggestions.push(...
            [...superstate.pathsIndex.values()]
            .filter((f) => f.type == "file" && (hidden || !isHiddenForSearch(superstate, f.path)))
            .map<SelectOption>((f) => ({
                section: 'files',
                icon: f.effectiveLabel?.sticker ?? f.label?.sticker,
                name: f.name,
                description: f.path.replace(/[^\/]+$/, ""),
                value: f.path,
            }))
        )

    if (tabs.includes('folders') || tabs.includes('tags')) {
        const spaces = spacesForSearch(superstate, true, hidden, includeUnindexedFolders)
            .filter((s) => hidden || !isHiddenForSearch(superstate, s.path));

        if (tabs.includes('folders'))
            suggestions.push(...spaces
                .filter((s) => s.type == 'vault')
                .map<SelectOption>((s) => ({
                    section: '',
                    icon: pathStickerForSearch(superstate, s.path),
                    name: s.name,
                    description: '',
                    value: s.path,
                }))
            )
            suggestions.push(...spaces
                .filter((s) => s.type == 'folder')
                .map<SelectOption>((s) => ({
                    section: 'folders',
                    icon: pathStickerForSearch(superstate, s.path),
                    name: s.name,
                    description: s.path.replace(/[^\/]+$/, ""),
                    value: s.path,
                }))
            )

        if (tabs.includes('tags'))
            suggestions.push(...spaces
                .filter((s) => s.type == 'tag' && visibleTagPaths.has(s.path))
                .map<SelectOption>((s) => ({
                    section: 'tags',
                    icon: 'lucide//hash',
                    name: s.name,
                    description: '',
                    value: s.path,
                }))
            )
    }

    return suggestions.slice().sort(searchMenuOptionSort);
};

export const showSearchMenu = async ({
    offset,
    win,
    superstate,
    tabs,
    placeholder,
    saveOptions,
    selectProps,
    hidden,
    includeUnindexedFolders,
}: {
    offset: Rect;
    win: Window;
    superstate: Superstate;
    tabs: SearchMenuTab[];
    placeholder?: string;
    saveOptions: SelectMenuProps["saveOptions"];
    selectProps?: Partial<SelectMenuProps>;
    hidden?: boolean;
    includeUnindexedFolders?: boolean;
}) => {
    offset; // offset var is not used

    const visibleTagPaths = tabs.includes('tags') ? await syncTagSpacesFromObsidian(superstate) : null;
    const tabsDesc = getSearchMenuTabs(superstate.settings, tabs)
    const tagPaths = visibleTagPaths ?? new Set<string>();
    const optionsForHiddenState = (showHidden?: boolean) => searchMenuOptions(superstate, tabs, tagPaths, showHidden, includeUnindexedFolders);

    superstate.ui.openMenu(
        null, // modal opens in the center of the screen
        {
            ui: superstate.ui,
            multi: false,
            value: [],
            options: optionsForHiddenState(hidden),
            getOptionsForModifiers: ({ shiftKey }) => optionsForHiddenState(shiftKey),
            saveOptions,
            placeholder,
            wrapperClass: "mk-search-menu",
            centered: true,
            detail: true,
            searchable: true,
            showAll: true,
            sections: tabsDesc.map(d => ({name: d.id, value: d.id} as SelectSection)),
            optionLimitsBySection: Object.fromEntries(tabsDesc.map(d => [d.id,  d.limit])),
            allowNewBySection: Object.fromEntries(tabsDesc.filter(d => d.allowCreation).map(d => [d.id,  true]) ),
            showSections: true,
            editable: false,
            ...selectProps,
        },
        win,
        "bottom",
    );
}
