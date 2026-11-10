import * as React from 'react';
import { Switch as BaseSwitch } from '@base-ui/react/switch';
import { cn } from './cn';

export interface SwitchProps
  extends Omit<React.ComponentProps<typeof BaseSwitch.Root>, 'className' | 'style' | 'hidden' | 'render' | 'children' | 'onCheckedChange'> {
  onCheckedChange?: (checked: boolean) => void;
  /** Visible label. The whole `<label>` is the target. Without it, pass `aria-label`. */
  label?: React.ReactNode;
  /** Form field name. Base UI keeps a hidden native checkbox, so the value submits with the form. */
  name?: string;
  /** On the wrapper. */
  className?: string;
  /** On the wrapper. */
  style?: React.CSSProperties;
  /** On the wrapper, so the label hides with the switch. */
  hidden?: boolean;
}

/**
 * Implicit submission, as Enter in a native checkbox does it: a click on the form's default button, which runs its
 * `onClick`, or nothing when that button is disabled. A form with no submit button is submitted directly.
 */
function submitImplicitly(form: HTMLFormElement) {
  const isSubmit = (el: Element): el is HTMLButtonElement | HTMLInputElement =>
    (el instanceof HTMLButtonElement && el.type === 'submit') || (el instanceof HTMLInputElement && (el.type === 'submit' || el.type === 'image'));
  const button = [...form.elements].find(isSubmit);
  if (!button) form.requestSubmit();
  else if (!button.matches(':disabled')) button.click();
}

/**
 * Base UI Switch inside an enclosing `<label>`. Space toggles it, and Enter in a form presses the form's default
 * button, as a native checkbox's does. Given a `name`, it submits with the form through its hidden native input.
 * `className`, `style` and `hidden` go on the wrapper, the `<label>` or a `<span>` without one. Other HTML attributes
 * and `ref` go on the `role="switch"` element that takes focus. `id` and the form props go on the hidden native
 * checkbox, as Base UI places them, so a `<label htmlFor>` names the switch.
 */
export function Switch({ label, onCheckedChange, onKeyDown, className, style, hidden, 'aria-label': ariaLabel, ...rest }: SwitchProps) {
  const control = (
    <BaseSwitch.Root
      {...rest}
      className="ld-switch-track"
      onCheckedChange={(v) => onCheckedChange?.(v)}
      aria-label={label ? undefined : ariaLabel}
      // Base UI's switch is a `<span>`, which Enter doesn't submit from, so this does what a native checkbox's Enter does.
      onKeyDown={(e) => {
        onKeyDown?.(e);
        const form = e.key === 'Enter' ? e.currentTarget.closest('form') : null;
        if (form) { e.preventDefault(); submitImplicitly(form); }
      }}
    >
      <BaseSwitch.Thumb className="ld-switch-knob" />
    </BaseSwitch.Root>
  );
  const wrapper = { className: cn('ld-switch', rest.disabled && 'ld-switch-disabled', className), style, hidden };
  if (!label) return <span {...wrapper}>{control}</span>;
  return (
    <label {...wrapper}>
      <span className="ld-switch-label">{label}</span>
      {control}
    </label>
  );
}
