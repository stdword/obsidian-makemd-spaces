import React from "react";
import { IUIManager } from "shared/types/uiManager";

export const Sticker = (props: { ui: IUIManager; sticker: string }) => {
  return (
    <div
      className="mk-sticker"
      dangerouslySetInnerHTML={{
        __html: props.ui.getSticker(props.sticker),
      }}
    ></div>
  );
};
