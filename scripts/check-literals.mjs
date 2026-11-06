// "Tokens only", checked: a number or a color written in registry CSS comes from a token, or is listed in
// tokens/literal-exceptions.json with its reason. Reads every *.css under registry/ except the one build-tokens writes,
// known by its first line. Looks at declaration values (custom properties and var() fallbacks included), the preludes
// of @media, @container and @supports, and statement at-rules such as @apply and @custom-media. Comments, strings,
// url(), selectors, @import, @charset and @layer names are skipped. A literal is any number, with any unit or none,
// outside an identifier, and any #hex or color function. A media query can't read a custom property, so a number in
// @media, @container or @custom-media equals a breakpoint token in the same unit: px, or em for a text-size breakpoint.
// A px one may also be 0.02px less in a max-width or max-height. An em one is for @media and @custom-media only, where em
// is the browser's text size (in @container it's the container's font size), and is written in range syntax.
//
// An exception entry has a `reason` and any of `values` (as written; "0" is zero in every unit), `properties` (an
// at-rule's name for its prelude), `selectors` (one found whole in each selector of the rule's list, outside functional
// pseudo-classes such as :not()), `functions` (the innermost one around the literal) and `operand`. An operand is a
// "factor", on either side of * or after /, or a "divisor", after / only, inside calc(), min(), max() or clamp(), where
// the other side isn't a bare number. A literal is taken by the first entry that matches every field the entry lists;
// an entry without `values` takes numbers only, never colors. An entry that takes nothing fails, as a stale contrast
// listing does. `npm run literals -- --report` prints what each entry and breakpoint takes.
import { readdirSync, readFileSync } from 'node:fs';

const LIST = 'tokens/literal-exceptions.json';
const GENERATED = 'GENERATED from tokens/tokens.json by scripts/build-tokens.mjs';
const tokens = JSON.parse(readFileSync('tokens/tokens.json', 'utf8'));
const entries = JSON.parse(readFileSync(LIST, 'utf8'));

const FIELDS = ['values', 'properties', 'selectors', 'functions', 'operand'];
const MATH = new Set(['calc', 'min', 'max', 'clamp']);
const QUERIES = new Set(['@media', '@container', '@custom-media']);
const COLOR = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)$/i;
const NUMBER = /^([+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?)(%|[a-z]*)$/i;
const TOKEN = /(?<fn>[a-z_-][\w-]*)?\(|(?<close>\))|(?<hex>#[\w-]+)|-*[a-z_][\w-]*|(?<num>[+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?)(?<unit>%|[a-z]+)?|\s+|./gis;

/** The tokens.json families a property's numbers come from, so a failure can say where to look. */
const FAMILIES = [
  [/radius$/, ['radius']],
  [/^(margin|padding|scroll-margin|scroll-padding|inset)|^(gap|row-gap|column-gap|top|right|bottom|left|border-spacing)$/, ['spacing']],
  [/^((min|max)-)?(width|height|inline-size|block-size)$|^flex|^grid-(template|auto)/, ['size', 'layout']],
  [/^(border|outline)|^text-underline-offset$/, ['stroke']],
  [/^box-shadow$/, ['stroke', 'shadow']],
  [/^font$/, ['type', 'weight']],
  [/^(font-size|line-height|letter-spacing)$/, ['type']],
  [/^font-weight$/, ['weight']],
  [/^opacity$/, ['opacity']],
  [/^z-index$/, ['layer']],
  [/^(transition|animation)/, ['motion']],
  [/^(transform|scale|translate)$/, ['motion', 'size']],
  [/filter$/, ['blur']],
];
for (const family of FAMILIES.flatMap(([, names]) => names)) if (!tokens[family]) throw new Error(`check-literals: tokens/tokens.json has no ${family} family`);
const named = (family) => family === 'type'
  ? 'type (--text-<style>-size, -line-height, -letter-spacing)'
  : `${family} (${[...new Set(tokens[family].tokens.map(({ name }) => name.split('-')[0]))].map((prefix) => `${prefix}-*`).join(', ')})`;
const advice = ({ kind, property, operand, product }) => {
  if (kind === 'color') return 'try a color token';
  if (product) return 'a product of numbers makes a new value: scale a token once, or add a token';
  if (property.startsWith('--')) return 'make it a calc() of tokens, or add a token';
  const families = FAMILIES.find(([pattern]) => pattern.test(property))?.[1];
  const look = families ? `try ${families.map(named).join(' or ')}` : 'try a token';
  return operand ? `this factor makes a new value, which is a choice: ${look}` : look;
};

/** A number and its unit, so `.5px` and `0.5px` are one literal. */
const reading = (text) => {
  const match = NUMBER.exec(text);
  return match && { value: Number(match[1]), unit: match[2].toLowerCase() };
};
const sameValue = (written, literal) => {
  if (literal.kind === 'color') return written.toLowerCase() === literal.text.toLowerCase();
  if (written === '0') return literal.value === 0;
  const want = reading(written);
  return !!want && literal.value === want.value && literal.unit === want.unit;
};
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wholeIn = (selector) => new RegExp(`${/^[\w-]/.test(selector) ? '(?<![\\w-])' : ''}${escape(selector)}(?![\\w-])`);

/** A rule's selector list split at its top-level commas, each without what its functional pseudo-classes hold. */
const parsed = new Map();
const selectorList = (prelude) => {
  if (parsed.has(prelude)) return parsed.get(prelude);
  const list = [''];
  const skip = /:[\w-]+\(/iy;
  for (let i = 0, depth = 0; i < prelude.length; i++) {
    skip.lastIndex = i;
    if (skip.test(prelude)) {
      let open = 1;
      for (i = skip.lastIndex; open && i < prelude.length; i++) open += prelude[i] === '(' ? 1 : prelude[i] === ')' ? -1 : 0;
      i--;
      continue;
    }
    const c = prelude[i];
    if (c === '"' || c === "'") {
      const end = prelude.indexOf(c, i + 1);
      list[list.length - 1] += prelude.slice(i, end === -1 ? undefined : end + 1);
      i = end === -1 ? prelude.length : end;
      continue;
    }
    depth += '(['.includes(c) ? 1 : ')]'.includes(c) ? -1 : 0;
    if (c === ',' && depth === 0) list.push('');
    else list[list.length - 1] += c;
  }
  parsed.set(prelude, list);
  return list;
};
/** Whether a rule in the literal's chain has one of the selectors in every selector of its list. */
const scopedBy = (patterns, { chain }) => chain.some((prelude) => !prelude.startsWith('@')
  && selectorList(prelude).every((selector) => patterns.some((pattern) => pattern.test(selector))));

const listing = [];
if (!Array.isArray(entries)) listing.push(`${LIST} is a list of entries`);
const rules = (Array.isArray(entries) ? entries : []).map((entry, index) => {
  const reason = typeof entry.reason === 'string' ? entry.reason.trim() : '';
  const name = `${LIST}: entry ${index + 1} (${reason ? reason.replace(/^(.{50}).+$/, '$1…') : JSON.stringify(entry)})`;
  if (!reason) listing.push(`${name} has no reason. Say why the value needs no token.`);
  const before = listing.length;
  for (const key of Object.keys(entry)) if (key !== 'reason' && !FIELDS.includes(key)) listing.push(`${name} has a field the gate doesn't know: ${key}. The fields are reason, ${FIELDS.slice(0, -1).join(', ')} and ${FIELDS.at(-1)}.`);
  const lists = FIELDS.filter((key) => key !== 'operand' && key in entry);
  for (const key of lists) if (!Array.isArray(entry[key]) || !entry[key].length || entry[key].some((item) => typeof item !== 'string')) listing.push(`${name}: ${key} is a list of strings`);
  if ('operand' in entry && !['factor', 'divisor'].includes(entry.operand)) listing.push(`${name}: operand is "factor" or "divisor"`);
  if (!lists.length && !('operand' in entry)) listing.push(`${name} lists no ${FIELDS.slice(0, -1).join(', ')} or ${FIELDS.at(-1)}, so it would take every number`);
  // An entry the gate can't read takes nothing, so a typo in a field can't widen what it lets through.
  if (listing.length > before) return { entry, name, taken: null, takes: () => false };
  const selectors = entry.selectors?.map(wholeIn);
  return {
    entry, name, taken: [],
    takes: (literal) => (entry.values ? entry.values.some((value) => sameValue(value, literal)) : literal.kind === 'number')
      && (!entry.properties || entry.properties.includes(literal.property))
      && (!selectors || scopedBy(selectors, literal))
      && (!entry.functions || entry.functions.some((name) => name.toLowerCase() === literal.fn))
      && (!entry.operand || (entry.operand === 'factor' ? !!literal.operand : literal.operand === entry.operand)),
  };
});

const breakpoints = tokens.breakpoint.tokens.map(({ name, value }) => {
  const read = reading(value);
  if (read?.unit !== 'px' && read?.unit !== 'em') listing.push(`tokens/tokens.json: ${name} is ${value}; a breakpoint is in px, or in em for a text size`);
  return { name, value: read?.value, unit: read?.unit, taken: [] };
});
/** The token a query's number is: the same number in the same unit or, for px in a max-width or max-height, 0.02px less. */
const breakpointOf = ({ kind, unit, value, feature, property }) => kind === 'number' && !(unit === 'em' && property === '@container')
  ? breakpoints.find((token) => token.unit === unit && token.value === value)
    ?? (unit === 'px' && /^max-(width|height)$/.test(feature ?? '') ? breakpoints.find((token) => token.unit === 'px' && Math.abs(token.value - 0.02 - value) < 1e-6) : undefined)
  : undefined;

/** Comments, and unless `strings` is false, strings and url() contents, become spaces, so every offset keeps its line. */
const blank = (part) => part.replace(/[^\n]/g, ' ');
const mask = (text, strings = true) => {
  const quiet = text.replace(/\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\\n])*"?|'(?:\\[\s\S]|[^'\\\n])*'?/g, (part) => (strings || part[0] === '/' ? blank(part) : part));
  return strings ? quiet.replace(/(?<![\w-])(url\()([^)]*)\)/gi, (_, open, inner) => `${open}${blank(inner)})`) : quiet;
};

const literals = [];

/** Each literal in a value or prelude, with the function it sits in and the operator beside it. */
function scan(source, text, start, context) {
  const stack = [];
  let [previous, beforeOperator, lastWasNumber] = [null, false, false];
  TOKEN.lastIndex = 0;
  for (let match = TOKEN.exec(text); match; match = TOKEN.exec(text)) {
    const { fn, close, hex, num, unit } = match.groups;
    const at = start + match.index;
    const functions = stack.filter(Boolean);
    const found = (literal) => literals.push({ ...context, ...literal, line: context.lineAt(at), fn: functions.at(-1) ?? null });
    if (fn && COLOR.test(fn)) {
      let [depth, end] = [1, TOKEN.lastIndex];
      for (; depth && end < text.length; end++) depth += text[end] === '(' ? 1 : text[end] === ')' ? -1 : 0;
      found({ kind: 'color', text: source.slice(at, start + end).replace(/\s+/g, ' ') });
      TOKEN.lastIndex = end;
      [previous, beforeOperator, lastWasNumber] = [')', lastWasNumber, false];
      continue;
    }
    if (match[0].endsWith('(')) stack.push((fn ?? '').toLowerCase());
    else if (close) stack.pop();
    else if (hex) found({ kind: 'color', text: hex });
    else if (num) {
      // A factor scales a token: a bare number across the * or / makes a new number, which is a choice.
      const rest = text.slice(TOKEN.lastIndex);
      const ofNumber = previous === '*' || previous === '/' ? beforeOperator : /^\s*\*\s*[+-]?\.?\d/.test(rest);
      const inMath = !unit && functions.some((name) => MATH.has(name));
      const operand = inMath && !ofNumber ? (previous === '/' ? 'divisor' : previous === '*' || /^\s*\*/.test(rest) ? 'factor' : null) : null;
      const feature = context.property.startsWith('@') ? /([\w-]+)\s*:\s*$/.exec(text.slice(0, match.index))?.[1] : undefined;
      found({ kind: 'number', text: match[0], value: Number(num), unit: (unit ?? '').toLowerCase(), operand, product: inMath && ofNumber, feature });
    }
    if (!/^\s+$/.test(match[0])) [previous, beforeOperator, lastWasNumber] = [match[0], lastWasNumber, !!num];
  }
}

/** Rules, at-rules and declarations, nested to any depth: a prelude ends at {, a declaration at ; or }. */
function walk(file, source) {
  const text = mask(source);
  const shown = mask(source, false);
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  const lineAt = (offset) => {
    let [low, high] = [0, starts.length - 1];
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (starts[middle] <= offset) low = middle; else high = middle - 1;
    }
    return low + 1;
  };
  const prelude = (from, to) => shown.slice(from, to).trim().replace(/\s+/g, ' ');

  const declaration = (from, to, chain) => {
    const part = text.slice(from, to);
    const colon = part.indexOf(':');
    const at = /^\s*@([\w-]+)/.exec(part);
    if (at) {
      const keyword = at[1].toLowerCase();
      if (!['import', 'charset', 'layer'].includes(keyword)) scan(source, part.slice(at[0].length), from + at[0].length, { file, lineAt, chain: [...chain, prelude(from, to)], property: `@${keyword}` });
      return;
    }
    if (colon === -1) return;
    const name = part.slice(0, colon).trim();
    const property = name.startsWith('--') ? name : name.toLowerCase();
    scan(source, part.slice(colon + 1), from + colon + 1, { file, lineAt, chain, property });
  };

  const block = (i, chain) => {
    let from = i;
    while (i < text.length) {
      const c = text[i];
      if (c === '{') {
        const head = prelude(from, i);
        const at = /^@([\w-]+)/.exec(head)?.[1].toLowerCase();
        if (at === 'media' || at === 'container' || at === 'supports') {
          const after = text.indexOf('@', from) + at.length + 1;
          scan(source, text.slice(after, i), after, { file, lineAt, chain: [...chain, head], property: `@${at}` });
        }
        i = block(i + 1, [...chain, head]);
        from = i;
      } else if (c === ';' || c === '}') {
        declaration(from, i, chain);
        if (c === '}') return i + 1;
        from = ++i;
      } else i++;
    }
    declaration(from, i, chain);
    return i;
  };
  block(0, []);
}

const files = readdirSync('registry', { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.css')).sort();
let read = 0;
for (const file of files) {
  const source = readFileSync(`registry/${file}`, 'utf8');
  if (source.split('\n', 1)[0].includes(GENERATED)) continue;
  read++;
  walk(`registry/${file}`, source);
}

const where = ({ file, line, chain, property, text }) => `${file}:${line}  ${chain.at(-1) ?? '(top level)'}  ${property}  ${text}`;
const outside = [];
for (const literal of literals) {
  if (QUERIES.has(literal.property)) {
    const token = breakpointOf(literal);
    if (token) token.taken.push(literal);
    else if (literal.unit === 'em' && literal.property === '@container' && breakpoints.some((bp) => bp.unit === 'em' && bp.value === literal.value)) outside.push(`${where(literal)}: an em breakpoint is for @media and @custom-media, where em is the browser's text size. In @container, em is the container's font size.`);
    else outside.push(`${where(literal)}: not a breakpoint value. Use one from the breakpoint family in tokens/tokens.json, in its unit (a px one 0.02px less in a max-width or max-height), or add one there.`);
    continue;
  }
  const rule = rules.find((candidate) => candidate.takes(literal));
  if (rule) rule.taken.push(literal);
  else outside.push(`${where(literal)}: ${advice(literal)}`);
}
const stale = rules.filter(({ taken }) => taken?.length === 0).map(({ name }) => `${name} matches nothing in registry/ that an earlier entry doesn't take, so take it off`);

if (process.argv.includes('--report')) {
  const tally = (taken) => Object.entries(Object.groupBy(taken, ({ text, property }) => `${text} ${property}`))
    .sort((a, b) => b[1].length - a[1].length).map(([key, { length }]) => `${key}×${length}`).join(', ');
  for (const [index, { entry, taken }] of rules.entries()) if (taken) console.log(`${String(taken.length).padStart(5)}  entry ${index + 1}: ${entry.reason}\n       ${tally(taken)}`);
  for (const { name, taken } of breakpoints) console.log(`${String(taken.length).padStart(5)}  ${name}: ${tally(taken)}`);
}
const problems = [...listing, ...outside, ...stale];
if (problems.length) {
  const hint = outside.length ? ' A number or color in registry CSS comes from a token in tokens/tokens.json or a calc() of tokens. One that can be neither needs an entry in tokens/literal-exceptions.json with its reason.' : '';
  console.error(`check-literals: ${problems.length} problem(s).${hint}\n${problems.map((problem) => `  ${problem}`).join('\n')}`);
  process.exit(1);
}
const atBreakpoints = breakpoints.reduce((sum, { taken }) => sum + taken.length, 0);
console.log(`check-literals: ${literals.length} literals in ${read} files: ${literals.length - atBreakpoints} under ${rules.length} exceptions, ${atBreakpoints} at breakpoints`);
