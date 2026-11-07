import { JSONUIProvider, Renderer, buildSpecFromParts } from '@json-render/react';
import { registry, SpecHeadingLevel } from '@json-render-lede/registry';

/** The catalog actions a spec can run, each called with its params. */
export type SpecActions = Partial<Record<'open' | 'archive' | 'submit', (params: Record<string, unknown>) => void>>;

interface SpecViewProps {
  /** The message's parts, as `useChat` gives them. Only the `data-spec` parts are read. */
  parts: ReadonlyArray<{ type: string; data?: unknown }>;
  /** True while the reply streams: elements still on their way draw nothing until they arrive. */
  streaming: boolean;
  /** The heading level of the spec's title. A chat message's author heading sits above it. Default 3. */
  headingLevel?: 3 | 4 | 5;
  actions: SpecActions;
}

/**
 * The screen a reply's spec describes, drawn with Lede. It renders nothing until the spec's root element arrives,
 * because json-render's state provider reads the spec's `state` once, when it mounts, and the state patch comes first.
 */
export function SpecView({ parts, streaming, headingLevel = 3, actions }: SpecViewProps) {
  const spec = buildSpecFromParts(parts.filter((p) => p.type === 'data-spec').map((p) => ({ type: p.type, data: p.data })));
  if (!spec?.elements[spec.root]) return null;
  return (
    <div className="jrc-spec">
      <SpecHeadingLevel.Provider value={headingLevel}>
        <JSONUIProvider registry={registry} initialState={spec.state ?? {}} handlers={actions as Record<string, (params: Record<string, unknown>) => void>}>
          <Renderer spec={spec} registry={registry} loading={streaming} />
        </JSONUIProvider>
      </SpecHeadingLevel.Provider>
    </div>
  );
}
