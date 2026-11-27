import * as React from 'react';
import { WorkbenchShell, type WorkbenchRegion } from '@lede/blocks/workbench-shell';

/**
 * A WorkbenchShell whose shown panel and Assistant panel its parent holds, with buttons in its panels that change them,
 * for tests/workbench.spec.ts. Not linked from the navigation.
 */
export function WorkbenchControlled() {
  const [panel, setPanel] = React.useState<WorkbenchRegion>('main');
  const [assistant, setAssistant] = React.useState(true);
  const [log, setLog] = React.useState<string[]>([]);
  const note = (entry: string) => setLog((l) => [...l, entry]);
  return (
    <WorkbenchShell
      brand="Sample"
      title="Controlled"
      mainId="controlled-main"
      start={{ label: 'Files', content: <button type="button" onClick={() => setPanel('main')}>Open retry.ts</button> }}
      end={{
        label: 'Assistant',
        content: <p>Some help</p>,
        open: assistant,
        onOpenChange: (open) => { setAssistant(open); note(`assistant ${open ? 'open' : 'closed'}`); },
      }}
      panel={panel}
      onPanelChange={(next) => { setPanel(next); note(`panel ${next}`); }}
      actions={<button type="button" onClick={() => { setAssistant(true); setPanel('end'); }}>Ask the assistant</button>}
    >
      <p>Changes: {log.length ? log.join(', ') : 'none'}</p>
      <button type="button" onClick={() => setAssistant((v) => !v)}>Toggle the assistant from main</button>
    </WorkbenchShell>
  );
}
