import { isConfirmKey } from "core/react/components/UI/Modals/ConfirmationModal";

describe("ConfirmationModal keyboard", () => {
    it("confirms on Enter only", () => {
        expect(isConfirmKey({ key: "Enter", isComposing: false })).toBe(true);
        expect(isConfirmKey({ key: "Enter", isComposing: true })).toBe(false);
        expect(isConfirmKey({ key: "Escape", isComposing: false })).toBe(false);
        expect(isConfirmKey({ key: " ", isComposing: false })).toBe(false);
    });
});
