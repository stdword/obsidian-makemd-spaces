import type { SelectOption } from "makemd-core";

export const maxSuggestionsLengthForMenu = (showAll: boolean, optionsLength: number) => (showAll ? optionsLength : 25);

export const escapeActionForQuery = (query: string) => (query.length > 0 ? "clear" : "close");

const normalizedIncludes = (value: unknown, query: string) => String(value ?? "").toLocaleLowerCase().includes(query.toLocaleLowerCase());

export const searchMatchPriority = (option: SelectOption, query: string) => {
    if (!query) return 0;
    if (normalizedIncludes(option.name, query)) return 0;
    if (normalizedIncludes(option.description, query) || normalizedIncludes(option.value, query)) return 1;
    return 2;
};

export const prioritizeSearchMatches = (options: SelectOption[], query: string) =>
    options
        .map((option, index) => ({ option, index, priority: searchMatchPriority(option, query) }))
        .sort((a, b) => a.priority - b.priority || a.index - b.index)
        .map(({ option }) => option);

export const verticalDeltaForShiftWheel = (deltaY: number, deltaX: number) => deltaY || deltaX;

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
