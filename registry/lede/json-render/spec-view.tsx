import * as React from 'react';
import type { Spec } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import { functions, type CatalogAction } from './catalog';
import { registry, SpecHeadingLevel } from './registry';

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
   * `submit` isn't called while a field in the view fails its native check, such as an empty required field.
   */
  handlers?: SpecHandlers;
}

/** The first field that fails its native check, focused so the person can fix it, or null when every field passes. */
function firstInvalid(root: HTMLElement | null) {
  const field = root?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input:invalid, textarea:invalid') ?? null;
  field?.focus();
  return field;
}

/**
 * The screen a spec describes, drawn with Lede. It draws nothing until the spec's root element arrives, because
 * json-render reads the spec's `state` once, when it mounts, and a streamed spec sends its state first.
 */
export function SpecView({ spec, streaming = false, headingLevel = 2, handlers }: SpecViewProps) {
  const root = React.useRef<HTMLDivElement>(null);
  const gated = React.useMemo(
    () => handlers && { ...handlers, submit: (params: Record<string, unknown>) => { if (!firstInvalid(root.current)) handlers.submit?.(params); } },
    [handlers],
  );
  if (!spec?.elements[spec.root]) return null;
  return (
    <SpecHeadingLevel.Provider value={headingLevel}>
      <div ref={root}>
        <JSONUIProvider registry={registry} functions={functions} initialState={spec.state ?? {}} handlers={gated as Record<string, (params: Record<string, unknown>) => void>}>
          <Renderer spec={spec} registry={registry} loading={streaming} />
        </JSONUIProvider>
      </div>
    </SpecHeadingLevel.Provider>
  );
}
