import { SelectSection } from "shared/types/menu";
import { MakeMDSettings } from "shared/types/settings";
import i18n from "shared/i18n";

export type SearchMenuTab = "system" | "tags" | "folders" | "files" | "refs";
export type SearchMenuTabs = Partial<Record<SearchMenuTab, boolean>>;
export type SearchMenuNewOptions = Partial<Record<SearchMenuTab, boolean>>;

const searchMenuTabLabels: Record<SearchMenuTab, string> = {
    system: "system",
    tags: i18n.buttons.tag,
    folders: i18n.menu.folder,
    files: "files",
    refs: "refs",
};

export const searchMenuSections = (tabs: SearchMenuTabs, hiddenTabs: SearchMenuTabs = {}): SelectSection[] =>
    (["system", "folders", "files", "tags", "refs"] as SearchMenuTab[])
        .filter((tab) => tabs[tab] && !hiddenTabs[tab])
        .map((tab) => ({
            name: searchMenuTabLabels[tab],
            value: tab,
        }));

export const searchMenuLimits = (settings: MakeMDSettings, tabs: SearchMenuTabs) => ({
    ...(tabs.tags ? { tags: settings?.searchMenuTagsLimit } : {}),
    ...(tabs.folders ? { folders: settings?.searchMenuFoldersLimit } : {}),
    ...(tabs.files ? { files: settings?.searchMenuFilesLimit } : {}),
    ...(tabs.refs ? { refs: settings?.searchMenuRefsLimit } : {}),
});

export const searchMenuAllowNew = (allowNew: SearchMenuNewOptions) => ({
    ...(allowNew.tags ? { tags: true } : {}),
    ...(allowNew.folders ? { folders: true } : {}),
    ...(allowNew.files ? { files: true } : {}),
    ...(allowNew.refs ? { refs: true } : {}),
});
