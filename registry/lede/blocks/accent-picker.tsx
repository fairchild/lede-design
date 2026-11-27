import * as React from 'react';
import { presets, type Preset } from '../theme-provider';
import { cn, withLabels } from '../cn';

/** Each preset's visible name. Override any of them through `labels`; the rest stay English. */
export type AccentPickerLabels = Record<Preset, string>;

export const accentPickerLabels: AccentPickerLabels = {
  blue: 'Blue', indigo: 'Indigo', teal: 'Teal', green: 'Green', orange: 'Orange', pink: 'Pink', graphite: 'Graphite',
};

export interface AccentPickerProps {
  /** The checked preset. Leave it unset when no preset is the one showing, such as a look's own accent: none is checked. */
  value?: Preset;
  onValueChange: (value: Preset) => void;
  /** Radio group name. Defaults to a generated id. */
  name?: string;
  /** Names to use in place of the English defaults in `accentPickerLabels`. */
  labels?: Partial<AccentPickerLabels>;
  className?: string;
}

/**
 * Native radio inputs, one per accent preset, each with a visible name, so color is never the only cue.
 * Place it inside a FormSection, whose `<legend>` names the group.
 */
export function AccentPicker(props: AccentPickerProps) {
  const auto = React.useId();
  const l = withLabels(accentPickerLabels, props.labels);
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
          <span className="ld-accent-name">{l[p]}</span>
        </label>
      ))}
    </div>
  );
}
