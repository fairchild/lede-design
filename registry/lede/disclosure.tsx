import * as React from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import { cn } from './cn';

export interface DisclosureProps {
  /** The level's name. */
  title: React.ReactNode;
  /** The takeaway: enough to decide or act without opening. Every Disclosure should have one. */
  summary?: React.ReactNode;
  /** A short trailing figure: a count, a total, a status word. */
  meta?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** `'card'` is a card of its own, and `'plain'` is separated by hairlines, for nesting inside a Card. Default `'card'`. */
  variant?: 'card' | 'plain';
  /** Level of the real heading the trigger sits in. Default 3. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** The next level down. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Base UI Collapsible: a `<section>`, a heading holding a `<button aria-expanded>` and a panel kept in the DOM as
 * `hidden="until-found"`, so find-in-page can reveal it.
 */
export function Disclosure(props: DisclosureProps) {
  const H = `h${props.headingLevel ?? 3}` as 'h3';
  return (
    <Collapsible.Root
      render={<section />}
      className={cn('ld-disc', props.variant === 'plain' && 'ld-disc-plain', props.className)}
      open={props.open}
      defaultOpen={props.defaultOpen}
      onOpenChange={(o) => props.onOpenChange?.(o)}
    >
      <H className="ld-disc-heading">
        <Collapsible.Trigger className="ld-disc-head">
          <span className="ld-disc-text">
            <span className="ld-disc-title">{props.title}</span>
            {props.summary ? <span className="ld-disc-summary">{props.summary}</span> : null}
          </span>
          {props.meta != null ? <span className="ld-disc-meta">{props.meta}</span> : null}
          <svg className="ld-disc-chevron" viewBox="0 0 8 14" fill="none" aria-hidden="true">
            <path d="M1.5 1.5 6.5 7l-5 5.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Collapsible.Trigger>
      </H>
      <Collapsible.Panel hiddenUntilFound className="ld-disc-panel">
        <div className="ld-disc-body">{props.children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
