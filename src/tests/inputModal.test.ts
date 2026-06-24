import { validateInputModalValue } from "core/react/components/UI/Modals/InputModal";

describe("InputModal validation", () => {
    it("returns the first validation error", () => {
        const validateValue = (value: string) => {
            if (!value.trim()) return "Value is required";
            if (value == "Existing") return "Value already exists";
        };

        expect(validateInputModalValue("", validateValue)).toBe("Value is required");
        expect(validateInputModalValue("Existing", validateValue)).toBe("Value already exists");
    });

    it("allows values without validation errors", () => {
        const validateValue = (value: string) => {
            if (!value.trim()) return "Value is required";
        };

        expect(validateInputModalValue("New value", validateValue)).toBeUndefined();
        expect(validateInputModalValue("New value")).toBeUndefined();
    });
});
