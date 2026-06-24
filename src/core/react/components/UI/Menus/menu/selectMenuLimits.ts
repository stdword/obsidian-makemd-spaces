import type { SelectOption } from "makemd-core";

export const maxSuggestionsLengthForMenu = (showAll: boolean, optionsLength: number) => (showAll ? optionsLength : 25);

const limitForSection = (section: string, limits?: Record<string, number | undefined>) => {
    const limit = limits?.[section];
    return Number.isFinite(limit) && limit > -1 ? limit : undefined;
};

const limitOptions = (options: SelectOption[], limit?: number) => (limit == null ? options : options.slice(0, limit));

export const applySectionLimits = (options: SelectOption[], section: string, limits?: Record<string, number | undefined>) => {
    if (!limits) return options;
    if (section.length > 0) return limitOptions(options, limitForSection(section, limits));

    const counts = new Map<string, number>();
    return options.filter((option) => {
        const optionSection = option.section ?? "";
        const limit = limitForSection(optionSection, limits);
        if (limit == null) return true;
        const count = counts.get(optionSection) ?? 0;
        counts.set(optionSection, count + 1);
        return count < limit;
    });
};
