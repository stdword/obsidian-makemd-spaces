import { Superstate } from "makemd-core";
import React, { useEffect, useRef, useState } from "react";
import { default as i18n } from "shared/i18n";

export type SectionAction = "rename" | "create";
export type InputModalValidator = (value: string) => string | undefined;
export type InputModalProps = {
    value: string;
    saveValue: (value: string) => void;
    saveLabel: string;
    validateValue?: InputModalValidator;
    hide?: () => void;
};

export const validateInputModalValue = (value: string, validateValue?: InputModalValidator) => {
    if (!validateValue) return;
    return validateValue(value);
};

export const openInputModal = (
  superstate: Superstate,
  title: string,
  value: string,
  saveValue: (val: string) => void,
  saveLabel: string,
  win: Window,
  validateValue?: InputModalValidator
) => {
    superstate.ui.openModal(title, <InputModal value={value} saveValue={saveValue} saveLabel={saveLabel} validateValue={validateValue} />, win);
};

export const InputModal = (props: InputModalProps) => {
    const [value, setValue] = useState(props.value);
    const [error, setError] = useState<string>();
    const save = () => {
        const validationError = validateInputModalValue(value, props.validateValue);
        if (validationError) {
            setError(validationError);
            return;
        }
        props.saveValue(value);
        if (props.hide) props.hide();
    };
    const ref = useRef(null);
    useEffect(() => {
        if (ref?.current) {
            ref.current.focus();
        }
    }, [ref]);
    return (
        <div className="mk-layout-column mk-gap-8">
            <input
                ref={ref}
                value={value}
                type="text"
                onChange={(e) => {
                    setValue(e.target.value);
                    setError(undefined);
                }}
                className="mk-input mk-input-large"
                aria-invalid={!!error}
                style={{
                    width: "100%",
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter") save();
                }}
            ></input>
            {error && <div className="mk-field-error" role="alert">{error}</div>}
            <div className="mk-modal-actions">
                <button onClick={() => save()}>{props.saveLabel}</button>
                <button onClick={() => props.hide && props.hide()}>{i18n.buttons.cancel}</button>
            </div>
        </div>
    );
};
