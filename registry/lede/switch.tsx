import * as React from 'react';
import { Switch as BaseSwitch } from '@base-ui/react/switch';
import { cn } from './cn';

export interface SwitchProps
  extends Omit<React.ComponentProps<'span'>, 'className' | 'style' | 'hidden' | 'children' | 'onChange' | 'defaultChecked'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Visible label. The whole `<label>` is the target. Without it, pass `aria-label`. */
  label?: React.ReactNode;
  disabled?: boolean;
  /** Can't be changed, though it still takes focus and submits. */
  readOnly?: boolean;
  /** Form field name. Base UI keeps a hidden native checkbox, so the value submits with the form. */
  name?: string;
  /** The value submitted while it's on. Default `'on'`. */
  value?: string;
  /** The value submitted while it's off. With none, nothing submits while it's off. */
  uncheckedValue?: string;
  /** It must be on before the form submits. */
  required?: boolean;
  /** The form it submits with, by id, when it sits outside that form. */
  form?: string;
  /** On the hidden native checkbox, so `<label htmlFor>` names the switch. */
  id?: string;
  /** The hidden native checkbox. */
  inputRef?: React.Ref<HTMLInputElement>;
  /** On the wrapper. */
  className?: string;
  /** On the wrapper. */
  style?: React.CSSProperties;
  /** On the wrapper, so the label hides with the switch. */
  hidden?: boolean;
}

/**
 * Implicit submission, as Enter in a native checkbox does it: a click on the form's default button, which runs its
 * `onClick`, or nothing when that button is disabled or the form has none. Without a default button, browsers submit
 * only from the form's one text-like field, never from a checkbox.
 */
function submitImplicitly(form: HTMLFormElement) {
  const isSubmit = (el: Element): el is HTMLButtonElement | HTMLInputElement =>
    (el instanceof HTMLButtonElement && el.type === 'submit') || (el instanceof HTMLInputElement && (el.type === 'submit' || el.type === 'image'));
  // `form.elements` leaves out image buttons, so they're found by their form owner and put back in tree order.
  const images = [...document.querySelectorAll<HTMLInputElement>('input[type=image]')].filter((el) => el.form === form);
  const button = [...form.elements, ...images]
    .filter(isSubmit)
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))[0];
  if (button && !button.matches(':disabled')) button.click();
}

/**
 * Base UI Switch inside an enclosing `<label>`. Space toggles it, and Enter in a form presses the form's default
 * button, as a native checkbox's does. Given a `name`, it submits with the form through its hidden native input.
 * `className`, `style` and `hidden` go on the wrapper, the `<label>` or a `<span>` without one. Other HTML attributes
 * and `ref` go on the `role="switch"` `<span>` that takes focus. `id` and the form props go on the hidden native
 * checkbox, as Base UI places them, so a `<label htmlFor>` names the switch. A consumer's `onKeyDown` that calls
 * `preventDefault` on Enter stops the implicit submit.
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
        if (e.defaultPrevented) return;
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
