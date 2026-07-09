export const safelyParseJSON = (json: string): Record<string, any> => {
    let parsed = {};
    try {
        parsed = JSON.parse(json);
    } catch (e) {
        // Oh well, but whatever...
    }

    return parsed;
};
