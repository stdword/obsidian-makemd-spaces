import { Superstate } from "makemd-core";
import i18n from "shared/i18n";
import { Rect } from "shared/types/Pos";
import { SearchMenuTab, showSearchMenu } from "./searchMenu";


export const showOpenMenu = (
    offset: Rect,
    win: Window,
    superstate: Superstate,
    saveLink: (link: string, isNew?: boolean, type?: string) => void,
    hidden?: boolean,
) => {
    const tabs: SearchMenuTab[] = [ 'tags', 'folders', 'files' ];

    return showSearchMenu({
        offset,
        win,
        superstate,
        tabs,
        placeholder: i18n.labels.openItemInputPlaceholder,
        saveOptions: (_: string[], value: string[], isNew?: boolean, section?: string) => {
            saveLink(value[0], isNew, section);
        },
        selectProps: {
            addKeyword: "Create",
            editable: true,
        },
        hidden,
    });
};


export const showFoldersMenu = (
    offset: Rect,
    win: Window,
    superstate: Superstate,
    saveLink: (link: string, isNew?: boolean, type?: string) => void,
    hidden?: boolean,
) => {
    const tabs: SearchMenuTab[] = [ 'folders' ];

    return showSearchMenu({
        offset,
        win,
        superstate,
        tabs,
        placeholder: i18n.labels.openItemInputPlaceholder,
        saveOptions: (_: string[], value: string[], isNew?: boolean, section?: string) => {
            saveLink(value[0], isNew, section);
        },
        selectProps: {
            showSections: false,
        },
        hidden,
        includeUnindexedFolders: true,
    });
};

export const showTagsMenu = (
    offset: Rect,
    win: Window,
    superstate: Superstate,
    saveLink: (link: string, isNew?: boolean, type?: string) => void,
) => {
    return showSearchMenu({
        offset,
        win,
        superstate,
        tabs: ["tags"],
        placeholder: i18n.labels.openItemInputPlaceholder,
        saveOptions: (_: string[], value: string[], isNew?: boolean, section?: string) => {
            saveLink(value[0], isNew, section);
        },
        selectProps: {
            addKeyword: "Create",
            editable: true,
            showSections: false,
        },
    });
};
