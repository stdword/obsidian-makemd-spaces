import classNames from "classnames";

import { NavigatorContext } from "core/react/context/SidebarContext";
import { Superstate } from "makemd-core";
import React, { useContext, useRef } from "react";
import { default as t } from "shared/i18n";
import { BlinkMode } from "shared/types/blink";
import { windowFromDocument } from "shared/utils/dom";
import { defaultAddAction } from "../UI/Menus/navigator/showSpaceAddMenu";
interface MainMenuComponentProps {
  superstate: Superstate;
}
export const MainMenu = (props: MainMenuComponentProps) => {
  const { superstate } = props;
  const { setActivePath, setDragPaths } = useContext(NavigatorContext);

  const ref = useRef<HTMLDivElement>();
  return (
    <div className="mk-main-menu-container">
      <div className="mk-main-menu-inner">
        <div className={classNames("mk-main-menu")}>
          <div
            aria-label={props.superstate.settings.systemName}
            className={`mk-main-menu-button mk-main-menu-button-primary`}
            ref={ref}
            onClick={(e) => {
              props.superstate.ui.mainMenu(ref.current, superstate);
            }}
          >
            <span>{props.superstate.settings.systemName}</span>
            <div
              className="mk-icon-xsmall"
              dangerouslySetInnerHTML={{
                __html: props.superstate.ui.getSticker("ui//chevrons-up-down"),
              }}
            ></div>
          </div>
          {/* Navigator MVP hides the remaining main menu button controls. */}
          {/* {props.superstate.settings.blinkEnabled && (
            <div
              className="mk-main-menu-button"
              onClick={(e) => props.superstate.ui.quickOpen(BlinkMode.Blink)}
            >
              <div
                className="mk-icon-small"
                dangerouslySetInnerHTML={{
                  __html: props.superstate.ui.getSticker("ui//search"),
                }}
              ></div>
            </div>
          )} */}
        </div>

        {/* Navigator MVP hides the New Note main menu button. */}
        {/* <button
          aria-label={t.buttons.newNote}
          className="mk-main-menu-button"
          onClick={(e) =>
            defaultAddAction(
              superstate,
              null,
              windowFromDocument(e.view.document),
              e.metaKey ? "tab" : false
            )
          }
        >
          <div
            className="mk-icon-small"
            dangerouslySetInnerHTML={{
              __html: props.superstate.ui.getSticker("ui//new-note"),
            }}
          ></div>
        </button> */}
      </div>
    </div>
  );
};
