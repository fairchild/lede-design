import * as React from 'react';
import { cn } from '../cn';

export interface FormSectionProps {
  /** Names the group of fields; announced with each field inside. */
  legend: React.ReactNode;
  /** One sentence on why these fields are asked for. */
  description?: React.ReactNode;
  children: React.ReactNode;
  /**
   * `false` when the section holds one control that is already a named group, such as a SegmentedControl, given the
   * same name as `legend`. The section is then a `<div>`, and the legend shows but is left to that control to announce,
   * so the name isn't read twice. A `description` is then read as plain text, not with the control: pass it to the
   * control too, as `aria-describedby`, if it's needed there. Default `true`.
   */
  group?: boolean;
  className?: string;
}

/** A native `<fieldset>` and `<legend>` on a card surface: related fields, grouped and named. */
export function FormSection(props: FormSectionProps) {
  const id = React.useId();
  if (props.group === false) {
    return (
      <div className={cn('ld-form-section', props.className)}>
        <p className="ld-form-legend" aria-hidden="true">{props.legend}</p>
        {props.description ? <p className="ld-form-description">{props.description}</p> : null}
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
