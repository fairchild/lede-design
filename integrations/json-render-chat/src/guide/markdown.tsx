import * as React from 'react';
import { Button } from '@/components/lede/button';
import { Table } from '@/components/lede/table';

// The guide's pages draw README.md's own sections, so the page and the file it renders can't say different things.
// This reads the Markdown that file uses: headings, paragraphs, numbered and bulleted lists whose items hold more
// blocks, fenced code and tables, with code spans, bold and links inside them.

export type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'list'; ordered: boolean; items: Block[][] }
  | { kind: 'table'; head: string[]; rows: string[][] };

/** Where a link in README.md points from a page: its own path in the repo on GitHub. */
export const REPO = 'https://github.com/fairchild/lede-design/blob/main/integrations/json-render-chat';

/** The body of a `## title` section, up to the next `## ` heading. */
export function section(markdown: string, title: string): string {
  const start = markdown.split('\n').findIndex((line) => line === `## ${title}`);
  if (start < 0) throw new Error(`README.md has no “## ${title}” section.`);
  const rest = markdown.split('\n').slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  return rest.slice(0, end < 0 ? undefined : end).join('\n');
}

const STARTS = /^(`{3,}|#{2,6} |\||(\d+\.|-) )/;

export function parse(markdown: string): Block[] {
  const lines = markdown.split('\n');
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^(`{3,})(\w*)\s*$/);
    const heading = line.match(/^(#{2,6}) (.*)$/);
    const item = line.match(/^(\d+\.|-) /);
    if (!line.trim()) i++;
    else if (fence) {
      const end = lines.findIndex((l, j) => j > i && l.trim() === fence[1]);
      const stop = end < 0 ? lines.length : end;
      out.push({ kind: 'code', lang: fence[2], code: lines.slice(i + 1, stop).join('\n') });
      i = stop + 1;
    } else if (heading) {
      out.push({ kind: 'heading', level: heading[1].length, text: heading[2] });
      i++;
    } else if (line.startsWith('|')) {
      const rows: string[][] = [];
      for (; i < lines.length && lines[i].startsWith('|'); i++) {
        if (/^\|[\s|:-]+\|$/.test(lines[i])) continue;
        rows.push(lines[i].slice(1, -1).split(' | ').map((cell) => cell.trim()));
      }
      out.push({ kind: 'table', head: rows[0] ?? [], rows: rows.slice(1) });
    } else if (item) {
      const ordered = item[1] !== '-';
      const items: Block[][] = [];
      for (let m: RegExpMatchArray | null = item; m && (m[1] !== '-') === ordered; m = lines[i]?.match(/^(\d+\.|-) /) ?? null) {
        const indent = ' '.repeat(m[0].length);
        const body = [lines[i].slice(indent.length)];
        for (i++; i < lines.length && (!lines[i].trim() || lines[i].startsWith(indent)); i++) body.push(lines[i].slice(indent.length));
        items.push(parse(body.join('\n')));
      }
      out.push({ kind: 'list', ordered, items });
    } else {
      const text: string[] = [];
      for (; i < lines.length && lines[i].trim() && (text.length === 0 || !STARTS.test(lines[i])); i++) text.push(lines[i].trim());
      out.push({ kind: 'p', text: text.join(' ') });
    }
  }
  return out;
}

/** Curly quotes outside code, as the site writes README prose. */
const curly = (text: string) => text.replace(/(^|[\s(])"/g, '$1“').replace(/"/g, '”').replace(/'/g, '’');

const href = (to: string) => (/^([a-z]+:|#)/i.test(to) ? to : `${REPO}/${to}`);

/** A line's code spans, then its links and bold, as React nodes. */
export function inline(text: string): React.ReactNode[] {
  const codes: string[] = [];
  // A code span opens and closes with the same run of backticks, and one space inside each end is dropped.
  const held = text.replace(/(`+)(.+?)\1(?!`)/g, (_, _ticks: string, code: string) => {
    codes.push(/^ .* $/.test(code) ? code.slice(1, -1) : code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  const nodes = (part: string, key: string): React.ReactNode[] =>
    part.split(/(\[[^\]]+\]\([^)\s]+\)|\*\*.+?\*\*|\u0000\d+\u0000)/).filter(Boolean).map((piece, i) => {
      const k = `${key}.${i}`;
      const link = piece.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (link) return <a key={k} href={href(link[2])}>{nodes(link[1], k)}</a>;
      if (/^\*\*.+\*\*$/.test(piece)) return <strong key={k}>{nodes(piece.slice(2, -2), k)}</strong>;
      const code = piece.match(/^\u0000(\d+)\u0000$/);
      if (code) return <code key={k}>{codes[Number(code[1])]}</code>;
      return curly(piece);
    });
  return nodes(held, 'i');
}

/** Code with a caption and a Copy button, which says when the text is on the clipboard. */
export function CodeBlock({ code, label }: { code: string; label: string }) {
  const id = React.useId();
  const [said, setSaid] = React.useState('');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setSaid('Copied.');
    } catch {
      setSaid('Couldn’t copy. Select the text and copy it.');
    }
  };
  return (
    <figure className="jrc-code" aria-labelledby={id}>
      <div className="jrc-code-head">
        <figcaption id={id}>{label}</figcaption>
        <span role="status" className="jrc-code-said">{said}</span>
        <Button size="sm" onClick={copy} aria-describedby={id}>Copy</Button>
      </div>
      <pre><code>{code}</code></pre>
    </figure>
  );
}

/** Code with a caption, for reading only. */
export const Code = ({ code, label }: { code: string; label: string }) => {
  const id = React.useId();
  return (
    <figure className="jrc-code" aria-labelledby={id}>
      <figcaption id={id} className="jrc-code-head">{label}</figcaption>
      <pre><code>{code}</code></pre>
    </figure>
  );
};

const plain = (text: string) => text.replace(/\*\*|`/g, '').replace(/\.$/, '');

interface MarkdownProps {
  blocks: Block[];
  /** What a code block or table outside a numbered step is called, such as the section's title. */
  label: string;
  /** Added to each heading's level: README's `###` under a page's h1 is an h2, so -1. */
  shift?: number;
  /** Drawn at the end of each item of the first numbered list, by its number. */
  afterStep?: (n: number) => React.ReactNode;
}

/** README.md's blocks as the page's HTML, with Lede's Button and Table. */
export function Markdown({ blocks, label, shift = -1, afterStep }: MarkdownProps) {
  const first = blocks.findIndex((b) => b.kind === 'list' && b.ordered);
  return <>{blocks.map((block, i) => <BlockView key={i} block={block} label={label} shift={shift} afterStep={i === first ? afterStep : undefined} />)}</>;
}

function BlockView({ block, label, shift, afterStep }: { block: Block; label: string; shift: number; afterStep?: (n: number) => React.ReactNode }) {
  switch (block.kind) {
    case 'heading': {
      const H = `h${Math.min(6, Math.max(2, block.level + shift))}` as 'h2';
      return <H>{inline(block.text)}</H>;
    }
    case 'p':
      return <p>{inline(block.text)}</p>;
    case 'code':
      return <CodeBlock code={block.code} label={block.lang === 'bash' ? `${label} commands` : label} />;
    case 'table':
      return (
        <Table.Root aria-label={`${label}: ${plain(block.head[0] ?? '')}`}>
          <Table.Head>
            <Table.Row>{block.head.map((cell, i) => <Table.HeaderCell key={i}>{inline(cell)}</Table.HeaderCell>)}</Table.Row>
          </Table.Head>
          <Table.Body>
            {block.rows.map((row, r) => <Table.Row key={r}>{row.map((cell, i) => <Table.Cell key={i}>{inline(cell)}</Table.Cell>)}</Table.Row>)}
          </Table.Body>
        </Table.Root>
      );
    case 'list': {
      const L = block.ordered ? 'ol' : 'ul';
      return (
        <L className="jrc-md-list">
          {block.items.map((item, n) => (
            <li key={n}>
              <Markdown blocks={item} label={block.ordered ? `Step ${n + 1}` : label} shift={shift} />
              {afterStep?.(n + 1)}
            </li>
          ))}
        </L>
      );
    }
  }
}
