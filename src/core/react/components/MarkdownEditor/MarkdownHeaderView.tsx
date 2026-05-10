import { EditorView } from "@codemirror/view";
import { PathContext } from "core/react/context/PathContext";
import { Superstate } from "makemd-core";
import React, { useContext, useLayoutEffect } from "react";
import { pathNameToString } from "utils/path";
import { BannerView } from "./BannerView";

export const MarkdownHeaderView = (props: {
  superstate: Superstate;
  hiddenFields?: string[];
  editable: boolean;
  editorView?: EditorView;
}) => {
  const { pathState } = useContext(PathContext);

  useLayoutEffect(() => {
    props.editorView?.requestMeasure();
  }, []);

  return (
    pathState && (
      <div className="mk-path-context-component">
        <div className="mk-path-context-label">
          {props.superstate.settings.banners && (
            <BannerView superstate={props.superstate}></BannerView>
          )}
          <div className="mk-inline-title inline-title">
            {pathNameToString(pathState.path)}
          </div>
        </div>
      </div>
    )
  );
};
