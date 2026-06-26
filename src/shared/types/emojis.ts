export type EmojiData = Record<
    string,
    {
        n: [string, string];
        u: string;
        v?: string[];
    }[]
>;
