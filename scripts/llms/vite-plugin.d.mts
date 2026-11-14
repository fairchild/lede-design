import type { Plugin } from 'vite';

/** Emits each docs page's Markdown, the reference pages, `llms.txt` and `llms-full.txt` into the build, and serves them in dev. */
export function llms(): Plugin;
