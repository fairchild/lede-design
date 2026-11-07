import * as React from 'react';
import { cn } from './cn';

export interface SegmentedOption { value: string; label: React.ReactNode; }
export interface SegmentedControlProps {
  /** The group's accessible name, rendered as a visually hidden `<legend>`. */
  label: string;
  options: Array<SegmentedOption | string>;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Form field name. Defaults to a generated id. */
  name?: string;
  size?: 'sm' | 'md';
  block?: boolean;
  disabled?: boolean;
  /** Every radio is `required`, so the group fails its native check until an option is chosen. */
  required?: boolean;
  /** An error or hint beside the control, by id. */
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  className?: string;
}

/**
 * A native `<fieldset>` of radio inputs: arrow keys, form submission and screen-reader semantics come from the browser.
 * It fits the width its container gives it, narrowing its labels' insets and then stacking them. An `auto` grid track
 * that holds it, or a flex item holding it without `min-width: 0`, gives it its labels' full width, so it can't fit.
 */
export function SegmentedControl(props: SegmentedControlProps) {
  const opts = props.options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const autoName = React.useId();
  const [inner, setInner] = React.useState(props.defaultValue ?? opts[0]?.value);
  const value = props.value !== undefined ? props.value : inner;
  const idx = Math.max(0, opts.findIndex((o) => o.value === value));
  const chosen = opts.some((o) => o.value === value);
  // The segments' nodes are keyed by value, so new values mean new nodes to observe.
  const values = opts.map((o) => o.value).join('\n');
  const setRef = React.useRef<HTMLFieldSetElement>(null);
  const placed = React.useRef<{ idx: number; box: string } | null>(null);
  // Segments share the width equally until a label needs more. Labels that don't fit side by side narrow their insets,
  // then stack. The thumb takes CSS's equal share while the segments are equal (as in server markup, before this
  // runs), and the checked segment's measured box otherwise. It slides only when the value changes; a resize or a new
  // font moves it at once.
  React.useLayoutEffect(() => {
    const set = setRef.current;
    const thumb = set?.querySelector<HTMLElement>('.ld-seg-thumb');
    // Without ResizeObserver (jsdom, for one), the thumb keeps CSS's equal share and the labels their insets.
    if (!set || !thumb || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => {
      delete set.dataset.fit;
      for (const fit of ['tight', 'stacked']) {
        if (set.scrollWidth <= set.clientWidth + 1) break;
        set.dataset.fit = fit;
      }
      const items = [...set.querySelectorAll<HTMLElement>('.ld-seg-item')];
      const item = items[idx];
      if (!item || thumb.hidden) return;
      const inset = thumb.offsetLeft;
      const share = (set.clientWidth - 2 * inset) / items.length;
      const equal = !set.dataset.fit && items.every((it, n) => Math.abs(it.offsetWidth - share) < 0.6 && Math.abs(it.offsetLeft - inset - n * share) < 0.6);
      const box = { x: item.offsetLeft - inset, y: item.offsetTop - thumb.offsetTop, w: item.offsetWidth, h: item.offsetHeight };
      const key = equal ? 'share' : Object.values(box).join(' ');
      if (placed.current?.idx === idx && placed.current.box === key) return;
      const slide = placed.current !== null && placed.current.idx !== idx;
      placed.current = { idx, box: key };
      if (!slide) thumb.style.transition = 'none';
      for (const [k, v] of Object.entries(box)) {
        if (equal) thumb.style.removeProperty(`--ld-seg-${k}`);
        else thumb.style.setProperty(`--ld-seg-${k}`, `${v}px`);
      }
      if (!slide) {
        void thumb.offsetWidth;
        thumb.style.transition = '';
      }
    };
    update();
    // A resize is handled in the next frame: changing the fit inside the observer's callback would resize what it observes.
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    });
    // A tight or stacked control is only as wide as that layout, so it learns there's room for a row from its container.
    for (const el of [set, set.parentElement, ...set.querySelectorAll('.ld-seg-item')]) if (el) ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [idx, values, chosen]);
  return (
    <fieldset
      ref={setRef}
      className={cn('ld-seg', props.size === 'sm' && 'ld-seg-sm', props.block && 'ld-seg-block', props.className)}
      disabled={props.disabled}
      aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid'] || undefined}
    >
      <legend className="ld-sr-only">{props.label}</legend>
      {/* With no option chosen, as a controlled value outside the options leaves it, nothing looks chosen. */}
      <span className="ld-seg-thumb" aria-hidden="true" hidden={!chosen} style={{ '--ld-seg-n': opts.length, '--ld-seg-i': idx } as React.CSSProperties} />
      {opts.map((o) => (
        <label key={o.value} className="ld-seg-item">
          <input
            type="radio"
            className="ld-seg-input"
            name={props.name ?? autoName}
            value={o.value}
            required={props.required}
            checked={o.value === value}
            onChange={() => {
              if (props.value === undefined) setInner(o.value);
              props.onValueChange?.(o.value);
            }}
          />
          <span className="ld-seg-label">{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
