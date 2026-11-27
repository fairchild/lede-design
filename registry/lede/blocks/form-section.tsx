import * as React from 'react';
import { cn } from '../cn';

export interface FormSectionProps {
  /** Names the group of fields; announced with each field inside. */
  legend: React.ReactNode;
  /** One sentence on why these fields are asked for. */
  description?: React.ReactNode;
  /** The description's id, for a control that reads it with `group={false}`. Default: a generated id. */
  descriptionId?: string;
  children: React.ReactNode;
  /**
   * `false` when the section holds one control that is already a named group, such as a SegmentedControl, given the
   * same name as `legend`. The section is then a `<div>`, and the legend shows but is left to that control to announce,
   * so the name isn't read twice. A `description` is then read as plain text, not with the control: give the section a
   * `descriptionId` and pass it to the control as `aria-describedby`. Default `true`.
   */
  group?: boolean;
  className?: string;
}

/**
 * A native `<fieldset>` and `<legend>` on a card surface: related fields, grouped and named. Lede names a group once.
 * Fields are named by the section's `legend`. A control that is a group itself, such as SegmentedControl or
 * AccentPicker, is named by its own `label`; a section holding only that control takes `group={false}` and the same
 * `legend`, which then shows without being read again.
 */
export function FormSection(props: FormSectionProps) {
  const auto = React.useId();
  const id = props.descriptionId ?? auto;
  if (props.group === false) {
    return (
      <div className={cn('ld-form-section', props.className)}>
        <p className="ld-form-legend" aria-hidden="true">{props.legend}</p>
        {props.description ? <p id={id} className="ld-form-description">{props.description}</p> : null}
        <div className="ld-form-body">{props.children}</div>
      </div>
    );
  }
  return (
    <fieldset className={cn('ld-form-section', props.className)} aria-describedby={props.description ? id : undefined}>
      <legend className="ld-form-legend">{props.legend}</legend>
      {props.description ? <p id={id} className="ld-form-description">{props.description}</p> : null}
      <div className="ld-form-body">{props.children}</div>
    </fieldset>
  );
}
