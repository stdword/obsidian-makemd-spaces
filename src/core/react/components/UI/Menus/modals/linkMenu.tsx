import { Superstate } from "makemd-core";
import i18n from "shared/i18n";
import { Rect } from "shared/types/Pos";
import { SearchMenuTab, showSearchMenu } from "./searchMenu";


export const showLinkMenu = (
    offset: Rect,
    win: Window,
    superstate: Superstate,
    saveLink: (link: string | string[]) => void,
) => {
    const tabs: SearchMenuTab[] = [ 'tags', 'folders', 'files' ];

    return showSearchMenu({
        offset,
        win,
        superstate,
        tabs,
        placeholder: i18n.labels.linkItemInputPlaceholder,
        saveOptions: (_: string[], value: string[]) => {
            saveLink(value);
        },
    });
};
