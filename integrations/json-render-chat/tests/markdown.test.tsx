import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { inline, parse, section } from '../src/guide/markdown';

// The guide draws README.md with a renderer that reads only the Markdown README uses. Anything else fails here, so a
// README edit can't reach the page garbled.

describe('the guide’s Markdown renderer', () => {
  it('reads each README section the guide draws', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    for (const title of ['How it works', 'Hand this to your coding agent', 'Build this in your app']) expect(parse(section(readme, title)).length).toBeGreaterThan(0);
  });
  for (const [what, markdown] of [['an h1', '# Title'], ['a * list', '* item'], ['a quote', '> said'], ['HTML', '<details>'], ['a table row with a cell too many', '| a | b |\n| --- | --- |\n| `x | y` | z |']]) {
    it(`refuses ${what}`, () => expect(() => parse(markdown!)).toThrow(/can't draw/));
  }
  for (const [markdown, html] of [
    ["`SpecView`'s state", '<code>SpecView</code>’s state'],
    ["**Lede**'s parts", '<strong>Lede</strong>’s parts'],
    ['"hi," said the \'app\'', '“hi,” said the ‘app’'],
    ["(**'Try'**)", '(<strong>‘Try’</strong>)'],
    ["the `'/api'` proxy", '<code>&#x27;/api&#x27;</code> proxy'],
    ["[Ada's \"notes\"](docs/it's.md#\"a\")", 'href="https://github.com/fairchild/lede-design/blob/main/integrations/json-render-chat/docs/it&#x27;s.md#&quot;a&quot;">Ada’s “notes”</a>'],
  ]) {
    it(`curls the quotes in ${markdown}`, () => expect(renderToStaticMarkup(<>{inline(markdown!)}</>)).toContain(html));
  }
});
