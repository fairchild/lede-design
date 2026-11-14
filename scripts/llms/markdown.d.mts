/** Markdown without its fenced code, indented fences in list items included. */
export function withoutCode(markdown: string): string;
/** Throws when the Markdown doesn't open with its one h1 or skips a heading level. */
export function checkHeadings(markdown: string, route: string): void;
