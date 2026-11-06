import * as React from 'react';
import { PageHeader } from '../blocks/page-header';
import { SummaryCard, type SummaryCardProps } from '../blocks/summary-card';
import { Disclosure } from '../disclosure';
import { ListGroup, ListRow } from '../list';

export interface BriefItem { id: string; title: string; subtitle?: string; value?: string; href?: string; }
export interface BriefSection {
  id: string;
  title: string;
  /** The section's takeaway, readable without opening it. */
  summary: string;
  meta?: string;
  items: BriefItem[];
  defaultOpen?: boolean;
}
export interface DailyBriefFlowProps {
  title: string;
  /** The day in one line, such as "2 decisions need you · 3 meetings". */
  summary: string;
  actions?: React.ReactNode;
  /** Three to five glanceable cards, each a link to its next level. */
  cards: Omit<SummaryCardProps, 'headingLevel'>[];
  /** Sections that open in place. */
  sections: BriefSection[];
}

/**
 * Hero flow: the daily brief. Level 1 is the page summary. Level 2 is the cards, each a link, and the section
 * summaries. Level 3 is the rows inside an opened section, and level 4 the screen a row links to.
 */
export function DailyBriefFlow(props: DailyBriefFlowProps) {
  const glance = React.useId();
  return (
    <div className="ld-flow">
      <PageHeader title={props.title} summary={props.summary} actions={props.actions} />
      <section aria-labelledby={glance}>
        <h2 id={glance} className="ld-sr-only">At a glance</h2>
        <ul className="ld-summary-grid">
          {props.cards.map((c) => (
            <li key={c.title}><SummaryCard {...c} headingLevel={3} /></li>
          ))}
        </ul>
      </section>
      {props.sections.map((s) => (
        <Disclosure key={s.id} title={s.title} summary={s.summary} meta={s.meta} defaultOpen={s.defaultOpen} headingLevel={2}>
          <ListGroup>
            {s.items.map((it) => (
              <ListRow key={it.id} title={it.title} subtitle={it.subtitle} value={it.value} href={it.href} />
            ))}
          </ListGroup>
        </Disclosure>
      ))}
    </div>
  );
}
