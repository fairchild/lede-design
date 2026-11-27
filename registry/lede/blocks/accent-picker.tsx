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
  /**
   * Names the group for screen readers, as SegmentedControl's `label` does: the picker is then its own `<fieldset>`.
   * Put it in a FormSection with `group={false}` and the same `legend`, so the name shows and is read once. Leave it
   * unset only inside a FormSection that is a group itself, whose `<legend>` then names it.
   */
  label?: string;
  /** With `label`, a description read with the group, such as a FormSection's (see its `descriptionId`). */
  'aria-describedby'?: string;
  /** Names to use in place of the English defaults in `accentPickerLabels`. */
  labels?: Partial<AccentPickerLabels>;
  className?: string;
}

/**
 * Native radio inputs, one per accent preset, each with a visible name, so color is never the only cue. `label` names
 * the group, as it does every control that is a group.
 */
export function AccentPicker(props: AccentPickerProps) {
  const auto = React.useId();
  const l = withLabels(accentPickerLabels, props.labels);
  const items = presets.map((p) => (
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
  ));
  return props.label != null ? (
    <fieldset className={cn('ld-accents', props.className)} aria-describedby={props['aria-describedby']}>
      <legend className="ld-sr-only">{props.label}</legend>
      {items}
    </fieldset>
  ) : (
    <div className={cn('ld-accents', props.className)}>{items}</div>
  );
}
