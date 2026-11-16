import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// The agent skill names Lede's flows, blocks and primitives and a few token values. An agent reads those lists in
// place of the registry, so each is held to the file that owns it: an item added to registry.json, renamed or removed
// fails here until the skill says the same.
const SKILL = readFileSync('.claude/skills/lede-design-system/SKILL.md', 'utf8');
type Item = { name: string; type: string; title: string; categories?: string[]; files: { path: string }[] };
const { items } = JSON.parse(readFileSync('registry.json', 'utf8')) as { items: Item[] };

/** The names in backticks on the "Choose the layer" line that opens with this number. */
function listed(number: 1 | 2 | 3) {
  const line = SKILL.split('\n').find((l) => l.startsWith(`${number}. `));
  expect(line, `"Choose the layer" has a line ${number}`).toBeDefined();
  return [...line!.matchAll(/`([^`]+)`/g)].map((match) => match[1]).sort();
}
/** Each component a set of items is titled for: "ListGroup, ListRow" is two. */
const titles = (of: (item: Item) => boolean) => items.filter(of).flatMap((item) => item.title.split(', ')).sort();
const exported = (name: string) => items.some((item) => item.files.some((file) => /\.tsx?$/.test(file.path) && new RegExp(`^export (function|const) ${name}\\b`, 'm').test(readFileSync(file.path, 'utf8'))));

test('the skill’s flows are the registry’s flows', () => {
  expect(listed(1)).toEqual(titles((item) => item.categories?.includes('flows') ?? false));
});

test('the skill’s blocks are the registry’s blocks', () => {
  expect(listed(2)).toEqual(titles((item) => item.categories?.includes('blocks') ?? false));
});

test('the skill’s primitives are the registry’s components, plus exports of the registry’s own files', () => {
  const components = titles((item) => item.type === 'registry:component');
  const names = listed(3);
  expect(names).toEqual(expect.arrayContaining(components));
  for (const name of names.filter((n) => !components.includes(n))) expect(exported(name), `${name} is exported from a registry file`).toBe(true);
});

test('the skill’s radius seed and step are the tokens’', () => {
  const tokens = readFileSync('registry/lede/lede.tokens.css', 'utf8');
  const first = (name: string) => tokens.match(new RegExp(`^\\s*--${name}: (\\d+)px;`, 'm'))![1];
  const [, seed, step] = SKILL.match(/`--radius` seed \((\d+)px by default\) and `--radius-step` \((\d+)px\)/)!;
  expect({ seed, step }).toEqual({ seed: first('radius'), step: first('radius-step') });
  // The five steps the skill prints, from the formulas in lede.tokens.css.
  const [s, t] = [Number(seed), Number(step)];
  expect(SKILL).toContain(`\`--radius-xl\` ${s + t}, \`lg\` ${s}, \`md\` ${s - t}, \`sm\` ${s - t - t / 2}, \`xs\` ${s - 2 * t}`);
});
