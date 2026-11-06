import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { WorkbenchShell } from '@lede/blocks/workbench-shell';

export const HYDRATE_KEY = 'lede:workbench-hydrate';

export const hydrateSample = (
  <WorkbenchShell
    brand="Sample"
    title="Hydrated"
    start={{ label: 'Files', content: <a href="#file">A file</a> }}
    end={{ label: 'Assistant', content: <p>Some help</p> }}
    storageKey={HYDRATE_KEY}
  >
    <p>Some content</p>
  </WorkbenchShell>
);

export interface HydrateWindow { hydrateSample?: (markup: string) => void }

/**
 * A test fixture, not linked from the navigation. tests/workbench.spec.ts renders hydrateSample with renderToString in
 * Node, where there is no storage, and this page hydrates that markup, as an app with server rendering would.
 */
export function WorkbenchHydrate() {
  const root = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    (window as HydrateWindow).hydrateSample = (markup) => {
      root.current!.innerHTML = markup;
      hydrateRoot(root.current!, hydrateSample);
    };
  }, []);
  return <div ref={root} />;
}
