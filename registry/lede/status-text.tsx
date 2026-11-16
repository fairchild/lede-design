import * as React from 'react';
import { cn } from './cn';
import type { StatusTone } from './tone';

export type { StatusTone };
export interface StatusTextProps {
  /** The status in words, such as "Failed" or "Up to date". The tone only adds color, so the words carry the meaning. */
  children: React.ReactNode;
  /** Default `'neutral'`. */
  tone?: StatusTone;
  /** A dot in the tone's color before the words. Default `true`. */
  dot?: boolean;
  className?: string;
}

/**
 * A `<span>` that colors a status word by its tone, with a dot before it. It takes the size of the text around it,
 * so it fits a ListRow's `value` or `subtitle`, a table cell or a sentence.
 */
export function StatusText(props: StatusTextProps) {
  return (
    <span className={cn('ld-status', `ld-status-${props.tone ?? 'neutral'}`, props.className)}>
      {props.dot !== false ? <span className="ld-status-dot" aria-hidden="true" /> : null}
      {props.children}
    </span>
  );
}
