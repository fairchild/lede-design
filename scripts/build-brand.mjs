// Draws Lede's mark, Headline, into the files that carry it outside the site: public/favicon.svg, public/favicon.ico,
// public/apple-touch-icon.png, the social card public/og.png and the README's mark in .github/assets/. Colors come
// from `primary` and `primary-foreground` in tokens/tokens.json, so a change there reaches every file on the next run.
// The shape matches src/brand-mark.tsx. The card's text is set in Inter, an open font, from @fontsource-variable/inter,
// so every machine sets the card in the same font. Run `npm run brand` and commit what it writes.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const tokens = JSON.parse(readFileSync('tokens/tokens.json', 'utf8'));
const color = Object.fromEntries(tokens.color.tokens.map((t) => [t.name, t.value]));
const tile = color.primary;
const line = color['primary-foreground'];

/** The mark on its 16px grid. `round` is false for the touch icon, which iOS masks to its own shape. */
const mark = ({ round = true, tileFill = 'class="t"', lineFill = 'class="l"' } = {}) => [
  `<rect ${tileFill} width="16" height="16"${round ? ' rx="3.5"' : ''}/>`,
  `<rect ${lineFill} x="3" y="4" width="10" height="2" rx="1"/>`,
  `<rect ${lineFill} x="3" y="8" width="10" height="1" rx="0.5"/>`,
  `<rect ${lineFill} x="3" y="11" width="7" height="1" rx="0.5"/>`,
].join('');

const themed = (theme, opts) => mark({ ...opts, tileFill: `fill="${tile[theme]}"`, lineFill: `fill="${line[theme]}"` });
const svg = (body, size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"${size ? ` width="${size}" height="${size}"` : ''}>${body}</svg>`;

const favicon = svg(`<style>
.t{fill:${tile.light}}.l{fill:${line.light}}
@media (prefers-color-scheme:dark){.t{fill:${tile.dark}}.l{fill:${line.dark}}}
@media (prefers-contrast:more){.t{fill:${tile['light-hc']}}.l{fill:${line['light-hc']}}}
@media (prefers-color-scheme:dark) and (prefers-contrast:more){.t{fill:${tile['dark-hc']}}.l{fill:${line['dark-hc']}}}
</style>${mark()}`) + '\n';

/** An ICO that holds PNGs, which every browser that still asks for /favicon.ico reads. */
const ico = (pngs) => {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i;
    head.writeUInt8(size % 256, at);
    head.writeUInt8(size % 256, at + 1);
    head.writeUInt16LE(1, at + 4);
    head.writeUInt16LE(32, at + 6);
    head.writeUInt32LE(data.length, at + 8);
    head.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.data)]);
};

const inter = readFileSync('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2').toString('base64');
const card = `<style>
@font-face { font-family: Inter; src: url(data:font/woff2;base64,${inter}) format('woff2'); font-weight: 100 900; }
html, body { margin: 0; }
body { width: 1200px; height: 630px; box-sizing: border-box; padding: 96px 104px; display: flex; flex-direction: column; justify-content: center;
  background: ${color.background.light}; color: ${color.foreground.light}; font-family: Inter; font-feature-settings: 'cv11', 'ss01'; }
svg { width: 128px; height: 128px; margin-bottom: 48px; }
h1 { margin: 0; font-size: 112px; line-height: 1; font-weight: 700; letter-spacing: -0.03em; }
p { margin: 28px 0 0; max-width: 940px; font-size: 38px; line-height: 1.3; font-weight: 400; letter-spacing: -0.01em; color: ${color['muted-foreground'].light}; }
</style>${svg(themed('light'))}<h1>Lede</h1><p>A design system for React. Every screen, section and row leads with its takeaway.</p>`;

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });
const shoot = async (html, width, height, omitBackground = true) => {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}svg{display:block}</style>${html}`);
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ omitBackground, clip: { x: 0, y: 0, width, height } });
};

writeFileSync('public/favicon.svg', favicon);
const icoSizes = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await shoot(svg(themed('light'), size), size, size) })));
writeFileSync('public/favicon.ico', ico(icoSizes));
writeFileSync('public/apple-touch-icon.png', await shoot(svg(themed('light', { round: false }), 180), 180, 180, false));
for (const theme of ['light', 'dark']) writeFileSync(`.github/assets/mark-${theme}.png`, await shoot(svg(themed(theme), 96), 96, 96));
writeFileSync('public/og.png', await shoot(card, 1200, 630, false));
await browser.close();
console.log('brand: wrote public/favicon.svg, favicon.ico (16, 32, 48), apple-touch-icon.png, og.png and .github/assets/mark-{light,dark}.png');
