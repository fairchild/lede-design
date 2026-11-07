import * as React from 'react';
import type { Spec } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import { functions, type CatalogAction } from './catalog';
import { registry, SpecHeadingLevel, SpecRoot } from './registry';

/** The catalog's actions, each called with its params when a spec runs it. Add an action to the catalog and it's here. */
export type SpecHandlers = Partial<Record<CatalogAction, (params: Record<string, unknown>) => void>>;

export interface SpecViewProps {
  /** The spec so far, such as `specFromParts(message.parts)` while a reply streams. */
  spec: Spec | null;
  /** True while the spec streams: elements still on their way draw nothing until they arrive. */
  streaming?: boolean;
  /** The level of the spec's title. Default 2, under a page's h1; a chat message's author heading makes it 3. */
  headingLevel?: 2 | 3;
  /**
   * Called when the spec runs a catalog action. Keep them stable: json-render reads them once, when the view mounts.
   * An action whose params read a field that fails its check doesn't run, so its handler isn't called.
   */
  handlers?: SpecHandlers;
}

/**
 * The screen a spec describes, drawn with Lede. It draws once the spec's root element arrives, and state that arrives
 * after it, as a model streams it, fills in what's drawn: a list drawn with repeat gains a row per item.
 */
export function SpecView({ spec, streaming = false, headingLevel = 2, handlers }: SpecViewProps) {
  const root = React.useRef<HTMLDivElement>(null);
  if (!spec?.elements[spec.root]) return null;
  return (
    <SpecHeadingLevel.Provider value={headingLevel}>
      <SpecRoot.Provider value={root}>
        <div ref={root}>
          <JSONUIProvider registry={registry} functions={functions} initialState={spec.state ?? {}} handlers={handlers as Record<string, (params: Record<string, unknown>) => void>}>
            <Renderer spec={spec} registry={registry} loading={streaming} />
          </JSONUIProvider>
        </div>
      </SpecRoot.Provider>
    </SpecHeadingLevel.Provider>
  );
}
