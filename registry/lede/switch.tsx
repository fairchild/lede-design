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
 * Base UI Switch inside an enclosing `<label>`. Space toggles it, and Enter submits its form, as a native checkbox's
 * does. Given a `name`, it submits with the form through its hidden native input.
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
      // Enter submits the enclosing form, as it does from a native checkbox. Base UI's switch is a `<span>`, which doesn't.
      onKeyDown={(e) => {
        const form = e.key === 'Enter' ? e.currentTarget.closest('form') : null;
        if (form) { e.preventDefault(); form.requestSubmit(); }
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
