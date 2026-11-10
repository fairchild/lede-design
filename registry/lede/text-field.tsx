import * as React from 'react';
import { Field } from '@base-ui/react/field';
import { cn } from './cn';

type Common = {
  label: React.ReactNode;
  /** Helper text, linked to the input with `aria-describedby`. */
  hint?: React.ReactNode;
  /** Error message. It marks the field invalid and replaces the hint. Word it as the fix, such as "Enter your name." */
  error?: React.ReactNode;
  size?: 'md' | 'lg';
};
export type TextFieldProps =
  | (Common & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & { rows?: undefined; ref?: React.Ref<HTMLInputElement> })
  | (Common & React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
      ref?: React.Ref<HTMLTextAreaElement>;
      /** Renders a `<textarea>` of this many rows, for text that runs past one line. */
      rows: number;
    });

/**
 * Base UI Field: a real `<label>` and a real `<input>` or `<textarea>`, with the hint and error wired up for assistive
 * tech.
 */
export function TextField(props: TextFieldProps) {
  const { label, hint, error, size, rows, className, ...control } = props;
  return (
    <Field.Root invalid={!!error} className={cn('ld-field', size === 'lg' && 'ld-field-lg', className)}>
      <Field.Label className="ld-field-label">{label}</Field.Label>
      <Field.Control
        className="ld-field-input"
        render={rows ? <textarea rows={rows} /> : undefined}
        {...(control as React.ComponentProps<typeof Field.Control>)}
      />
      {error ? (
        <Field.Error match className="ld-field-hint">{error}</Field.Error>
      ) : hint ? (
        <Field.Description className="ld-field-hint">{hint}</Field.Description>
      ) : null}
    </Field.Root>
  );
}
