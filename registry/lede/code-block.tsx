import * as React from 'react';
import { cn } from './cn';

/** The eight ANSI colors. A bright color (90–97) shows as its plain one. */
export type AnsiColor = 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white';

/**
 * The token each ANSI color shows as, so every app's logs agree. Each one reads as text on `card` and `muted` in every
 * theme. A CodeBlock with `ansi` paints them through the `ld-ansi-<color>` classes.
 */
export const ANSI_TOKENS: Record<AnsiColor, string> = {
  black: '--muted-foreground',
  red: '--destructive',
  green: '--success',
  yellow: '--warning',
  blue: '--preset-blue',
  magenta: '--preset-pink',
  cyan: '--preset-teal',
  white: '--foreground',
};

const COLORS: AnsiColor[] = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];

/** A run of text and the ANSI styles it was written with. */
export interface AnsiSpan {
  text: string;
  color?: AnsiColor;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

type Style = Omit<AnsiSpan, 'text'>;
// CSI sequences (`ESC [ … letter`) and OSC sequences (`ESC ] … BEL` or `ESC ] … ESC \`), such as a terminal's links.
const ESCAPE = /\x1b\[([0-9;?]*)([A-Za-z])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;

function apply(style: Style, params: string): Style {
  const codes = params === '' ? [0] : params.split(';').map((n) => Number(n) || 0);
  let next = { ...style };
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i];
    if (c === 0) next = {};
    else if (c === 1) next.bold = true;
    else if (c === 2) next.dim = true;
    else if (c === 3) next.italic = true;
    else if (c === 4) next.underline = true;
    else if (c === 22) { next.bold = false; next.dim = false; }
    else if (c === 23) next.italic = false;
    else if (c === 24) next.underline = false;
    else if (c >= 30 && c <= 37) next.color = COLORS[c - 30];
    else if (c >= 90 && c <= 97) next.color = COLORS[c - 90];
    else if (c === 39) next.color = undefined;
    // 256-color and RGB colors have no token: the text keeps the block's color. Their arguments are skipped.
    else if (c === 38 || c === 48) i += codes[i + 1] === 5 ? 2 : codes[i + 1] === 2 ? 4 : 0;
  }
  return next;
}

/**
 * Splits text written with ANSI escape codes into styled runs. SGR codes set color, bold, dim, italic and underline;
 * background colors and every other escape are dropped, and the text stays.
 */
export function parseAnsi(text: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  let style: Style = {};
  let at = 0;
  const push = (t: string) => {
    if (!t) return;
    const last = spans[spans.length - 1];
    const same = last && last.color === style.color && !!last.bold === !!style.bold && !!last.dim === !!style.dim
      && !!last.italic === !!style.italic && !!last.underline === !!style.underline;
    if (same) last.text += t;
    else spans.push({ text: t, ...Object.fromEntries(Object.entries(style).filter(([, v]) => v)) });
  };
  for (const m of text.matchAll(ESCAPE)) {
    push(text.slice(at, m.index));
    at = m.index + m[0].length;
    if (m[2] === 'm') style = apply(style, m[1]);
  }
  push(text.slice(at));
  return spans;
}

export interface CodeBlockProps extends Omit<React.ComponentProps<'figure'>, 'children' | 'title'> {
  /** The code or log, as text. */
  children: string;
  /** Names the block in a caption above it, such as a file name or “Deploy log”. It also names the scroll area. */
  title?: React.ReactNode;
  /** Names the scroll area when there is no `title`, or when `title` is not a plain string. */
  label?: string;
  /** `'scroll'` keeps each line whole and scrolls sideways, and `'wrap'` breaks long lines. Default `'scroll'`. */
  overflow?: 'scroll' | 'wrap';
  /** Reads ANSI escape codes: colors show as the tokens in `ANSI_TOKENS`, and other codes are dropped. Default `false`. */
  ansi?: boolean;
  /**
   * Keeps the end in view as text arrives, for a log that streams. Scrolling up stops it, and scrolling back to the
   * end starts it again. Default `false`.
   */
  follow?: boolean;
}

/**
 * A `<figure>` holding a `<pre><code>` of code or a log, in the mono type on `muted`, with an optional
 * `<figcaption>`. It grows to `layout-code-max-height` and then scrolls. When its text overflows, the `<pre>` becomes
 * a named, focusable region, so a keyboard can scroll it. Other HTML attributes and `ref` go on the `<figure>`.
 */
export function CodeBlock({ children, title, label, overflow = 'scroll', ansi = false, follow = false, className, ...rest }: CodeBlockProps) {
  const captionId = React.useId();
  const pre = React.useRef<HTMLPreElement>(null);
  const [overflowing, setOverflowing] = React.useState(false);
  const atEnd = React.useRef(true);
  React.useLayoutEffect(() => {
    const el = pre.current!;
    const measure = () => setOverflowing(el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // New text: re-measure, and with `follow`, stay at the end if the reader was there.
  React.useLayoutEffect(() => {
    const el = pre.current!;
    setOverflowing(el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight);
    if (follow && atEnd.current) el.scrollTop = el.scrollHeight;
  }, [children, follow]);
  const onScroll = follow
    ? (e: React.UIEvent<HTMLPreElement>) => {
      const el = e.currentTarget;
      atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 2;
    }
    : undefined;
  const name = label ?? (typeof title === 'string' ? title : undefined);
  const region = overflowing
    ? { role: 'region', tabIndex: 0, ...(name ? { 'aria-label': name } : title ? { 'aria-labelledby': captionId } : { 'aria-label': 'Code' }) }
    : {};
  return (
    <figure {...rest} className={cn('ld-code', overflow === 'wrap' && 'ld-code-wrap', className)}>
      {title ? <figcaption id={captionId} className="ld-code-title">{title}</figcaption> : null}
      <pre ref={pre} className="ld-code-pre" onScroll={onScroll} {...region}>
        <code>
          {ansi
            ? parseAnsi(children).map((s, i) => (s.color || s.bold || s.dim || s.italic || s.underline ? (
              <span
                key={i}
                className={cn(
                  s.color && `ld-ansi-${s.color}`, s.bold && 'ld-ansi-bold', s.dim && 'ld-ansi-dim',
                  s.italic && 'ld-ansi-italic', s.underline && 'ld-ansi-underline',
                )}
              >
                {s.text}
              </span>
            ) : s.text))
            : children}
        </code>
      </pre>
    </figure>
  );
}
