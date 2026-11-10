import * as React from 'react';
import { Switch as BaseSwitch } from '@base-ui/react/switch';
import { cn } from './cn';

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Visible label. The whole `<label>` is the target. Without it, pass `aria-label`. */
  label?: React.ReactNode;
  disabled?: boolean;
  /** Form field name. Base UI keeps a hidden native checkbox, so the value submits with the form. */
  name?: string;
  'aria-label'?: string;
  className?: string;
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
 */
export function Switch(props: SwitchProps) {
  const control = (
    <BaseSwitch.Root
      className="ld-switch-track"
      checked={props.checked}
      defaultChecked={props.defaultChecked}
      onCheckedChange={(v) => props.onCheckedChange?.(v)}
      disabled={props.disabled}
      name={props.name}
      aria-label={props.label ? undefined : props['aria-label']}
      // Base UI's switch is a `<span>`, which Enter doesn't submit from, so this does what a native checkbox's Enter does.
      onKeyDown={(e) => {
        const form = e.key === 'Enter' ? e.currentTarget.closest('form') : null;
        if (form) { e.preventDefault(); submitImplicitly(form); }
      }}
    >
      <BaseSwitch.Thumb className="ld-switch-knob" />
    </BaseSwitch.Root>
  );
  if (!props.label) return <span className={cn('ld-switch', props.disabled && 'ld-switch-disabled', props.className)}>{control}</span>;
  return (
    <label className={cn('ld-switch', props.disabled && 'ld-switch-disabled', props.className)}>
      <span className="ld-switch-label">{props.label}</span>
      {control}
    </label>
  );
}
