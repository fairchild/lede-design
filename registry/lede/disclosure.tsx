import * as React from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import { cn } from './cn';

export interface DisclosureProps extends Omit<React.ComponentProps<'section'>, 'title' | 'children'> {
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
}

/**
 * Base UI Collapsible: a `<section>`, a heading holding a `<button aria-expanded>` and a panel kept in the DOM as
 * `hidden="until-found"`, so find-in-page can reveal it. Other HTML attributes and `ref` go on the `<section>`, so an
 * `id` makes the whole level a deep-link target.
 */
export function Disclosure({
  title, summary, meta, open, defaultOpen, onOpenChange, variant, headingLevel = 3, children, className, ref, ...rest
}: DisclosureProps) {
  const H = `h${headingLevel}` as 'h3';
  return (
    <Collapsible.Root
      {...rest}
      ref={ref as React.Ref<HTMLDivElement>}
      render={<section />}
      className={cn('ld-disc', variant === 'plain' && 'ld-disc-plain', className)}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={(o) => onOpenChange?.(o)}
    >
      <H className="ld-disc-heading">
        <Collapsible.Trigger className="ld-disc-head">
          <span className="ld-disc-text">
            <span className="ld-disc-title">{title}</span>
            {summary ? <span className="ld-disc-summary">{summary}</span> : null}
          </span>
          {meta != null ? <span className="ld-disc-meta">{meta}</span> : null}
          <svg className="ld-disc-chevron" viewBox="0 0 8 14" fill="none" aria-hidden="true">
            <path d="M1.5 1.5 6.5 7l-5 5.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Collapsible.Trigger>
      </H>
      <Collapsible.Panel hiddenUntilFound className="ld-disc-panel">
        <div className="ld-disc-body">{children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
