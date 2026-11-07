import { Sticker } from "core/react/components/UI/Stickers/Sticker";
import { PointerModifiers } from "schemas/ui";
import { SelectOption, SelectOptionType } from "makemd-core";
import i18n from "shared/i18n";
import React, { useEffect, useRef, useState } from "react";
import { MenuObject } from "shared/types/menu";
import { Rect } from "shared/types/Pos";
import { IUIManager } from "shared/types/uiManager";
import { matchAny } from "./concerns/matchers";
import { escapeHtml } from "utils/html";
import { verticalDeltaForShiftWheel } from "./selectMenuLimits";
import { activateMenuOption, canFocusOption } from "./selectMenuKeyboard";
// Returns HTML-safe markup: the text is escaped and only the <mark> tags are added.
export function markIt(name: string, query: string) {
    const text = name ?? "";
    if (!query?.length) return escapeHtml(text);
    const regexp = matchAny(query);
    let html = "";
    let last = 0;
    for (const match of text.matchAll(regexp)) {
        if (match[0].length == 0) continue;
        html += `${escapeHtml(text.slice(last, match.index))}<mark>${escapeHtml(match[0])}</mark>`;
        last = match.index + match[0].length;
    }
    return html + escapeHtml(text.slice(last));
}

const SelectMenuSuggestionsComponent = (props: { ui: IUIManager; item: SelectOption; query: string; active: boolean; onDeleteOption?: (value: string) => void }) => {
    const ref = useRef(null);

    useEffect(() => {
        if (props.active) {
            ref?.current?.scrollIntoViewIfNeeded();
        }
    }, [props.active]);

    return (
        <>
            {props.item.icon && <Sticker ui={props.ui} sticker={props.item.icon}></Sticker>}
            <div ref={ref} className="mk-menu-options-inner">
                {props.item.onToggle && <div>{i18n.menu.toggle}</div>}
                <span
                    style={
                        props.item.color?.length > 0
                            ? {
                                  background: props.item.color,
                                  padding: "2px 4px",
                                  borderRadius: "4px",
                                  color: props.item.color == "var(--mk-color-none)" ? "inherit" : "var(--mk-color-white)",
                              }
                            : {}
                    }
                    dangerouslySetInnerHTML={{
                        __html: markIt(props.item.name, props.query),
                    }}
                />
                {props.item.description && (
                    <span
                        aria-label={props.item.description}
                        className="mk-menu-options-description"
                        dangerouslySetInnerHTML={{
                            __html: markIt(props.item.description, props.query),
                        }}
                    />
                )}
            </div>
            {props.item.type == SelectOptionType.Disclosure && <span>{props.item.value}</span>}
            {props.item.type == SelectOptionType.Radio && props.item.value && (
                <div
                    className="mk-icon-small"
                    dangerouslySetInnerHTML={{
                        __html: props.ui.getSticker("ui//check"),
                    }}
                ></div>
            )}
            {props.item.onMoreOptions ? (
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        props.item.onMoreOptions(e);
                    }}
                    className="mk-icon-small"
                    dangerouslySetInnerHTML={{
                        __html: props.ui.getSticker("ui//options"),
                    }}
                ></div>
            ) : null}
            {props.item.onRemove && (
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        props.item.onRemove();
                        props.onDeleteOption?.(props.item.value);
                    }}
                    className="mk-icon-small"
                    dangerouslySetInnerHTML={{
                        __html: props.ui.getSticker("ui//close"),
                    }}
                ></div>
            )}
            {(props.item.type == SelectOptionType.Submenu || props.item.showChevron) && (
                <div
                    className="mk-icon-small"
                    dangerouslySetInnerHTML={{
                        __html: props.ui.getSticker("ui//chevron-right"),
                    }}
                ></div>
            )}
        </>
    );
};

const SelectMenuInput = (props: { value: string; setValue: (value: string) => void; placeholder: string }) => {
    const [value, setValue] = useState(props.value);
    return (
        <input
            type="text"
            value={value}
            onKeyDown={(e) => {
                if (e.key == "Enter") {
                    props.setValue(value);
                }
            }}
            placeholder={props.placeholder}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => {
                e.stopPropagation();
            }}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => props.setValue(value)}
        ></input>
    );
};

const SelectMenuSuggestions = (props: {
    expanded: boolean;

    options: SelectOption[];
    query: string;
    addKeyword: string;
    refs: React.MutableRefObject<HTMLDivElement[]>;
    hide: (suppress?: boolean, immediate?: boolean) => void;
    onHide: () => void;
    selectOption: (item: SelectOption, modifiers: PointerModifiers) => void;
    moreOption?: (e: React.MouseEvent, option: string) => void;
    deleteOption?: (option: string) => void;
    id: string;
    classNames: Record<string, string>;
    index: number;
    setIndex: (index: number) => void;
    allowNew: boolean;
    ui: IUIManager;
    isDisclosureMenu: boolean;
    openSubmenu?: (menu: MenuObject) => void;
}) => {
    const scrollShiftWheelVertically = (e: React.WheelEvent<HTMLDivElement>) => {
        if (!e.shiftKey) return;
        e.preventDefault();
        e.currentTarget.scrollTop += verticalDeltaForShiftWheel(e.deltaY, e.deltaX);
    };

    const options = props.options.map((item, index) => {
        const key = `${props.id}-${index}`;
        const className =
            item.type == SelectOptionType.Separator
                ? "mk-menu-separator"
                : item.type == SelectOptionType.Input
                  ? "mk-menu-input"
                  : item.type == SelectOptionType.Custom
                    ? "mk-menu-custom"
                    : `mk-menu-option ${props.index === index ? props.classNames.suggestionActive : ""} ${item.disabled ? props.classNames.suggestionDisabled : ""}`.trimRight();
        return (
            <div
                ref={(ref) => {
                    if (props.refs?.current) props.refs.current[index] = ref;
                }}
                onMouseDown={(e) => {
                    if (!props.isDisclosureMenu) e.stopPropagation();
                    e.preventDefault();
                }}
                onMouseEnter={() => {
                    if (canFocusOption(item)) {
                        props.setIndex(index);
                    }
                }}
                onClick={(e) => {
                    const anchor = props.refs?.current[index]?.getBoundingClientRect() ?? { x: 0, y: 0, width: 0, height: 0 };
                    activateMenuOption(item, anchor, e, {
                        openSubmenu: props.openSubmenu,
                        hide: props.hide,
                        onHide: props.onHide,
                        selectOption: props.selectOption,
                        isDisclosureMenu: props.isDisclosureMenu,
                    });
                    if (!item.onSubmenu && !item.onClick && !props.isDisclosureMenu) e.stopPropagation();
                }}
                id={key}
                key={key}
                className={className}
            >
                {item.type == SelectOptionType.Separator ? (
                    <></>
                ) : item.type == SelectOptionType.Section ? (
                    <div className="mk-menu-options-section">{item.name}</div>
                ) : item.type == SelectOptionType.Input ? (
                    <SelectMenuInput value={item.value} setValue={item.onValueChange} placeholder={item.description}></SelectMenuInput>
                ) : item.type == SelectOptionType.Custom ? (
                    <item.fragment
                        hide={props.hide}
                        onSubmenu={(openSubmenu: (offset: Rect, onHide: () => void) => MenuObject) => {
                            if (props.openSubmenu) {
                                const el = props.refs?.current[index].getBoundingClientRect();
                                props.openSubmenu(
                                    openSubmenu(el, () => {
                                        if (props.onHide) {
                                            props.onHide();
                                        }
                                        props.hide();
                                    }),
                                );
                            }
                        }}
                    />
                ) : (
                    <SelectMenuSuggestionsComponent ui={props.ui} item={item} query={props.query} active={index == props.index} onDeleteOption={props.deleteOption} />
                )}
            </div>
        );
    });

    return (
        <div className="mk-menu-suggestions" onWheel={scrollShiftWheelVertically}>
            {options}

            {props.query && props.allowNew && (
                <div
                    className="mk-menu-option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) =>
                        props.selectOption(
                            { name: props.query, value: props.query },
                            {
                                ctrlKey: e.ctrlKey,
                                metaKey: e.metaKey,
                                altKey: e.altKey,
                                shiftKey: e.shiftKey,
                            },
                        )
                    }
                >
                    <div
                        className="mk-sticker"
                        dangerouslySetInnerHTML={{
                            __html: props.ui.getSticker("ui//plus"),
                        }}
                    ></div>
                    <div className="mk-menu-options-inner">
                        {props.addKeyword ?? "Add"} {props.query}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SelectMenuSuggestions;
