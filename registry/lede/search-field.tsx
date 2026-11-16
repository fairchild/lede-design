import * as React from 'react';
import { cn } from './cn';

export interface SearchFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'value' | 'defaultValue' | 'className'> {
  /** The field's name for assistive tech, such as "Filter hosts". It's a real `<label>`, visually hidden. */
  label: string;
  /** Controlled text. */
  value?: string;
  /** Text at first, when uncontrolled. Default `''`. */
  defaultValue?: string;
  /** Runs with the new text on every change: typing, the clear button and Escape. */
  onValueChange?: (value: string) => void;
  /** Text shown while the field is empty. Default the `label`. */
  placeholder?: string;
  size?: 'md' | 'lg';
  /** On the wrapper `<div>` that holds the label, the field and the clear button. */
  className?: string;
  ref?: React.Ref<HTMLInputElement>;
}

const Glass = () => (
  <svg className="ld-search-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth={1.75} />
    <path d="m11 11 3.5 3.5" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
  </svg>
);
const Cross = () => (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="m4.5 4.5 7 7m0-7-7 7" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
  </svg>
);

/**
 * An `<input type="search">` with a visually hidden `<label>` and a clear button that shows while it holds text.
 * Escape clears the text and keeps focus; on an empty field Escape goes on to the screen, so PageHeader's
 * `backOnEscape` backs out. Clearing returns focus to the field.
 */
export function SearchField(props: SearchFieldProps) {
  const { label, value, defaultValue, onValueChange, placeholder, size, className, ref, onChange, onKeyDown, ...input } = props;
  const id = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const [inner, setInner] = React.useState(defaultValue ?? '');
  const text = value ?? inner;
  const set = (next: string) => {
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };
  const clear = () => {
    set('');
    inputRef.current?.focus();
  };
  return (
    <div className={cn('ld-field ld-search', size === 'lg' && 'ld-field-lg', className)}>
      <label className="ld-sr-only" htmlFor={input.id ?? id}>{label}</label>
      <div className="ld-search-box">
        <Glass />
        <input
          id={id}
          placeholder={placeholder ?? label}
          autoComplete="off"
          {...input}
          ref={inputRef}
          type="search"
          className="ld-field-input ld-search-input"
          value={text}
          onChange={(e) => { onChange?.(e); set(e.target.value); }}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            if (e.key !== 'Escape' || e.defaultPrevented || e.nativeEvent.isComposing || text === '') return;
            // The press is the field's: it clears the text, and PageHeader's Escape leaves a handled press alone.
            e.preventDefault();
            set('');
          }}
        />
        {text !== '' && !input.disabled && !input.readOnly ? (
          <button type="button" className="ld-search-clear" aria-label={`Clear ${label}`} onClick={clear}>
            <Cross />
          </button>
        ) : null}
      </div>
    </div>
  );
}
