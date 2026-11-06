import * as React from 'react';
import { cn } from '../cn';

export interface FormSectionProps {
  /** Names the group of fields; announced with each field inside. */
  legend: React.ReactNode;
  /** One sentence on why these fields are asked for. */
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** A native `<fieldset>` and `<legend>` on a card surface: related fields, grouped and named. */
export function FormSection(props: FormSectionProps) {
  const id = React.useId();
  return (
    <fieldset className={cn('ld-form-section', props.className)} aria-describedby={props.description ? id : undefined}>
      <legend className="ld-form-legend">{props.legend}</legend>
      {props.description ? <p id={id} className="ld-form-description">{props.description}</p> : null}
      <div className="ld-form-body">{props.children}</div>
    </fieldset>
  );
}
