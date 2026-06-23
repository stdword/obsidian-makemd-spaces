import { App, PluginSettingTab, Setting } from "obsidian";
import i18n from "shared/i18n";
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
            settings: SettingObject[];
        } = {
            categories: ["appearance", "system"],
            settings: [
                {
                    name: "openSpacesOnLaunch",
                    category: "system",
                    type: "boolean",
                },
                {
                    name: "overrideNativeMenu",
                    category: "system",
                    type: "boolean",
                },


                {
                    name: "spaceRowHeight",
                    category: "appearance",
                    type: "number",
                    props: {
                        control: "slider",
                        limits: [20, 40, 1],
                    },
                },
                {
                    name: "folderIndentationLines",
                    category: "appearance",
                    type: "boolean",
                    onChange: (value: boolean) => {
                        document.body.classList.toggle("mk-folder-lines", value);
                    },
                },


                {
                    name: "expandFolderOnClick",
                    category: "system",
                    type: "boolean",
                },
                {
                    name: "revealActiveFile",
                    category: "system",
                    type: "boolean",
                },
                {
                    name: "deleteFileOption",
                    category: "system",
                    type: "options",
                    props: {
                        options: [
                            { name: i18n.settings.spacesDeleteOptions.permanent, value: "permanent" },
                            { name: i18n.settings.spacesDeleteOptions.trash, value: "trash" },
                            { name: i18n.settings.spacesDeleteOptions["system-trash"], value: "system-trash" },
                        ],
                    },
                },
            ],
        };

        containerEl.innerHTML = "";
        const sectionKeys = i18n.settings.sections as unknown as Record<string, string>;
        const insertSetting = (containerEl: HTMLElement, setting: SettingObject) => {
            const localizationKeys = i18n.settings as unknown as Record<
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
            containerEl.createEl("h2", { text: sectionKeys[category] });
            settings.settings.forEach((setting) => {
                if (setting.category === category)
                    insertSetting(containerEl, setting);
            });
        });
    }
}
