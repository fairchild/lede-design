import { WorkbenchShell } from '@/components/lede/blocks/workbench-shell';
import { ListGroup, ListRow } from '@/components/lede/list';

// Three panels that fill the window. The side panels collapse and resize, and remember both under storageKey.
export function Editor() {
  return (
    <WorkbenchShell
      brand="Daybook"
      title="Q4 plan"
      storageKey="editor-panels"
      start={{ label: 'Files', content: <ListGroup title="Files"><ListRow title="Q4 plan" href="/files/q4" current /><ListRow title="Budget" href="/files/budget" /></ListGroup> }}
      end={{ label: 'Details', content: <p>Edited today by Sam.</p> }}
    >
      <p>Revenue grows 12% on the new pricing.</p>
    </WorkbenchShell>
  );
}
