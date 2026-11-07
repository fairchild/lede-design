import type { Spec } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import { registry, SpecHeadingLevel } from './registry';

/** The catalog actions a spec can run, each called with its params. */
export type SpecHandlers = Partial<Record<'open' | 'archive' | 'submit', (params: Record<string, unknown>) => void>>;

export interface SpecViewProps {
  /** The spec so far, such as `buildSpecFromParts(message.parts)` while a reply streams. */
  spec: Spec | null;
  /** True while the spec streams: elements still on their way draw nothing until they arrive. */
  streaming?: boolean;
  /** The level of the spec's title. Default 2, under a page's h1; a chat message's author heading makes it 3. */
  headingLevel?: 2 | 3;
  /** Called when the spec runs a catalog action. Keep them stable: json-render reads them once, when the view mounts. */
  handlers?: SpecHandlers;
}

/**
 * The screen a spec describes, drawn with Lede. It draws nothing until the spec's root element arrives, because
 * json-render reads the spec's `state` once, when it mounts, and a streamed spec sends its state first.
 */
export function SpecView({ spec, streaming = false, headingLevel = 2, handlers }: SpecViewProps) {
  if (!spec?.elements[spec.root]) return null;
  return (
    <SpecHeadingLevel.Provider value={headingLevel}>
      <JSONUIProvider registry={registry} initialState={spec.state ?? {}} handlers={handlers as Record<string, (params: Record<string, unknown>) => void>}>
        <Renderer spec={spec} registry={registry} loading={streaming} />
      </JSONUIProvider>
    </SpecHeadingLevel.Provider>
  );
}
