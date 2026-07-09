import { SelectMenuProps, SelectOption, SelectOptionType } from "makemd-core";
import { IUIManager } from "shared/types/uiManager";


export const menuSeparator: SelectOption = {
    name: "",
    type: SelectOptionType.Separator,
    disabled: true,
};

export const defaultMenu = (ui: IUIManager, options: SelectOption[]): SelectMenuProps => ({
    ui,
    multi: false,
    value: [],
    editable: false,
    options,
    searchable: false,
    showAll: true,
});
