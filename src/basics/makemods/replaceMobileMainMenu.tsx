import classNames from "classnames";

import { Platform } from "obsidian";
import React, { useRef } from "react";
import { uiIconSet } from "shared/assets/icons";
import { DEFAULT_SYSTEM_NAME } from "shared/constants";
import i18n from "shared/i18n";

import { BlinkMode } from "shared/types/blink";
import { ISuperstate } from "shared/types/superstate";
import { windowFromDocument } from "shared/utils/dom";
import MakeBasicsPlugin from "../basics";

export const replaceMobileMainMenu = (
  plugin: MakeBasicsPlugin,
  superstate: ISuperstate
) => {
  if (plugin.isTouchScreen()) {
    const header = plugin.app.workspace.containerEl.querySelector(
      superstate.settings.spacesRightSplit
        ? ".workspace-drawer.mod-right .workspace-drawer-header-left"
        : ".workspace-drawer.mod-left .workspace-drawer-header-left"
    );
    header.innerHTML = "";
    const reactEl = plugin.enactor.createRoot(header);
    reactEl.render(
      <ObsidianMobileMainMenu
        superstate={superstate}
        plugin={plugin}
      ></ObsidianMobileMainMenu>
    );
  }
};

export const ObsidianMobileMainMenu = (props: {
  superstate: ISuperstate;
  plugin: MakeBasicsPlugin;
}) => {
  const ref = useRef<HTMLDivElement>();
  return (
    <div className="mk-main-menu-container">
      <div className="mk-main-menu-inner">
        <div className={classNames("mk-main-menu")}>
          <div
            className={`mk-main-menu-button mk-main-menu-button-primary`}
            ref={ref}
            onClick={(e) => {
              props.superstate.ui.mainMenu(ref.current, props.superstate);
            }}
          >
            {DEFAULT_SYSTEM_NAME}
            <div
              className="mk-icon-xsmall"
              dangerouslySetInnerHTML={{
                __html: uiIconSet["chevrons-up-down"],
              }}
            ></div>
          </div>

          <div
            className="mk-main-menu-button"
            onClick={(e) => props.superstate.ui.quickOpen(BlinkMode.Blink)}
          >
            <div
              className="mk-icon-small"
              dangerouslySetInnerHTML={{
                __html: uiIconSet["search"],
              }}
            ></div>
          </div>
        </div>

        <button
          aria-label={i18n.buttons.newNote}
          className="mk-main-menu-button"
          onClick={(e) =>
            props.superstate.ui.defaultAdd(
              null,
              windowFromDocument(e.view.document),
              e.metaKey ? "tab" : false
            )
          }
        >
          <div
            className="mk-icon-small"
            dangerouslySetInnerHTML={{
              __html: uiIconSet["new-note"],
            }}
          ></div>
        </button>
        {Platform.isTablet && (
          <div
            aria-label={i18n.buttons.togglePin}
            className="mk-main-menu-button"
            onClick={(e) =>
              props.superstate.settings.spacesRightSplit
                ? props.plugin.app.workspace.rightSplit.togglePinned()
                : props.plugin.app.workspace.leftSplit.togglePinned()
            }
          >
            <div
              className="mk-icon-small"
              dangerouslySetInnerHTML={{
                __html: uiIconSet["pin"],
              }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
};
