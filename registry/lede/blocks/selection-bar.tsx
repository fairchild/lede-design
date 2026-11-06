import * as React from 'react';
import { flushSync } from 'react-dom';
import { GlassToolbar, GlassToolbarButton, GlassToolbarSeparator } from '../glass-bar';
import type { ToneSubset } from '../tone';

export interface SelectionAction {
  label: string;
  icon?: React.ReactNode;
  /** Default `'neutral'`. `'critical'` for destructive actions. */
  tone?: ToneSubset<'neutral' | 'critical'>;
  onSelect: () => void;
}
/** A noun in both forms, so counts read correctly, as in "1 work item" and "3 work items". */
export interface Noun { one: string; other: string; }
export interface SelectionBarProps {
  /** How many items are selected. `{ atLeast }` while an exact count is still arriving. The bar appears above zero. */
  count: number | { atLeast: number };
  noun: Noun;
  actions: SelectionAction[];
  /**
   * Done, or Escape inside the bar. Focus then returns to the control it came into the bar from, unless `onClear` moved
   * it or took that away.
   */
  onClear: () => void;
  /** A BCP 47 tag, such as `'en-US'`, for the count. Default: the browser's locale. */
  locale?: string;
}

/** The number alone: "3", or "1,000+" for a lower bound. */
function formatNumber(count: number | { atLeast: number }, locale?: string) {
  return typeof count === 'number' ? count.toLocaleString(locale) : `${count.atLeast.toLocaleString(locale)}+`;
}
/** "3 work items", or "1,000+ work items" for a lower bound, with the number in `locale` (default: the browser's). */
export function formatCount(count: number | { atLeast: number }, noun: Noun, locale?: string): string {
  return `${formatNumber(count, locale)} ${count === 1 ? noun.one : noun.other}`;
}

/**
 * Appears only when something is selected, at the point of use, and floats at the bottom on glass. The count is
 * also announced through a polite live region, so the bar's arrival is heard.
 */
export function SelectionBar(props: SelectionBarProps) {
  const n = typeof props.count === 'number' ? props.count : props.count.atLeast;
  const noun = props.count === 1 ? props.noun.one : props.noun.other;
  const label = `${formatCount(props.count, props.noun, props.locale)} selected`;
  const bar = React.useRef<HTMLDivElement>(null);
  // Where focus came into the bar from. Done returns focus there in the same task as the bar leaves, so no frame shows
  // it on <body>, unless `onClear` placed focus itself or took that control away.
  const origin = React.useRef<HTMLElement | null>(null);
  React.useLayoutEffect(() => { if (n === 0) origin.current = null; }, [n]);
  const enter = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) origin.current = e.relatedTarget instanceof HTMLElement ? e.relatedTarget : null;
  };
  const done = () => {
    const from = origin.current;
    origin.current = null;
    flushSync(props.onClear);
    const at = document.activeElement;
    if ((!at || at === document.body || bar.current?.contains(at)) && from?.isConnected) from.focus();
  };
  // Escape inside the bar is Done, and the screen's own Escape, such as a back link's, waits for the next press.
  const escape = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape' || e.repeat || e.defaultPrevented || e.nativeEvent.isComposing) return;
    e.preventDefault();
    done();
  };
  return (
    <>
      <p className="ld-sr-only" role="status" aria-live="polite">{n > 0 ? label : ''}</p>
      {n > 0 ? (
        <div ref={bar} className="ld-selection-bar" onFocus={enter} onKeyDown={escape}>
          <GlassToolbar aria-label={label}>
            <span className="ld-selection-count" aria-hidden="true">{formatNumber(props.count, props.locale)} <span className="ld-selection-noun">{noun} </span>selected</span>
            <GlassToolbarSeparator />
            {props.actions.map((a) => (
              <GlassToolbarButton key={a.label} icon={a.icon} onClick={a.onSelect} className={a.tone === 'critical' ? 'ld-bar-tool-critical' : undefined}>
                {a.label}
              </GlassToolbarButton>
            ))}
            <GlassToolbarSeparator />
            <GlassToolbarButton onClick={done}>Done</GlassToolbarButton>
          </GlassToolbar>
        </div>
      ) : null}
    </>
  );
}
