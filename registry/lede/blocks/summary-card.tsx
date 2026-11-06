import * as React from 'react';
import { useLinkComponent } from '../link';
import { cn } from '../cn';
import type { StatusTone } from '../tone';

export type { StatusTone };
export interface SummaryCardProps {
  /** What this card is about, such as "Decisions". It is the link text and the card's heading. */
  title: string;
  /** The takeaway sentence, such as "2 need you by Thursday". */
  summary: React.ReactNode;
  /** One glanceable figure, such as "2" or "$420". */
  figure?: React.ReactNode;
  /** A status word, always spelled out. The tone adds color to it. */
  status?: { tone: StatusTone; label: string };
  /** Where the next level lives. The whole card is the link's target. */
  href?: string;
  /** Heading level. Default 3. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

/** An `<article>` whose heading is a real link stretched over the card. Figure, summary and status read in order. */
export function SummaryCard(props: SummaryCardProps) {
  const Link = useLinkComponent();
  const H = `h${props.headingLevel ?? 3}` as 'h3';
  return (
    <article className={cn('ld-summary-card', props.href && 'ld-summary-card-link', props.className)}>
      <H className="ld-summary-title">
        {props.href ? <Link href={props.href} className="ld-summary-target">{props.title}</Link> : props.title}
      </H>
      {props.figure != null ? <p className="ld-summary-figure">{props.figure}</p> : null}
      <p className="ld-summary-text">{props.summary}</p>
      {props.status ? (
        <p className={`ld-status ld-status-${props.status.tone}`}>
          <span className="ld-status-dot" aria-hidden="true" />
          {props.status.label}
        </p>
      ) : null}
      {props.href ? (
        <svg className="ld-summary-chevron" viewBox="0 0 8 14" fill="none" aria-hidden="true">
          <path d="M1.5 1.5 6.5 7l-5 5.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </article>
  );
}
