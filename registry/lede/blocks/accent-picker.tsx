import * as React from 'react';
import { presets, type Preset } from '../theme-provider';
import { cn } from '../cn';

export interface AccentPickerProps {
  value: Preset;
  onValueChange: (value: Preset) => void;
  /** Radio group name. Defaults to a generated id. */
  name?: string;
  className?: string;
}

/**
 * Native radio inputs, one per accent preset, each with a visible name, so color is never the only cue.
 * Place it inside a FormSection, whose `<legend>` names the group.
 */
export function AccentPicker(props: AccentPickerProps) {
  const auto = React.useId();
  return (
    <div className={cn('ld-accents', props.className)}>
      {presets.map((p) => (
        <label key={p} className="ld-accent">
          <input
            type="radio"
            className="ld-accent-input"
            name={props.name ?? auto}
            value={p}
            checked={props.value === p}
            onChange={() => props.onValueChange(p)}
          />
          <span className="ld-accent-swatch" style={{ background: `var(--preset-${p})` }} aria-hidden="true" />
          <span className="ld-accent-name">{p[0].toUpperCase() + p.slice(1)}</span>
        </label>
      ))}
    </div>
  );
}
