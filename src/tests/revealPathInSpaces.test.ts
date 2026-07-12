import { revealPathInSpaces } from "core/commands/revealPathInSpaces";
import { eventTypes } from "schemas/event";

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
        expect(notify).toHaveBeenCalledWith("Not found");
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

        expect(notify).toHaveBeenCalledWith("Not found");
    });
});
