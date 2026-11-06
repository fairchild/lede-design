import * as React from 'react';
import { cn } from '../cn';

export interface EmptyStateProps {
  title: React.ReactNode;
  /** What this place is for, and what fills it. */
  description?: React.ReactNode;
  /** At most one action. */
  action?: React.ReactNode;
  /** Heading level. Default 2. */
  headingLevel?: 2 | 3;
  className?: string;
}

/** A quiet, centered `<section>`: a heading, one sentence and at most one action. */
export function EmptyState(props: EmptyStateProps) {
  const H = `h${props.headingLevel ?? 2}` as 'h2';
  return (
    <section className={cn('ld-empty', props.className)}>
      <H className="text-title-3 ld-empty-title">{props.title}</H>
      {props.description ? <p className="ld-empty-text">{props.description}</p> : null}
      {props.action ? <div className="ld-empty-action">{props.action}</div> : null}
    </section>
  );
}
