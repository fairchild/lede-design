// axe, as the tests run it, checks the text a page is showing at AA: its 7:1 rule is off by default, and it has no
// non-text rule. This measures every pair in tokens/contrast.json, in every theme and accent, whatever is on screen.
// Colours come from their sources, each colour token in tokens/tokens.json and each color-mix() in registry/, so a new
// one fails here until a pair names it. Every pair meets its floor. `npm run contrast -- --report` prints every pair.
import { readdirSync, readFileSync } from 'node:fs';

const { color, shadow } = JSON.parse(readFileSync('tokens/tokens.json', 'utf8'));
const spec = JSON.parse(readFileSync('tokens/contrast.json', 'utf8'));

const themes = color.themes.map((theme) => theme.id);
const tokens = new Map(color.tokens.map((token) => [token.name, token.value]));
const presets = [...tokens.keys()].filter((name) => name.startsWith('preset-'));
const greys = Array.from({ length: 256 }, (_, value) => [value, value, value, 1]);
const problems = [];

const files = readdirSync('registry', { recursive: true, encoding: 'utf8' }).filter((file) => /\.(css|tsx?)$/.test(file));
const read = (list) => list.map((file) => readFileSync(`registry/${file}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
const sources = read(files);
const css = read(files.filter((file) => file.endsWith('.css')));

// A mix is named as CSS writes it: `primary 14%` is 14% primary and the rest transparent, `primary 10% card` the rest card.
const named = new Map();
const mixes = [...sources.matchAll(/(?:--(ld-[\w-]+): )?color-mix\(in srgb, var\(--([\w-]+)\) (\d+)%, (?:transparent|var\(--([\w-]+)\))\)/gi)]
  .map(([, name, first, share, second]) => {
    const mix = second ? `${first} ${share}% ${second}` : `${first} ${share}%`;
    if (name) named.set(name, mix);
    return name ?? mix;
  });
if (mixes.length !== sources.toLowerCase().split('color-mix(').length - 1) problems.push('registry/ has a color-mix() this script can\'t read');
for (const name of named.keys()) if (sources.match(new RegExp(`--${name}\\s*:`, 'g')).length > 1) problems.push(`--${name}: declared more than once, and the script measures one`);

const aliasOf = (value) => (typeof value === 'string' && /^\{.+\}$/.test(value) ? value.slice(1, -1) : null);
const canonical = (name) => (aliasOf(tokens.get(name)) ? canonical(aliasOf(tokens.get(name))) : name);

// The -hc fill walk. In -hc a control's fill shows at 3:1, and the fills in `fills.colors` don't on their own, so every
// rule in registry/ that paints one draws an --input edge in -hc: in the rule itself, or in a `[data-theme$="-hc"]` twin
// for the same element. A twin covers the element in every state, so `.ld-btn-gray` covers `.ld-btn-gray:hover`.
// The controls in `fills.everyTheme` draw theirs in every theme, so their own rule holds it.
// `fills.notControls` lists what paints one of these fills and isn't a control, with the reason.
const HC = '[data-theme$="-hc"] ';
/** Splits at commas outside parentheses and brackets. */
function topLevel(text, separator) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    if ('(['.includes(text[i])) depth++;
    else if (')]'.includes(text[i])) depth--;
    else if (text[i] === separator && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  return [...parts, text.slice(start)].map((part) => part.trim()).filter(Boolean);
}
/** Every style rule as its selectors and declarations, with the at-rules it sits in. */
function styleRules(text) {
  const found = [];
  const stack = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { stack.push(text.slice(start, i).trim()); start = i + 1; }
    else if (text[i] === '}') {
      const prelude = stack.pop();
      if (!prelude.startsWith('@') && !stack.some((outer) => outer.startsWith('@keyframes'))) {
        const declarations = topLevel(text.slice(start, i), ';').map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]);
        found.push({ selectors: topLevel(prelude.replace(/\s+/g, ' '), ','), declarations, within: [...stack] });
      }
      start = i + 1;
    }
  }
  return found;
}
const simple = /\.[\w-]+|#[\w-]+|\[[^\]]*\]|::?[\w-]+(?:\((?:[^()]|\([^()]*\))*\))?|\*|[a-z][\w-]*/gi;
/** A selector's last compound, as a set of simple selectors, and what comes before it. */
function compound(selector) {
  let depth = 0, cut = 0;
  for (let i = 0; i < selector.length; i++) {
    if ('(['.includes(selector[i])) depth++;
    else if (')]'.includes(selector[i])) depth--;
    else if (depth === 0 && ' >+~'.includes(selector[i])) cut = i + 1;
  }
  return { before: selector.slice(0, cut).trim(), last: new Set(selector.slice(cut).match(simple)) };
}
const covers = (twin, selector) => {
  const [a, b] = [compound(twin), compound(selector)];
  return (!a.before || a.before === b.before) && [...a.last].every((part) => b.last.has(part));
};
const fills = new Set(spec.fills.colors);
const edged = (declarations) => declarations.some(([property, value]) => /^(box-shadow|border(-[a-z-]+)?|outline)$/.test(property) && value.includes('var(--input)'));
const painted = (value) => [
  ...[...value.matchAll(/color-mix\(in srgb, var\(--([\w-]+)\) (\d+)%, (?:transparent|var\(--([\w-]+)\))\)/gi)].map(([, first, share, second]) => (second ? `${first} ${share}% ${second}` : `${first} ${share}%`)),
  ...[...value.replace(/color-mix\((?:[^()]|\([^()]*\))*\)/gi, '').matchAll(/var\(--([\w-]+)\)/g)].map(([, name]) => name),
];
const fillRules = styleRules(css).filter(({ within }) => !within.some((rule) => rule.includes('forced-colors')));
const twins = fillRules.filter(({ declarations }) => edged(declarations))
  .flatMap(({ selectors }) => selectors.map((selector) => (selector.startsWith(HC) ? selector.slice(HC.length) : selector)));
const fillers = new Set();
for (const { selectors, declarations } of fillRules) {
  const colours = declarations.filter(([property]) => /^background(-color|-image)?$/.test(property))
    .flatMap(([, value]) => painted(value)).filter((name) => fills.has(tokens.has(name) ? canonical(name) : name));
  if (!colours.length) continue;
  for (const selector of selectors) {
    if (selector.startsWith(HC)) continue;
    fillers.add(selector);
    if (edged(declarations) || spec.fills.notControls[selector] || twins.some((twin) => covers(twin, selector))) continue;
    problems.push(`${selector}: paints ${colours[0]} with no --input edge in -hc. Draw one in a ${HC.trim()} twin, or list it in tokens/contrast.json's fills.notControls with a reason`);
  }
}
for (const [selector, reason] of Object.entries(spec.fills.notControls)) {
  if (!reason) problems.push(`tokens/contrast.json: fills.notControls gives no reason for ${selector}`);
  if (!fillers.has(selector)) problems.push(`tokens/contrast.json: fills.notControls lists ${selector}, which paints none of fills.colors`);
}
// In light and dark too, the controls in `fills.everyTheme` draw their --input edge: their fill alone sits under 3:1.
for (const selector of spec.fills.everyTheme) {
  if (!fillRules.some(({ selectors, declarations }) => selectors.includes(selector) && edged(declarations))) {
    problems.push(`${selector}: draws no --input edge in light and dark. Draw it in the rule itself, not only a ${HC.trim()} twin`);
  }
}


function parse(value) {
  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})([\da-f]{2})?$/i.exec(value);
  if (hex) return [...hex.slice(1, 4).map((part) => parseInt(part, 16)), hex[4] ? parseInt(hex[4], 16) / 255 : 1];
  const rgb = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(value);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3], rgb[4] ? Math.round(rgb[4] * 255) / 255 : 1];
  throw new Error(`tokens.json: can't read the colour ${value}`);
}

/** A colour's [r, g, b, a] in a theme. `accent` stands in for primary, as ThemeProvider's does. */
function paint(name, theme, accent) {
  if (named.has(name)) return paint(named.get(name), theme, accent);
  const mix = /^(\S+) (\d+)%(?: (\S+))?$/.exec(name);
  if (mix) {
    const share = mix[2] / 100;
    const [first, second] = [paint(mix[1], theme, accent), mix[3] ? paint(mix[3], theme, accent) : [0, 0, 0, 0]];
    const alpha = first[3] * share + second[3] * (1 - share);
    return [0, 1, 2].map((i) => (first[i] * first[3] * share + second[i] * second[3] * (1 - share)) / alpha).concat(alpha);
  }
  if (name === 'primary' && accent) return paint(accent, theme);
  if (!tokens.has(name)) throw new Error(`tokens/contrast.json: no colour named ${name}`);
  const value = tokens.get(name);
  const own = typeof value === 'string' ? value : value[theme] ?? value[themes[0]];
  return aliasOf(own) ? paint(aliasOf(own), theme, accent) : parse(own);
}

/** Browsers composite in 8 bits, so rounding here lands within a step of a screenshot's pixels. */
const over = (top, below) => [0, 1, 2].map((i) => Math.round(top[i] * top[3] + below[i] * (1 - top[3]))).concat(1);

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((channel) => channel / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

/** What can be seen of a surface: `a over b over c`, top first, down to its first opaque layer. */
function visibleLayers(surface, theme, accent) {
  const layers = surface.split(' over ').map(canonical);
  const solid = layers.findIndex((layer) => layer !== 'any' && paint(layer, theme, accent)[3] === 1);
  if (solid === -1 && layers.at(-1) !== 'any') throw new Error(`tokens/contrast.json: nothing opaque under ${surface}`);
  return solid === -1 ? layers : layers.slice(0, solid + 1);
}

/** The ratio of a colour to the surface under it. Over `any`, the worst across every grey: see tokens/contrast.json. */
function measure(name, layers, theme, accent, top = paint(name, theme, accent)) {
  const grounds = layers.at(-1) === 'any' ? greys : [[0, 0, 0, 1]];
  return Math.min(...grounds.map((ground) => {
    const under = layers.filter((layer) => layer !== 'any').reduceRight((below, layer) => over(paint(layer, theme, accent), below), ground);
    return contrast(over(top, under), under);
  }));
}

// The knob edge read. A pair with `edge` names a shadow token whose first shadow can be a solid edge, `0 0 0 1px
// <colour>`. Its colour shows wherever the fill's does, so the pair takes the better of the fill and the edge.
const shadows = new Map(shadow.tokens.map((token) => [token.name, token.value]));
function edgeOf(name, theme) {
  if (!shadows.has(name)) throw new Error(`tokens/contrast.json: no shadow named ${name}`);
  const value = shadows.get(name);
  const first = topLevel(typeof value === 'string' ? value : value[theme], ',')[0];
  const edge = /^0 0 0 [\d.]+px (.+)$/.exec(first ?? '');
  return edge ? parse(edge[1]) : null;
}

const expand = (surface) => {
  const group = /@([\w-]+)/.exec(surface);
  if (group && !spec.groups[group[1]]) throw new Error(`tokens/contrast.json: no group named ${group[0]}`);
  return group ? spec.groups[group[1]].flatMap((member) => expand(surface.replace(group[0], member))) : [surface];
};

// shadcn's convention, so a new X-foreground needs no entry: it reads on X, over whatever X can sit on.
const conventional = [...tokens.keys()]
  .filter((name) => name.endsWith('-foreground') && tokens.has(name.replace(/-foreground$/, '')))
  .map((name) => ({ role: 'text', colors: [name], on: [`${name.replace(/-foreground$/, '')} over @page`] }));
const pairs = [...spec.pairs, ...conventional];

// A pair can leave out -hc openly: an exempt pair there, for the same colours and surfaces, says so in the data.
const exemptInHc = ({ colors, on }) => pairs.some((other) => other.role === 'exempt' && other.in !== 'standard'
  && colors.every((name) => other.colors.includes(name)) && on.every((surface) => other.on.includes(surface)));

const results = new Map();
for (const pair of pairs) {
  if (!spec.floors[pair.role]) throw new Error(`tokens/contrast.json: no floor for the role ${pair.role}`);
  if (pair.in && !['standard', 'hc'].includes(pair.in)) problems.push(`${pair.colors}: \`in\` is standard or hc, not ${pair.in}`);
  if (pair.in === 'standard' && pair.role !== 'exempt' && !exemptInHc(pair)) problems.push(`${pair.colors}: a pair that leaves out -hc needs an exempt -hc pair for the same colours and surfaces`);
  for (const theme of themes) {
    const hc = theme.endsWith('-hc');
    if (pair.in && pair.in !== (hc ? 'hc' : 'standard')) continue;
    const floor = spec.floors[pair.role][hc ? 'hc' : 'standard'];
    for (const name of pair.colors) {
      for (const surface of pair.on.flatMap(expand)) {
        for (const accent of [null, ...presets]) {
          const layers = visibleLayers(surface, theme, accent);
          const edge = pair.edge && edgeOf(pair.edge, theme);
          const ratio = Math.max(measure(name, layers, theme, accent), edge ? measure(name, layers, theme, accent, edge) : 0);
          const shown = layers.join(' over ');
          const same = `${theme} ${pair.role} ${canonical(name)} ${shown}`;
          if (accent && results.get(same)?.ratio === ratio) continue;
          const id = same + (accent ?? '');
          if (results.has(id)) continue;
          const key = `${theme}${accent ? `/${accent.replace('preset-', '')}` : ''} ${pair.role}: ${name} on ${shown}`;
          results.set(id, { key, ratio, floor });
        }
      }
    }
  }
}

const used = new Set(pairs.flatMap(({ colors, on }) => [...colors, ...on.flatMap(expand).flatMap((surface) => surface.split(' over '))]));
for (const name of [...tokens.keys(), ...mixes]) {
  if (!used.has(name) && !(name.startsWith('preset-') && used.has('primary'))) problems.push(`${name}: in no pair. Add it to tokens/contrast.json with what it sits on, or as exempt with a reason`);
}

// Two places can round up to the floor, and a ratio just under it still fails.
const shown = (ratio, floor) => (ratio < floor && ratio.toFixed(2) >= floor ? ratio.toFixed(4) : ratio.toFixed(2));
for (const { key, ratio, floor } of results.values()) {
  if (!(ratio >= floor)) problems.push(`${key}: ${shown(ratio, floor)}:1, under ${floor}:1`);
}

if (process.argv.includes('--report')) {
  for (const { key, ratio, floor } of [...results.values()].sort((a, b) => a.key.localeCompare(b.key))) {
    const verdict = ratio >= floor ? 'pass' : 'FAIL';
    console.log(`${verdict.padEnd(6)} ${shown(ratio, floor).padStart(6)} / ${String(floor).padEnd(3)} ${key}`);
  }
}
if (problems.length) {
  console.error(`check-contrast: ${problems.length} problem(s)\n${problems.map((problem) => `  ${problem}`).join('\n')}`);
  process.exit(1);
}
console.log(`check-contrast: ${results.size} pairs across ${themes.length} themes and ${presets.length} accents, every one at its floor`);
