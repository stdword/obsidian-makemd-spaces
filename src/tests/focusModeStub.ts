// Stub superstate for Focus Mode tests: two regular focuses and observable persistence calls.
export const makeFocusSuperstate = (options: { currentFocus?: number; expandedSpaces?: string[]; keepExpanded?: boolean } = {}) => {
    const superstate: any = {
        focuses: [
            { name: "Kitchen", sticker: "", paths: ["Recipes"] },
            { name: "Workshop", sticker: "", paths: ["Tools"] },
        ],
        focusMode: null,
        settings: {
            currentFocus: options.currentFocus ?? 0,
            expandedSpaces: options.expandedSpaces ?? [],
            focusModeKeepExpanded: options.keepExpanded ?? false,
        },
        saveSettings: jest.fn(() => Promise.resolve()),
        dispatchEvent: jest.fn(),
        ui: { notify: jest.fn() },
    };
    superstate.spaceManager = {
        saveFocuses: jest.fn((focuses: any[]) => {
            superstate.focuses = focuses;
            return Promise.resolve();
        }),
    };
    return superstate;
};
