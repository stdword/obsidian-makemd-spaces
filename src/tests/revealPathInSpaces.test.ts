import { revealPathInSpaces } from "core/commands/revealPathInSpaces";
import { eventTypes } from "schemas/event";
import i18n from "shared/i18n";

describe("revealPathInSpaces", () => {
    beforeEach(() => {
        (global as any).window = { dispatchEvent: jest.fn((event: any) => event.detail.onResult(true)) };
        (global as any).CustomEvent = class CustomEvent extends Event {
            detail: unknown;
            constructor(type: string, init: { detail: unknown }) {
                super(type);
                this.detail = init.detail;
            }
        };
        (global as any).requestAnimationFrame = (callback: () => void) => callback();
    });

    it("chooses the focus with the most specific matching path", async () => {
        const dispatchEvent = window.dispatchEvent as jest.Mock;
        const superstate = {
            focuses: [
                { paths: ["Target"] },
                { paths: ["Other"] },
                { paths: ["Target/Nested"] },
            ],
            settings: { currentFocus: 1 },
            saveSettings: jest.fn(),
            ui: { notify: jest.fn() },
        };

        await revealPathInSpaces(superstate as any, "Target/Nested/Note.md");

        expect(superstate.settings.currentFocus).toBe(2);
        expect(superstate.saveSettings).toHaveBeenCalled();
        expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: eventTypes.revealPath }));
    });

    it("uses current-first, then left-to-right order to break equal-specificity ties", async () => {
        const superstate = {
            focuses: [{ paths: ["Target/Nested"] }, { paths: ["/"] }, { paths: ["Target/Nested"] }],
            settings: { currentFocus: 2 },
            saveSettings: jest.fn(),
            ui: { notify: jest.fn() },
        };

        await revealPathInSpaces(superstate as any, "Target/Nested/Note.md");

        expect(superstate.settings.currentFocus).toBe(2);
        expect(superstate.saveSettings).not.toHaveBeenCalled();
    });

    it("notifies when no focus contains the path", async () => {
        const notify = jest.fn();
        const superstate = {
            focuses: [{ paths: ["Elsewhere"] }],
            settings: { currentFocus: 0 },
            saveSettings: jest.fn(),
            ui: { notify },
        };

        await revealPathInSpaces(superstate as any, "Missing/Note.md");

        expect(window.dispatchEvent).toHaveBeenCalled();
        expect(notify).toHaveBeenCalledWith(i18n.notice.notFound);
    });

    it("notifies when the navigator cannot find the path inside the matched focus", async () => {
        const notify = jest.fn();
        (window.dispatchEvent as jest.Mock).mockImplementationOnce((event: any) => event.detail.onResult(false));
        const superstate = {
            focuses: [{ paths: ["Content"] }],
            settings: { currentFocus: 0 },
            saveSettings: jest.fn(),
            ui: { notify },
        };

        await revealPathInSpaces(superstate as any, "Content/Missing.md");

        expect(notify).toHaveBeenCalledWith(i18n.notice.notFound);
    });
    describe("inside focus mode", () => {
        const { enterFocusMode, isFocusModeActive } = jest.requireActual("core/utils/superstate/focusMode");
        const { makeFocusSuperstate } = jest.requireActual("./focusModeStub");

        it("finds the file in the temporary focus without leaving it", async () => {
            const s = makeFocusSuperstate({ currentFocus: 1 });
            enterFocusMode(s, [{ path: "Recipes/Soups" }]);

            await revealPathInSpaces(s, "Recipes/Soups/Borscht.md");

            expect(isFocusModeActive(s)).toBe(true);
            expect(s.settings.currentFocus).toBe(1);
            expect(s.ui.notify).not.toHaveBeenCalled();
        });

        it("stays in focus mode even when a regular focus has a more specific section", async () => {
            const s = makeFocusSuperstate({ currentFocus: 0 });
            s.focuses[1].paths = ["Recipes/Soups"];
            enterFocusMode(s, [{ path: "Recipes" }]);

            await revealPathInSpaces(s, "Recipes/Soups/Borscht.md");

            expect(isFocusModeActive(s)).toBe(true);
            expect(s.settings.currentFocus).toBe(0);
        });

        it("leaves focus mode when the file is only in a regular focus", async () => {
            const s = makeFocusSuperstate({ currentFocus: 0 });
            enterFocusMode(s, [{ path: "Recipes/Soups" }]);

            await revealPathInSpaces(s, "Tools/Saw.md");

            expect(isFocusModeActive(s)).toBe(false);
            expect(s.settings.currentFocus).toBe(1);
        });

        it("leaves focus mode for the origin focus when the file is only there", async () => {
            const s = makeFocusSuperstate({ currentFocus: 0 });
            enterFocusMode(s, [{ path: "Recipes/Soups" }]);

            await revealPathInSpaces(s, "Recipes/Salads/Greek.md");

            expect(isFocusModeActive(s)).toBe(false);
            expect(s.settings.currentFocus).toBe(0);
        });
    });
});
