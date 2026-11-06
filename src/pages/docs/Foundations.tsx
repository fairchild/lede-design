import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { RouterLink } from '@/router-link';
import { PageHeader } from '@lede/blocks/page-header';
import { Disclosure } from '@lede/disclosure';
import source from '../../../tokens/tokens.json';

type Value = string | Record<string, string>;
interface Token { name: string; value: Value; usage?: string; group?: string; reducedMotion?: string }
interface Family { note?: string; options?: string[]; tokens: Token[] }
interface Style { name: string; fontSize: Value; lineHeight: Value; fontWeight: number | Record<string, number>; sample: string }
interface Tokens {
  color: { themes: { id: string }[]; groups: { id: string; name: string; note: string }[]; tokens: Token[] };
  type: { note?: string; groups: { styles: Style[] }[] };
}

const tokens = source as unknown as Tokens & Record<string, unknown>;
const isFamily = (value: unknown): value is Family => typeof value === 'object' && value !== null && Array.isArray((value as Family).tokens);
const families = Object.entries(tokens).filter((entry): entry is [string, Family] => entry[0] !== 'color' && isFamily(entry[1]));
const colors = tokens.color.tokens;
const styles = tokens.type.groups.flatMap((g) => g.styles);

/** Token usage notes mark names with backticks. */
const Usage = ({ text = '' }: { text?: string }) => <>{text.split(/`([^`]+)`/).map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))}</>;
/** A keyed value in one option, or in the first when none is named; a plain value as it is. */
const valueIn = <T,>(value: T | Record<string, T>, option?: string): T =>
  typeof value === 'object' && value !== null ? (value as Record<string, T>)[option ?? Object.keys(value)[0]] : (value as T);
const px = (rem: string) => Number.parseFloat(rem) * 16;
const sentences = (note = '') => note.split(/(?<=\.)\s+/);
const title = (name: string) => name[0].toUpperCase() + name.slice(1);

/** For the Overview's card: color and type, then every other family this page lists. */
export const tokenFamilies = { count: 2 + families.length, summary: `Color in ${tokens.color.themes.length} themes, type and ${families.length} more token families.` };

const sizes = styles.map((s) => px(valueIn(s.fontSize)));
const typeSummary = `${styles.length} styles, ${Math.min(...sizes)}px to ${Math.max(...sizes)}px at the default text size, in rem so the browser’s text size scales them`;

// Families worth drawing: a bar as wide as the value, a corner that round, a card with that shadow. Each reads the live
// property, so the Appearance controls move it.
const bar = { className: 'block h-3 rounded-xs bg-primary', style: (name: string): CSSProperties => ({ width: `var(--${name})`, maxWidth: '100%' }) };
const PREVIEW: Record<string, { className: string; style: (name: string) => CSSProperties }> = {
  spacing: bar,
  size: bar,
  radius: { className: 'block bg-primary', style: (name) => ({ width: 44, height: 28, borderRadius: `var(--${name})` }) },
  // The outline marks the card where a theme has no shadow (-hc).
  shadow: { className: 'block bg-card', style: (name) => ({ width: 44, height: 28, borderRadius: 'var(--radius-xs)', boxShadow: `var(--${name})`, outline: '0.5px solid var(--border)' }) },
};

/** A table wider than its box scrolls sideways there, as Lede's Table does: a named region the keyboard can reach. */
function Scroll({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    const box = ref.current!;
    const observer = new ResizeObserver(() => setOverflowing(box.scrollWidth > box.clientWidth));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="docs-table-scroll" {...(overflowing ? { role: 'region', tabIndex: 0, 'aria-label': label } : {})}>{children}</div>;
}

function FamilyTable({ name, family }: { name: string; family: Family }) {
  const options = family.options && family.tokens.some((t) => typeof t.value !== 'string') ? family.options : null;
  const reduced = family.tokens.some((t) => t.reducedMotion);
  const preview = PREVIEW[name];
  return (
    <Scroll label={`${title(name)} tokens`}>
      <table className="docs-table docs-table-wide">
        <thead>
          <tr>
            <th scope="col">Token</th>
            {(options ?? ['value']).map((option) => <th key={option} scope="col">{title(option)}</th>)}
            {reduced ? <th scope="col">Reduced motion</th> : null}
            {preview ? <th scope="col">Now</th> : null}
            <th scope="col">Usage</th>
          </tr>
        </thead>
        <tbody>
          {family.tokens.map((t) => (
            <tr key={t.name}>
              <th scope="row"><code>--{t.name}</code></th>
              {(options ?? [undefined]).map((option) => (
                // A value keyed by theme, as a shadow's is, shows in Now.
                <td key={option ?? 'value'}>{option || typeof t.value === 'string' ? <code>{valueIn(t.value, option)}</code> : 'Per theme'}</td>
              ))}
              {reduced ? <td>{t.reducedMotion ? <code>{t.reducedMotion}</code> : null}</td> : null}
              {preview ? <td><span className={preview.className} style={preview.style(t.name)} /></td> : null}
              <td><Usage text={t.usage} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Scroll>
  );
}

export function Foundations() {
  return (
    <div className="ld-flow">
      <PageHeader
        title="Foundations"
        summary={`${colors.length} color tokens × ${tokens.color.themes.length} themes, ${styles.length} type styles and ${families.length} more token families`}
      />
      <p className="docs-intro">
        The four themes are <code>light</code>, <code>dark</code> and their high-contrast versions, <code>light-hc</code> and{' '}
        <code>dark-hc</code>. The tables call the high-contrast pair -hc.
      </p>
      {tokens.color.groups.map((group, i) => {
        const list = colors.filter((t) => t.group === group.id);
        return (
          <Disclosure key={group.id} title={group.name} summary={group.note} meta={String(list.length)} defaultOpen={i === 0} headingLevel={2}>
            <Scroll label={group.name}>
              <table className="docs-table docs-table-wide">
                <caption>Swatches show the current theme. Change it with Automatic, Light or Dark at the foot of the sidebar or page, or in the demo app’s <RouterLink href="/app/settings/appearance">Settings → Appearance</RouterLink>.</caption>
                <thead><tr><th scope="col">Swatch</th><th scope="col">Token</th><th scope="col">Usage</th></tr></thead>
                <tbody>
                  {list.map((t) => (
                    <tr key={t.name}>
                      <td><span className="docs-swatch" style={{ background: `var(--${t.name})` }} /></td>
                      <th scope="row"><code>--{t.name}</code></th>
                      <td><Usage text={t.usage} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroll>
          </Disclosure>
        );
      })}
      <Disclosure title="Type" summary={typeSummary} meta={String(styles.length)} headingLevel={2}>
        <p className="docs-intro"><Usage text={tokens.type.note} /></p>
        <Scroll label="Type styles">
          <table className="docs-table">
            <thead><tr><th scope="col">Style</th><th scope="col">Sample</th></tr></thead>
            <tbody>
              {styles.map((s) => {
                const [size, line] = [valueIn(s.fontSize), valueIn(s.lineHeight)];
                return (
                  <tr key={s.name}>
                    <th scope="row">
                      <code>.text-{s.name}</code><br />
                      <span className="text-caption-1">{px(size)}/{px(line)}px · {valueIn(s.fontWeight)} · {size}/{line}</span>
                    </th>
                    <td><p className={`docs-type-sample text-${s.name}`}>{s.sample}</p></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Scroll>
      </Disclosure>
      {families.map(([name, family]) => {
        const [summary, ...rest] = sentences(family.note);
        return (
          <Disclosure key={name} title={title(name)} summary={summary ? <Usage text={summary} /> : undefined} meta={String(family.tokens.length)} headingLevel={2}>
            {rest.length ? <p className="docs-intro"><Usage text={rest.join(' ')} /></p> : null}
            <FamilyTable name={name} family={family} />
            {name === 'radius' ? (
              <>
                <p className="docs-intro">Change Corners in Appearance and the whole chain moves.</p>
                <div className="docs-concentric" aria-hidden="true"><div><div><div /></div></div></div>
              </>
            ) : null}
          </Disclosure>
        );
      })}
    </div>
  );
}
