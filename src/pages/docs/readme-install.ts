import type { Language } from './tokenize';

export type Block = { kind: 'text'; text: string } | { kind: 'code'; language: Language; code: string } | { kind: 'list'; items: string[] };
export interface Step { number: number; blocks: Block[] }
/** The README's install section: what comes before step 1, the steps and what follows them. */
export interface InstallGuide { before: Block[]; steps: Step[]; after: Block[] }

const LANGUAGES: Record<string, Language> = { bash: 'shell', sh: 'shell', shell: 'shell', css: 'css', tsx: 'tsx', ts: 'tsx' };

/** A `## ` section of the README, without its heading. */
const section = (readme: string, heading: string) => readme.split(new RegExp(`^## ${heading}$`, 'm'))[1]?.split(/^## /m)[0] ?? '';

/**
 * The README's "Use it in a shadcn project" section, so Overview shows the README's own words: what comes before step 1,
 * the numbered steps, each its paragraphs and fenced code, dedented, in order, and what follows them. The site shows the
 * steps, and the docs' Markdown build all three.
 */
export function installGuide(readme: string): InstallGuide {
  const before: string[] = [];
  const after: string[] = [];
  const steps: Step[] = [];
  let lines: string[] | undefined;
  const close = () => { if (lines) steps.push({ number: steps.length + 1, blocks: blocksOf(lines) }); };
  for (const line of section(readme, 'Use it in a shadcn project').split('\n')) {
    if (/^\d+\. /.test(line)) { close(); lines = [line.replace(/^\d+\. /, '')]; }
    else if (lines && (line === '' || line.startsWith('   '))) lines.push(line.slice(3));
    else if (lines) { close(); lines = undefined; after.push(line); }
    else (steps.length ? after : before).push(line);
  }
  close();
  return { before: blocksOf(before), steps, after: blocksOf(after) };
}

/** A README section's paragraphs, lists and fenced code, such as Limits. */
export const readmeBlocks = (readme: string, heading: string) => blocksOf(section(readme, heading).split('\n'));

function blocksOf(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let text: string[] = [];
  const flush = () => { if (text.length) blocks.push({ kind: 'text', text: text.join(' ') }); text = []; };
  for (let i = 0; i < lines.length; i++) {
    const fence = lines[i].match(/^```(\w*)$/);
    if (lines[i].startsWith('- ')) {
      // A list item, with its wrapped lines indented under it.
      flush();
      let list = blocks.at(-1);
      if (list?.kind !== 'list') blocks.push(list = { kind: 'list', items: [] });
      let item = lines[i].slice(2).trim();
      while (lines[i + 1]?.startsWith('  ')) item += ` ${lines[++i].trim()}`;
      list.items.push(item);
    } else if (fence) {
      flush();
      const found = lines.indexOf('```', i + 1);
      const end = found < 0 ? lines.length : found;
      blocks.push({ kind: 'code', language: LANGUAGES[fence[1]] ?? 'shell', code: lines.slice(i + 1, end).join('\n') });
      i = end;
    } else if (lines[i].trim() === '') flush();
    else text.push(lines[i].trim());
  }
  flush();
  return blocks;
}
