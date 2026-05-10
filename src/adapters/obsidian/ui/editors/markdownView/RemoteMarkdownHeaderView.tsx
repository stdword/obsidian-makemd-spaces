import { BannerView } from "core/react/components/MarkdownEditor/BannerView";
import { PathProvider } from "core/react/context/PathContext";
import { Superstate } from "makemd-core";
import React, { useMemo } from "react";
import { PathState } from "shared/types/PathState";
import { pathNameToString } from "utils/path";

export const RemoteMarkdownHeaderView = (props: {
  superstate: Superstate;
  name: string;
  fm: any;
}) => {
  const { name, fm } = props;

  const pathState: PathState = useMemo(
    () => ({
      name,
      path: name,
      readOnly: true,
      type: "note",
      label: {
        sticker: fm.sticker,
        color: fm.color,
        name,
      },
      metadata: {
        property: {
          banner: fm.banner,
        },
      },
    }),
    [fm, name]
  );

  return (
    <PathProvider
      superstate={props.superstate}
      path={props.name}
      pathState={pathState}
      readMode={true}
    >
      {pathState.metadata.property.banner &&
        props.superstate.settings.banners && (
          <BannerView superstate={props.superstate}></BannerView>
        )}
      <div className="mk-path-context-component">
        <div className="mk-path-context-label">
          {fm.sticker && (
            <div className="mk-header-icon">
              <div className="mk-path-icon">
                <div
                  dangerouslySetInnerHTML={{
                    __html: props.superstate.ui.getSticker(fm.sticker),
                  }}
                ></div>
              </div>
            </div>
          )}
          <div className="mk-inline-title inline-title">
            {pathNameToString(name)}
          </div>
        </div>
      </div>
    </PathProvider>
  );
};
