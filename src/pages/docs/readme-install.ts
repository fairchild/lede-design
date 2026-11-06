import type { Language } from './tokenize';

export type Block = { kind: 'text'; text: string } | { kind: 'code'; language: Language; code: string };
export interface Step { number: number; blocks: Block[] }

const LANGUAGES: Record<string, Language> = { bash: 'shell', sh: 'shell', shell: 'shell', css: 'css', tsx: 'tsx', ts: 'tsx' };

/**
 * The numbered steps of the README's "Use it in a shadcn project" section, so Overview shows the README's own words.
 * Each step is its paragraphs and fenced code, dedented, in order.
 */
export function installSteps(readme: string): Step[] {
  const section = readme.split(/^## Use it in a shadcn project$/m)[1]?.split(/^## /m)[0] ?? '';
  const steps: Step[] = [];
  let lines: string[] | undefined;
  const close = () => { if (lines) steps.push({ number: steps.length + 1, blocks: blocksOf(lines) }); };
  for (const line of section.split('\n')) {
    if (/^\d+\. /.test(line)) { close(); lines = [line.replace(/^\d+\. /, '')]; }
    else if (lines && (line === '' || line.startsWith('   '))) lines.push(line.slice(3));
    else if (lines) { close(); lines = undefined; }
  }
  close();
  return steps;
}

function blocksOf(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let text: string[] = [];
  const flush = () => { if (text.length) blocks.push({ kind: 'text', text: text.join(' ') }); text = []; };
  for (let i = 0; i < lines.length; i++) {
    const fence = lines[i].match(/^```(\w*)$/);
    if (fence) {
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
