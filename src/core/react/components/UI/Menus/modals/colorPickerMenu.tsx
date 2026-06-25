import { Anchors, Rect } from "shared/types/Pos";

import { Superstate } from "makemd-core";

import { debounce } from "lodash";
import i18n from "shared/i18n";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { getColorPalettes, hslToRgb, rgbToHsl, hexToRgb, rgbToHex } from "core/utils/colorPalette";

// Color mode types
type ColorMode = "palettes" | "solid" | "none";

// ColorSwatch component
const ColorSwatch: React.FC<{
    color: string;
    name?: string;
    size?: "small" | "medium" | "large";
    onClick?: () => void;
    className?: string;
}> = ({ color, name, size = "medium", onClick, className = "" }) => {
    const sizeClasses = {
        small: "mk-color-swatch-small",
        medium: "mk-color-swatch-medium",
        large: "mk-color-swatch-large",
    };

    const backgroundStyle = { backgroundColor: color };

    return (
        <div className={`mk-color-swatch ${sizeClasses[size]} ${className}`}>
            <div className="mk-color-swatch-inner" style={backgroundStyle} onClick={onClick} title={name ? `${name}: ${color}` : color}></div>
        </div>
    );
};

// HuePicker component
const HuePicker: React.FC<{
    hue: number;
    onChange: (hue: number) => void;
    width?: number;
    height?: number;
}> = ({ hue, onChange, width = 200, height = 20 }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const updateHue = (clientX: number) => {
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            const x = clientX - rect.left;
            const newHue = (x / rect.width) * 360;
            onChange(Math.max(0, Math.min(360, newHue)));
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        updateHue(e.clientX);
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            updateHue(e.clientX);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging]);

    return (
        <div style={{ position: "relative", width: `${width}px`, height: `${height}px` }}>
            <div
                ref={ref}
                style={{
                    width: "100%",
                    height: "100%",
                    background: "linear-gradient(to right, #ff0000 0%, #ffff00 16.66%, #00ff00 33.33%, #00ffff 50%, #0000ff 66.66%, #ff00ff 83.33%, #ff0000 100%)",
                    borderRadius: "4px",
                    cursor: "crosshair",
                }}
                onMouseDown={handleMouseDown}
            />
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: `${(hue / 360) * 100}%`,
                    transform: "translateX(-50%)",
                    width: "4px",
                    height: "100%",
                    backgroundColor: "white",
                    border: "1px solid #666666",
                    borderRadius: "2px",
                    pointerEvents: "none",
                }}
            />
        </div>
    );
};

// SaturationLightnessCanvas component
const SaturationLightnessCanvas: React.FC<{
    hue: number;
    saturation: number;
    lightness: number;
    onChange: (saturation: number, lightness: number) => void;
    size?: number;
}> = ({ hue, saturation, lightness, onChange, size = 200 }) => {
    const ref = useRef<HTMLDivElement>(null);

    const handleClick = (e: React.MouseEvent) => {
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const newSaturation = (x / rect.width) * 100;

            // Calculate max lightness based on saturation:
            // 0% saturation = 100% max lightness (white at top-left)
            // 100% saturation = 50% max lightness (pure hue at top-right)
            const maxLightness = 100 - (newSaturation / 100) * 50;
            const newLightness = maxLightness - (y / rect.height) * maxLightness;

            onChange(Math.max(0, Math.min(100, newSaturation)), Math.max(0, Math.min(100, newLightness)));
        }
    };

    const rgb = hslToRgb(hue / 360, 1, 0.5);
    const hueColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

    return (
        <div style={{ position: "relative" }}>
            <div
                ref={ref}
                style={{
                    position: "relative",
                    width: `${size}px`,
                    height: `${size}px`,
                    backgroundColor: hueColor,
                    borderRadius: "4px",
                    cursor: "crosshair",
                }}
                onClick={handleClick}
            >
                {/* Saturation gradient - white to transparent (left to right) */}
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "linear-gradient(to right, #ffffff, transparent)",
                        borderRadius: "4px",
                    }}
                />
                {/* Lightness gradient - transparent to black (top to bottom) */}
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "linear-gradient(to bottom, transparent, #000000)",
                        borderRadius: "4px",
                    }}
                />
                {/* Cursor */}
                <div
                    style={{
                        position: "absolute",
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        border: "2px solid white",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                        pointerEvents: "none",
                        left: `${saturation}%`,
                        top: `${(() => {
                            const maxLightness = 100 - (saturation / 100) * 50;
                            return ((maxLightness - lightness) / maxLightness) * 100;
                        })()}%`,
                        transform: "translate(-50%, -50%)",
                        backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
                    }}
                />
            </div>
        </div>
    );
};

// ColorPaletteSelector component
const ColorPaletteSelector: React.FC<{
    onColorSelect: (color: string) => void;
}> = ({ onColorSelect }) => {
    const displayPalettes = getColorPalettes();

    return (
        <div className="mk-color-palette-selector">
            {/* Display all color palettes */}
            {displayPalettes.map((palette) => (
                <div key={palette.id} className="mk-palette-section">
                    <div className="mk-palette-name">{palette.name}</div>
                    <div className="mk-palette-colors">
                        {palette.colors.map((color: any, index: number) => {
                            return <ColorSwatch key={`${palette.id}-${index}`} color={color.value} name={color.name} size="medium" onClick={() => onColorSelect(color.value)} />;
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export const ColorPicker = (props: { superstate: Superstate; color: string; hide?: () => void; saveValue: (color: string) => void; stayOpen?: boolean; hidePaletteSelector?: boolean }) => {
    const [value, setValue] = useState(props.color ?? "#eb3b5a");
    const [currentColor, setCurrentColor] = useState<string>(value);
    const [mode, setMode] = useState<ColorMode>(props.hidePaletteSelector ? "solid" : "palettes");
    const [hue, setHue] = useState(0);
    const [saturation, setSaturation] = useState(50);
    const [lightness, setLightness] = useState(50);

    // Debounced save function to prevent excessive updates
    const debouncedSaveValue = useCallback(
        debounce((color: string) => {
            props.saveValue(color);
        }, 150),
        [props.saveValue],
    );

    const saveValue = (v: string) => {
        setCurrentColor(v);
        setValue(v);
        debouncedSaveValue(v);
    };

    const updateColor = (color: string) => {
        if (color) {
            setValue(color);
            setCurrentColor(color);
        }

        setCurrentColor(color || "#000000");
        setMode(color === "" || color === "transparent" ? "none" : props.hidePaletteSelector ? "solid" : "palettes");
    };

    useEffect(() => {
        updateColor(props.color);
    }, [props.color]);

    // Update HSL values when current color changes
    useEffect(() => {
        if (mode === "solid") {
            const rgb = hexToRgb(currentColor);
            if (rgb) {
                const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
                setHue(h);
                setSaturation(s);
                setLightness(l);
            }
        }
    }, [currentColor, mode]);

    return (
        <div className="mk-ui-color-picker-enhanced">
            {/* Mode Selector */}
            <div className="mk-color-mode-selector">
                {([...(props.hidePaletteSelector ? [] : ["none"]), ...(props.hidePaletteSelector ? [] : ["palettes"]), "solid"] as ColorMode[]).map((modeOption) => {
                    const isSelected = mode === modeOption;

                    let backgroundStyle: React.CSSProperties = {};
                    switch (modeOption) {
                        case "palettes":
                            backgroundStyle = {
                                background: `
                  linear-gradient(to right, #3b82f6 0% 50%, #ef4444 50% 100%),
                  linear-gradient(to right, #10b981 0% 50%, #f59e0b 50% 100%)
                `,
                                backgroundSize: "100% 50%, 100% 50%",
                                backgroundPosition: "0 0, 0 100%",
                                backgroundRepeat: "no-repeat",
                            };
                            break;
                        case "solid":
                            backgroundStyle = {
                                backgroundColor: currentColor || "#3b82f6",
                            };
                            break;
                        case "none":
                            backgroundStyle = {};
                            break;
                    }

                    return (
                        <button
                            key={modeOption}
                            onClick={() => {
                                setMode(modeOption);
                                if (modeOption === "none") {
                                    props.saveValue("");
                                    props.hide?.();
                                } else if (modeOption === "solid") {
                                    debouncedSaveValue(currentColor);
                                }
                            }}
                            className={`mk-color-mode-button ${isSelected ? "active" : ""}`}
                            style={backgroundStyle}
                        >
                            {modeOption === "none" && (
                                <div className="mk-color-none-icon">
                                    <svg width="100%" height="100%" viewBox="0 0 20 20">
                                        <line x1="2" y1="2" x2="18" y2="18" stroke="#ef4444" strokeWidth="2" />
                                    </svg>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Color Canvas - only show for mode */}
            {mode === "solid" && (
                <div className="mk-color-canvas-section">
                    {/* Saturation/Lightness Canvas */}
                    <div className="mk-color-canvas-wrapper">
                        <SaturationLightnessCanvas
                            hue={hue}
                            saturation={saturation}
                            lightness={lightness}
                            onChange={(s, l) => {
                                setSaturation(s);
                                setLightness(l);
                                const rgb = hslToRgb(hue / 360, s / 100, l / 100);
                                const hex = rgbToHex(...rgb);
                                saveValue(hex);
                            }}
                            size={200}
                        />
                    </div>

                    {/* Hue Picker */}
                    <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                        <HuePicker
                            hue={hue}
                            onChange={(h) => {
                                setHue(h);
                                const rgb = hslToRgb(h / 360, saturation / 100, lightness / 100);
                                const hex = rgbToHex(...rgb);
                                saveValue(hex);
                            }}
                            width={200}
                            height={20}
                        />
                    </div>

                    {/* Current Color Display */}
                    <div className="mk-color-current" style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                        <ColorSwatch color={currentColor} size="large" onClick={() => {}} />
                        <input
                            type="text"
                            value={currentColor}
                            onChange={(e) => {
                                if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                                    saveValue(e.target.value);
                                }
                            }}
                            className="mk-color-hex-input"
                            placeholder="#000000"
                            style={{ flex: 1, minWidth: 0 }}
                        />
                    </div>
                </div>
            )}

            {/* Color Palette Selector */}
            {!props.hidePaletteSelector && (mode === "palettes" || mode === "none") && (
                <ColorPaletteSelector
                    onColorSelect={(color) => {
                        saveValue(color);
                    }}
                />
            )}

            {/* None Mode Display */}
            {!props.hidePaletteSelector && mode === "none" && (
                <div className="mk-color-none-display">
                    <div className="mk-color-none-text">{i18n.menu.noColor}</div>
                    <div className="mk-color-none-desc">{i18n.menu.thisElementWillHaveNoColorApplied}</div>
                </div>
            )}
        </div>
    );
};

export const showColorPickerMenu = (superstate: Superstate, rect: Rect, win: Window, value: string, setValue: (color: string) => void, stayOpen?: boolean, _isSubmenu?: boolean, hidePaletteSelector?: boolean, anchor: Anchors = "bottom") => {
    return superstate.ui.openCustomMenu(rect, <ColorPicker superstate={superstate} color={value} saveValue={setValue} stayOpen={stayOpen} hidePaletteSelector={hidePaletteSelector}></ColorPicker>, {}, win, anchor);
};
