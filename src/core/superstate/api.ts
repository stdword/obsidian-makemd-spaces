import { showPathContextMenu } from "core/react/components/UI/Menus/navigator/pathContextMenu";
import { SpaceManager } from "makemd-core";
import { ISpaceManager } from "shared/types/spaceManager";
import { PathState } from "shared/types/superstate";
import { IAPI } from "shared/types/api";
import { SpaceProperty } from "shared/types/mdb";
import { TargetLocation } from "shared/types/path";
import { windowFromDocument } from "utils/dom";
import { ISuperstate } from "shared/types/superstate";
import { newPathInSpace, saveProperties } from "core/utils/superstate/spaces";

// Interface for the minimal space manager functionality needed by API
export interface APISpaceManager {
    getPathState(path: string): PathState | null;
    resolvePath(path: string, source?: string): string;
}

export class API implements IAPI {
    private superstate: ISuperstate;
    private spaceManager: SpaceManager | ISpaceManager | APISpaceManager; // Can be SpaceManager, SpaceManagerInterface or SpaceManagerContext

    public constructor(superstate: ISuperstate, spaceManager?: SpaceManager | ISpaceManager | APISpaceManager) {
        this.superstate = superstate;
        this.spaceManager = spaceManager || superstate.spaceManager;
    }
    public properties = {
        color: (property: SpaceProperty, value: string) => {
            if (property?.type?.includes("option")) {
                console.log('TRACE API properties.color parsing', {property, value})
                // const fields = parseFieldValue(property.value, property.type);
                // const option = (fields.options as SelectOption[])?.find((f) => f.value == value);
                // if (option?.color.length > 0) return option.color;
                return value
            }
            return "var(--mk-ui-background-contrast)";
        },
        sticker: (property: SpaceProperty) => {
            console.log('TRACE API properties.sticker parsing', {property})
            // return property && stickerForField(property)
            return property.toString()
        },
        value: (type: string, value: string) => {
            if (!type) return value;
            console.log('TRACE API properties.value parsing', {type, value})
            // return parseMDBStringValue(type, value, false);
            return value
        },
    };

    public path = {
        open: (path: string, target?: TargetLocation, source?: string) => {
            const resolvedPath = source ? this.spaceManager.resolvePath(path, source) : path;
            this.superstate.ui.openPath(resolvedPath, target);
        },
        create: (name: string, space: string, type: string, content?: Promise<string> | string) => {
            if (content instanceof Promise) {
                return content.then((c) => {
                    newPathInSpace(this.superstate, this.superstate.spacesIndex.get(space), type, name, true, c);
                });
            }
            return newPathInSpace(this.superstate, this.superstate.spacesIndex.get(space), type, name, true, content);
        },
        setProperty: (path: string, property: string, value: Promise<string> | string) => {
            if (value instanceof Promise) {
                value.then((v) => {
                    saveProperties(this.superstate, path, {
                        [property]: v,
                    });
                });
                return;
            }
            saveProperties(this.superstate, path, {
                [property]: value,
            });
        },
        contextMenu: (e: React.MouseEvent, path: string) => {
            showPathContextMenu(this.superstate, path, null, { x: e.clientX, y: e.clientY, width: 0, height: 0 }, windowFromDocument(e.view.document));
        },
    };
}
