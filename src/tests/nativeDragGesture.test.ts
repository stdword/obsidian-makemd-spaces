import { isNativeDragGesture } from "core/react/components/Navigator/SpaceTree/SpaceTreeView";

describe("isNativeDragGesture", () => {
    it("routes a cmd-drag onto the native HTML5 drag path", () => {
        expect(isNativeDragGesture({ metaKey: true, ctrlKey: false, button: 0 })).toBe(true);
    });
    it("routes a ctrl-drag onto the native path for non-mac keyboards", () => {
        expect(isNativeDragGesture({ metaKey: false, ctrlKey: true, button: 0 })).toBe(true);
    });
    it("keeps a plain drag on the pointer path", () => {
        expect(isNativeDragGesture({ metaKey: false, ctrlKey: false, button: 0 })).toBe(false);
    });
    it("ignores non-primary buttons", () => {
        expect(isNativeDragGesture({ metaKey: true, ctrlKey: false, button: 2 })).toBe(false);
    });
});
