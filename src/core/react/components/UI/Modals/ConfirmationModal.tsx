import React, { useEffect } from "react";
import i18n from "shared/i18n";
import { IUIManager } from "shared/types/uiManager";

// Enter confirms only when the event reaches this modal through the shared inputManager:
// menus opened on top register later and swallow the key first, and the listener never
// fires for a different window the way a global window handler would.
export const isConfirmKey = (event: Pick<KeyboardEvent, "key" | "isComposing">): boolean => event.key === "Enter" && !event.isComposing;

export const formatMessage = (template: string, values: React.ReactNode[]) => <>
    {template.split(/(\$\{\d+\})/g).map((part, index) => {
        const match = part.match(/^\$\{(\d+)\}$/);
        return <React.Fragment key={index}>{match ? values[Number(match[1]) - 1] : part}</React.Fragment>;
    })}
</>;

export const ConfirmationModal = (props: {
  ui?: IUIManager;
  hide?: () => void;
  confirmAction: () => void;
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
}) => {
    const { hide, confirmAction, message, confirmLabel, cancelLabel } = props;
    const confirm = () => {
        confirmAction();
        hide();
    };
    useEffect(() => {
        const inputManager = props.ui?.inputManager;
        if (!inputManager) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isConfirmKey(event)) return false;
            event.preventDefault();
            confirm();
            return true;
        };
        inputManager.on("keydown", handleKeyDown);
        return () => {
            inputManager.off("keydown", handleKeyDown);
        };
    }, [props.ui]);
    return (
        <div className="mk-modal-contents">
            {message ? <div className="mk-modal-message">{message}</div> : null}
            <div className="mk-button-group">
                <button onClick={() => confirm()} tabIndex={0} className="mod-warning">
                    {confirmLabel}
                </button>
                <button onClick={() => hide && hide()} tabIndex={0}>
                    {cancelLabel ?? i18n.buttons.cancel}
                </button>
            </div>
        </div>
    );
};
