import MakeMDPlugin from "main";
import { around } from "monkey-around";
import { Workspace } from "obsidian";
import { FILE_TREE_VIEW_TYPE } from "../ui/navigator/NavigatorView";

export const patchFilesPlugin = (plugin: MakeMDPlugin) => {
    plugin.register(
        around(Workspace.prototype, {
            getLeavesOfType(old) {
                return function (type: unknown) {
                    if (type == "file-explorer") {
                        return old.call(this, FILE_TREE_VIEW_TYPE);
                    }
                    return old.call(this, type);
                };
            },
        }),
    );
};
