const registeredFileTagExtensions = ["md", "base", "canvas", "excalidraw"];

export const shouldShowFileTag = (isSpace: boolean, extension?: string) => !!extension && !isSpace && !registeredFileTagExtensions.includes(extension);
