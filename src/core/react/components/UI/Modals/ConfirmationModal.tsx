import React, { useEffect } from "react";
import i18n from "shared/i18n";

export const ConfirmationModal = (props: {
  hide?: () => void;
  confirmAction: () => void;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
}) => {
    const { hide, confirmAction, message, confirmLabel, cancelLabel } = props;
    const confirm = () => {
        confirmAction();
        hide();
    };
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                confirm();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);
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
