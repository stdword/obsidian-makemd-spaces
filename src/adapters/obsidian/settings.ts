import { App, PluginSettingTab, Setting } from "obsidian";
import t from "shared/i18n";
import MakeMDPlugin from "../../main";
import { MakeMDSettings } from "../../shared/types/settings";

type SettingObject = {
    name: keyof MakeMDSettings;
    category: string;
    subCategory?: string;
    type: string;
    props?: {
        control?: string;
        options?: { name: string; value: string }[];
        limits?: [number, number, number];
    };
    onChange?: (value: any) => void;
    dep?: string;
};

export class MakeMDPluginSettingsTab extends PluginSettingTab {
    plugin: MakeMDPlugin;

    constructor(app: App, plugin: MakeMDPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    refreshObsidian() {
        this.app.commands.executeCommandById("app:reload");
    }

    refreshView() {
        this.display();
    }

    display(): void {
        const { containerEl } = this;

        const settings: {
            categories: string[];
            subCategories: Record<string, string[]>;
            settings: SettingObject[];
        } = {
            categories: ["navigator", "performance", "advanced"],
            subCategories: {
                navigator: ["appearance", "interaction", "advanced"],
                performance: [],
                advanced: [],
            },
            settings: [
                {
                    name: "openSpacesOnLaunch",
                    category: "navigator",
                    subCategory: "interaction",
                    type: "boolean",
                },
                {
                    name: "editStickerInSidebar",
                    category: "navigator",
                    subCategory: "interaction",
                    type: "boolean",
                },
                {
                    name: "overrideNativeMenu",
                    category: "navigator",
                    subCategory: "interaction",
                    type: "boolean",
                },
                {
                    name: "spaceRowHeight",
                    category: "navigator",
                    subCategory: "appearance",
                    type: "number",
                    props: {
                        control: "slider",
                        limits: [20, 40, 1],
                    },
                },
                {
                    name: "folderIndentationLines",
                    category: "navigator",
                    subCategory: "appearance",
                    type: "boolean",
                    onChange: (value: boolean) => {
                        document.body.classList.toggle("mk-folder-lines", value);
                    },
                },
                {
                    name: "expandFolderOnClick",
                    category: "navigator",
                    subCategory: "interaction",
                    type: "boolean",
                },
                {
                    name: "filePreviewOnHover",
                    category: "navigator",
                    subCategory: "interaction",
                    type: "boolean",
                },
                {
                    name: "revealActiveFile",
                    category: "navigator",
                    subCategory: "interaction",
                    type: "boolean",
                },
                {
                    name: "deleteFileOption",
                    category: "navigator",
                    subCategory: "interaction",
                    type: "options",
                    props: {
                        options: [
                            { name: t.settings.spacesDeleteOptions.permanent, value: "permanent" },
                            { name: t.settings.spacesDeleteOptions.trash, value: "trash" },
                            { name: t.settings.spacesDeleteOptions["system-trash"], value: "system-trash" },
                        ],
                    },
                },

                {
                    name: "cacheIndex",
                    category: "performance",
                    type: "boolean",
                },
            ],
        };

        containerEl.innerHTML = "";
        const sectionKeys = t.settings.sections as unknown as Record<string, string>;
        const insertSetting = (containerEl: HTMLElement, setting: SettingObject) => {
            const localizationKeys = t.settings as unknown as Record<
                keyof MakeMDSettings,
                {
                    name: string;
                    desc: string;
                }
            >;

            const newSetting = new Setting(containerEl).setName(localizationKeys[setting.name].name).setDesc(localizationKeys[setting.name].desc);
            if (setting.type === "boolean") {
                newSetting.addToggle((toggle) =>
                    toggle.setValue(this.plugin.superstate.settings[setting.name] as boolean).onChange((value: boolean) => {
                        Object.assign(this.plugin.superstate.settings, { [setting.name]: value });
                        this.plugin.saveSettings();
                        if (setting.onChange) setting.onChange(value);
                    }),
                );
            }

            if (setting.type == "number") {
                if (setting.props?.control === "slider") {
                    newSetting.addSlider((slider) =>
                        slider
                            .setValue(this.plugin.superstate.settings[setting.name] as number)
                            .setDynamicTooltip()

                            .setLimits(setting.props.limits[0], setting.props.limits[1], setting.props.limits[2])
                            .onChange((value: number) => {
                                Object.assign(this.plugin.superstate.settings, { [setting.name]: value });
                                this.plugin.saveSettings();
                                if (setting.onChange) setting.onChange(value);
                            }),
                    );
                } else {
                    newSetting.addText((text) =>
                        text.setValue(this.plugin.superstate.settings[setting.name].toString()).onChange((value: string) => {
                            Object.assign(this.plugin.superstate.settings, { [setting.name]: parseInt(value) });
                            this.plugin.saveSettings();
                            if (setting.onChange) setting.onChange(parseInt(value));
                        }),
                    );
                }
            }
            if (setting.type == "text") {
                newSetting.addText((text) =>
                    text.setValue(this.plugin.superstate.settings[setting.name] as string).onChange((value: string) => {
                        Object.assign(this.plugin.superstate.settings, { [setting.name]: value });
                        this.plugin.saveSettings();
                        if (setting.onChange) setting.onChange(value);
                    }),
                );
            }
            if (setting.type == "options") {
                newSetting.addDropdown((dropdown) => {
                    setting.props.options?.forEach((option) => {
                        dropdown.addOption(option.value, option.name);
                    });
                    dropdown.setValue(this.plugin.superstate.settings[setting.name] as string);
                    dropdown.onChange((value: string) => {
                        Object.assign(this.plugin.superstate.settings, { [setting.name]: value });
                        this.plugin.saveSettings();
                        if (setting.onChange) setting.onChange(value);
                    });
                });
            }
        };

        settings.categories.forEach((category) => {
            containerEl.createEl("h1", { text: sectionKeys[category] });
            settings.settings.forEach((setting) => {
                if (setting.category === category && !setting.subCategory) {
                    insertSetting(containerEl, setting);
                }
            });
            settings.subCategories[category].forEach((subCategory) => {
                const subCategoryItems = settings.settings.filter((setting) => setting.category === category && setting.subCategory === subCategory);
                if (subCategoryItems.length > 0) {
                    containerEl.createEl("h2", { text: sectionKeys[subCategory] });
                }
                subCategoryItems.forEach((setting) => {
                    insertSetting(containerEl, setting);
                });
            });
        });
    }
}
