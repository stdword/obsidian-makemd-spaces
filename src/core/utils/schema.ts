export function ensureArray(value: unknown): any[] {
    if (Array.isArray(value)) {
        return value;
    }
    if (typeof value === "string") {
        return [value];
    }
    return [];
}

export function ensureString(value: unknown): string {
    if (!value) return "";
    if (typeof value !== "string") {
        const newValue = value.toString();
        if (typeof newValue === "string") {
            return newValue;
        }
        return "";
    }
    return value;
}

export function ensureBoolean(value: unknown): boolean {
    if (!value) return false;
    return true;
}
