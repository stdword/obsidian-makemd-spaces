/** True when `id` is `ancestorId` itself or lies inside it (tree ids and vault paths share the "a/b/c" shape). */
export const isNodeOrDescendant = (ancestorId: string | null | undefined, id: string | null | undefined): boolean => {
    if (!ancestorId || !id) return false;
    const ancestor = String(ancestorId);
    const target = String(id);
    return target == ancestor || target.startsWith(`${ancestor}/`);
};

// Helper Function to Create Folder Tree

export const compareByFieldDeep = (field: (obj: Record<string, any>) => string, dir: boolean) => (_a: Record<string, any>, _b: Record<string, any>) => {
    const a = dir ? _a : _b;
    const b = dir ? _b : _a;

    if (field(a) < field(b)) {
        return -1;
    }
    if (field(a) > field(b)) {
        return 1;
    }
    return 0;
};

export const compareByField = (field: string, dir: boolean) => (_a: Record<string, any>, _b: Record<string, any>) => {
    const a = dir ? _a : _b;
    const b = dir ? _b : _a;
    if (a[field] < b[field]) {
        return -1;
    }
    if (a[field] > b[field]) {
        return 1;
    }
    return 0;
};

export const compareByFieldCaseInsensitive = (field: string, dir: boolean) => (_a: Record<string, any>, _b: Record<string, any>) => {
    const a = dir ? _a : _b;
    const b = dir ? _b : _a;
    return a[field]?.toLowerCase().localeCompare(b[field]?.toLowerCase(), undefined, {
        numeric: true,
    });
};
