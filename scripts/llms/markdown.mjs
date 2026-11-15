// Turns a docs page's static HTML, rendered for the Markdown build, into Markdown. Turndown does the elements HTML
// shares with Markdown; the rules here cover Lede's own markup (Disclosure, CodeExample, SummaryCard, tables, Decisions'
// lists) and the links. A control left in the page fails the build: live examples belong in <Live>.
import TurndownService from 'turndown';
import { cell } from '../item-docs.mjs';

export const SITE = 'https://lede.cloudcompute.com';
const REPO = 'https://github.com/fairchild/lede-design';
const RAW = 'https://raw.githubusercontent.com/fairchild/lede-design';
/** CodeExample's languages, as fences name them. */
const FENCE = { shell: 'bash', tsx: 'tsx', css: 'css', json: 'json', html: 'html' };

/**
 * A docs route's Markdown file: `/components` is `/components.md`, and `/` is `/overview.md`, since OKF reserves
 * `index.md` for a directory's index.
 */
export const twinPath = (route) => (route === '/' ? '/overview.md' : `${route}.md`);

/** A fenced code block, with a fence longer than any run of backticks in the code. */
export const fence = (code, language) => {
  const ticks = '`'.repeat(Math.max(3, ...[...code.matchAll(/`{3,}/g)].map((m) => m[0].length + 1)));
  return `${ticks}${language}\n${code.replace(/\n$/, '')}\n${ticks}`;
};
const text = (node) => node?.textContent.replace(/\s+/g, ' ').trim() ?? '';

/**
 * Where a link points in Markdown: a docs route at its Markdown file, a site path at the site, and a Markdown file on
 * GitHub at its raw text. Other links stay as they are. A docs page's Markdown has no element ids, so a link to it
 * drops its fragment.
 */
export function linkTarget(href, routes) {
  const local = href.startsWith('/') ? href : href === SITE || href.startsWith(`${SITE}/`) ? href.slice(SITE.length) || '/' : null;
  if (local !== null) {
    const [path, hash = ''] = local.split(/(?=#)/);
    return routes.has(path) ? `${SITE}${twinPath(path)}` : `${SITE}${path}${hash}`;
  }
  if (href === REPO || href.startsWith(`${REPO}#`)) return `${RAW}/main/README.md`;
  const file = href.match(/^https:\/\/github\.com\/fairchild\/lede-design\/blob\/([^/]+)\/([^#?]+\.md)(?:[#?].*)?$/);
  return file ? `${RAW}/${file[1]}/${file[2]}` : href;
}

/** Elements a reader acts on. Only a Disclosure's own trigger may stay in a page's Markdown build. */
const CONTROL = /^(?:INPUT|SELECT|TEXTAREA|BUTTON|DETAILS|SUMMARY|IFRAME|OBJECT|EMBED|VIDEO|AUDIO|CANVAS)$/;
const CONTROL_ROLE = /^(?:button|switch|checkbox|radio|slider|spinbutton|textbox|searchbox|combobox|listbox|option|tab|tablist|menuitem|menuitemcheckbox|menuitemradio)$/;
const isControl = (node) => {
  if (node.classList?.contains('ld-disc-head')) return false;
  const role = node.getAttribute?.('role') ?? '';
  // A separator that takes focus is a window splitter, which a reader drags.
  return CONTROL.test(node.nodeName) || CONTROL_ROLE.test(role) || (role === 'separator' && node.hasAttribute('tabindex'));
};

/** The page, the section and the element, so a failure says where to look. */
function describe(node, route) {
  const section = node.closest('section');
  const heading = section && text(section.querySelector('h1, h2, h3, h4, h5, h6'));
  const tag = node.nodeName.toLowerCase();
  const attributes = ['type', 'role', 'name', 'aria-label'].filter((a) => node.hasAttribute(a)).map((a) => ` ${a}="${node.getAttribute(a)}"`).join('');
  const label = text(node.closest('label') ?? node).slice(0, 60);
  return `${route}: <${tag}${attributes}>${label ? ` "${label}"` : ''} is left in the Markdown build${heading ? `, in "${heading}"` : ''}. Wrap the live example in <Live> (src/pages/docs/twin.tsx).`;
}

/** Markdown without its fenced code, indented fences in list items included, so a `# comment` reads as no heading. */
export const withoutCode = (markdown) => markdown.replace(/^ *(`{3,})[^\n]*\n[\s\S]*?^ *\1[ \t]*$/gm, '');

/** Fails on a page whose Markdown doesn't open with its one h1 or skips a heading level, naming the heading. */
export function checkHeadings(markdown, route) {
  const prose = withoutCode(markdown);
  if (!markdown.startsWith('# ')) throw new Error(`${route}: the Markdown starts with ${JSON.stringify(markdown.slice(0, 60))}, where its h1 belongs`);
  let previous = 0;
  // A heading may sit up to three spaces in, as in a list item.
  for (const [line, hashes] of prose.matchAll(/^ {0,3}(#{1,6}) .*$/gm)) {
    const level = hashes.length;
    if (level === 1 && previous) throw new Error(`${route}: a second h1, "${line}"`);
    if (level > previous + 1) throw new Error(`${route}: "${line}" is an h${level} after an h${previous}`);
    previous = level;
  }
}

/** @param {Set<string>} routes the docs routes that have a Markdown file */
export function createConverter(routes) {
  let route = '';
  const td = new TurndownService({
    headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '_', hr: '---',
    // Turndown gives an element with no text to this before any rule, so an icon-only button is checked here.
    blankReplacement: (_content, node) => {
      if (isControl(node)) throw new Error(describe(node, route));
      return node.isBlock ? '\n\n' : '';
    },
  });
  const inline = (node) => (node ? td.turndown(node.innerHTML).replace(/\s*\n\s*/g, ' ').trim() : '');

  td.remove(['svg', 'style', 'script']);
  // CodeExample: a Disclosure whose body is <pre data-language>. Its title labels the fence.
  td.addRule('codeExample', {
    filter: (node) => node.nodeName === 'SECTION' && node.classList.contains('docs-code-example'),
    replacement: (_content, node) => {
      const label = text(node.querySelector('.ld-disc-title'));
      const pre = node.querySelector('pre');
      const language = FENCE[pre.getAttribute('data-language')];
      if (!language) throw new Error(`${route}: the code example "${label}" has no language Markdown knows: ${pre.getAttribute('data-language')}`);
      return `\n\n${label}:\n\n${fence(pre.textContent, language)}\n\n`;
    },
  });
  // Disclosure: its heading at its level, then the summary and meta, then the body, which the markup holds even closed.
  td.addRule('disclosureHeading', {
    filter: (node) => node.classList?.contains('ld-disc-heading'),
    replacement: (_content, node) => {
      const summary = inline(node.querySelector('.ld-disc-summary'));
      const meta = inline(node.querySelector('.ld-disc-meta'));
      return `\n\n${'#'.repeat(Number(node.nodeName[1]))} ${inline(node.querySelector('.ld-disc-title'))}\n\n${summary ? `${summary}${meta ? ` (${meta})` : ''}\n\n` : ''}`;
    },
  });
  // SummaryCard: one line, its linked title, then its figure, takeaway and status.
  td.addRule('summaryCard', {
    filter: (node) => node.classList?.contains('ld-summary-card'),
    replacement: (_content, node) => {
      const parts = ['.ld-summary-figure', '.ld-summary-text', '.ld-status'].map((s) => inline(node.querySelector(s))).filter(Boolean);
      return `${inline(node.querySelector('.ld-summary-title'))}: ${parts.map((p) => p.replace(/[.\s]*$/, '')).join('. ')}.`;
    },
  });
  // Decisions' Why, Cost and Held by; Layouts' regions.
  td.addRule('term', { filter: 'dt', replacement: (content) => `\n\n**${content.trim()}**\n\n` });
  td.addRule('definition', { filter: 'dd', replacement: (content) => `\n\n${content.trim()}\n\n` });
  td.addRule('listItem', {
    filter: 'li',
    replacement: (content, node) => {
      const parent = node.parentNode;
      const marker = parent.nodeName === 'OL' ? `${Array.prototype.indexOf.call(parent.children, node) + 1}. ` : '- ';
      const body = content.replace(/^\n+/, '').replace(/\n+$/, '\n').replace(/\n/gm, `\n${' '.repeat(marker.length)}`);
      return marker + body + (node.nextSibling && !/\n$/.test(body) ? '\n' : '');
    },
  });
  td.addRule('link', {
    filter: (node) => node.nodeName === 'A' && node.getAttribute('href'),
    replacement: (content, node) => {
      const href = linkTarget(node.getAttribute('href'), routes);
      return `[${content.trim() || href}](${href})`;
    },
  });
  // A GFM table, with its caption as a paragraph above it.
  td.addRule('table', {
    filter: 'table',
    replacement: (_content, node) => {
      const rows = Array.from(node.querySelectorAll('tr')).map((tr) => Array.from(tr.children).map((c) => cell(inline(c))));
      const line = (row) => `| ${row.join(' | ')} |`;
      const caption = node.querySelector('caption');
      return `\n\n${caption ? `${inline(caption)}\n\n` : ''}${line(rows[0])}\n| ${rows[0].map(() => '---').join(' | ')} |\n${rows.slice(1).map(line).join('\n')}\n\n`;
    },
  });
  td.addRule('hidden', { filter: (node) => node.getAttribute?.('aria-hidden') === 'true', replacement: () => '' });
  // PageHeader's back link sits above the h1; the page's links say where it belongs.
  td.addRule('back', { filter: (node) => node.classList?.contains('ld-back'), replacement: () => '' });
  // Added last, so turndown, which tries the newest rule first, checks each element with text for it before any other
  // rule. An element without text goes to blankReplacement instead.
  td.addRule('control', {
    filter: (node) => isControl(node),
    replacement: (_content, node) => { throw new Error(describe(node, route)); },
  });

  return (html, page) => {
    route = page;
    return td.turndown(html).replace(/\n{3,}/g, '\n\n').trim();
  };
}
