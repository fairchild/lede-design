import * as React from 'react';
import { cn } from './cn';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** Mixed state, such as "some rows on this page". Default `false`. Set as a DOM property, since HTML has no attribute for it. */
  indeterminate?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * A native `<input type="checkbox">`: keyboard, form and screen-reader behavior come from the browser, and the click
 * event keeps its modifier keys (Shift for ranges). The input itself is the hit target, sized by `--ld-check-hit`
 * (default `--ld-table-hit`, from the density tokens), and the visible box is drawn beside it. Name it with a visible
 * `<label>` or `aria-label`.
 *
 * `className`, `style` and `hidden` go on the wrapper `<span>` that holds the drawn box, so `hidden` hides the whole
 * checkbox. Every other attribute and `ref` go on the input: `id` for a `<label htmlFor>`, the form and ARIA
 * attributes and `data-*`.
 */
export function Checkbox({ indeterminate = false, className, style, hidden, ref, ...rest }: CheckboxProps) {
  const inner = React.useRef<HTMLInputElement>(null);
  // On every render, since a native click clears the DOM state even while the prop stays true.
  React.useLayoutEffect(() => {
    if (inner.current && inner.current.indeterminate !== indeterminate) inner.current.indeterminate = indeterminate;
  });
  const setRef = React.useCallback(
    (el: HTMLInputElement | null) => {
      inner.current = el;
      if (typeof ref === 'function') {
        const cleanup = ref(el);
        // React 19 calls a returned cleanup instead of calling the ref with `null`, so the consumer's runs too.
        return () => {
          inner.current = null;
          if (typeof cleanup === 'function') cleanup();
          else ref(null);
        };
      }
      if (ref) (ref as React.RefObject<HTMLInputElement | null>).current = el;
      return undefined;
    },
    [ref],
  );
  return (
    <span className={cn('ld-checkbox', className)} style={style} hidden={hidden}>
      <input ref={setRef} type="checkbox" className="ld-checkbox-input" {...rest} />
      {/* The check mark and dash are drawn in CSS: no extra nodes in a 500-row table. */}
      <span className="ld-checkbox-box" aria-hidden="true" />
    </span>
  );
}
