import { createSpace, defaultSpace, newPathInSpace, linkPathToSpaceAtIndex as linkPathToSpaceAtIndex } from "core/utils/superstate/spaces";
import { addTag } from "core/utils/superstate/tags";
import { isString } from "lodash";
import { SelectOption, Superstate } from "makemd-core";
import React from "react";
import { default as i18n } from "shared/i18n";
import { DEFAULT_NEW_NOTE_NAME } from "schemas/constants";
import { tagsSpacePath } from "schemas/builtin";
import { TargetLocation } from "shared/types/path";
import { SpaceState, FilesystemSpaceInfo } from "shared/types/PathState";
import { Rect } from "shared/types/Pos";
import { windowFromDocument } from "utils/dom";
import { InputModal } from "../../Modals/InputModal";
import { defaultMenu, menuSeparator } from "../menu/SelectionMenu";
import { showLinkMenu } from "../modals/linkMenu";

export const defaultAddAction = async (superstate: Superstate, _space: SpaceState, win: Window, location?: TargetLocation) => {
    let space = _space;
    if (space?.path == tagsSpacePath) {
        superstate.ui.openModal("New Tag", <InputModal value="" saveLabel={i18n.labels.saveView} saveValue={(value) => addTag(superstate, value)}></InputModal>, win);
        return;
    }
    if (!space || space.type == "tag") {
        space = await defaultSpace(superstate, superstate.pathsIndex.get(superstate.ui.activePath));
    }
    newPathInSpace(superstate, space, "md", null, false, null, location);
};

export const showSpaceAddMenu = (superstate: Superstate, offset: Rect, win: Window, space: SpaceState, dontOpen?: boolean, _isSubmenu?: boolean, onHide?: () => void) => {
    const menuOptions: SelectOption[] = [];

    menuOptions.push({
        name: i18n.labels.createNote,
        icon: "ui//file-text",
        onClick: () => {
            newPathInSpace(superstate, space, "md", DEFAULT_NEW_NOTE_NAME, dontOpen);
        },
    });
    menuOptions.push({
        name: i18n.buttons.createCanvas,
        icon: "ui//layout-dashboard",
        onClick: () => {
            newPathInSpace(superstate, space, "canvas", null, dontOpen);
        },
    });
    if (superstate.ui.isPluginEnabled("obsidian-excalidraw-plugin")) {
        menuOptions.push({
            name: i18n.buttons.createDrawing,
            icon: "ui//excalidraw",
            onClick: () => {
                superstate.ui.createExcalidrawDrawing((space.space as FilesystemSpaceInfo)?.folderPath);
            },
        });
    }
    menuOptions.push({
        name: i18n.buttons.createBase,
        icon: "ui//table",
        onClick: () => {
            newPathInSpace(superstate, space, "base", null, dontOpen);
        },
    });

    if (space.type == "folder") {
        menuOptions.push(menuSeparator);

        menuOptions.push({
            name: i18n.labels.createFolder,
            icon: "ui//folder",
            onClick: (e) => {
                let pathState = superstate.pathsIndex.get(space?.path);
                if (!pathState) {
                    pathState = superstate.pathsIndex.get("/");
                }
                const parentPath = pathState?.subtype == "folder" ? pathState.path : pathState.parent ? pathState.parent : "/";
                const pathForName = (value: string) => {
                    const newName = value.replace(/\//g, "").trim();
                    const newPath = !parentPath || parentPath == "/" ? newName : parentPath + "/" + newName;
                    return { newName, newPath };
                };

                superstate.ui.openModal(
                    i18n.labels.createFolder,
                    <InputModal
                        saveLabel={i18n.buttons.createFolder}
                        value={""}
                        saveValue={(v) => {
                            const { newPath } = pathForName(v);
                            createSpace(superstate, newPath, {});
                        }}
                        validateValue={(v) => {
                            const { newName, newPath } = pathForName(v);
                            if (newName.length == 0) return i18n.notice.emptyfolderName;
                            if (superstate.spacesIndex.has(newPath)) return i18n.notice.duplicateFolderName;
                        }}
                    ></InputModal>,
                    windowFromDocument(e.view.document),
                );
            },
        });

        menuOptions.push({
            name: i18n.buttons.addIntoSpace,
            icon: "ui//link",
            onClick: (e) => {
                const offset = (e.target as HTMLButtonElement).getBoundingClientRect();
                showLinkMenu(offset, windowFromDocument(e.view.document), superstate, (link) => {
                    if (isString(link))
                        linkPathToSpaceAtIndex(superstate, space, link);
                }, e.shiftKey);
                e.stopPropagation();
            },
        });
    }

    return superstate.ui.openMenu(offset, defaultMenu(superstate.ui, menuOptions), win, "right", onHide);
};
