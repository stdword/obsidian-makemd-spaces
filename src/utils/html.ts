const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// For text that ends up in innerHTML: menu option names come from file names, tags and
// frontmatter values, any of which may contain markup characters.
export const escapeHtml = (text: string): string => (text ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
