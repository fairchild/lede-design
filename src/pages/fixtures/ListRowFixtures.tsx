import * as React from 'react';
import { Button } from '@lede/button';
import { PageHeader } from '@lede/blocks/page-header';
import { ListGroup, ListRow, type RowAction } from '@lede/list';

const THREE: RowAction[] = [{ label: 'Archive' }, { label: 'Reassign', tone: 'neutral' }, { label: 'Delete', tone: 'critical' }];
const TWO: RowAction[] = [{ label: 'Archive' }, { label: 'Delete', tone: 'critical' }];
const LONG: RowAction[] = [{ label: 'Archive' }, { label: 'Reassign permanently', tone: 'neutral' }, { label: 'Delete', tone: 'critical' }];

const CASES = [
  { title: 'Three actions, 288px', width: 288, row: 'Quarterly report', subtitle: 'From Dana', actions: THREE },
  { title: 'Two actions, 288px', width: 288, row: 'Quarterly report', subtitle: 'From Dana', actions: TWO },
  { title: 'Three actions, 200px', width: 200, row: 'Quarterly report', subtitle: 'From Dana', actions: THREE },
  { title: 'A long label, 200px', width: 200, row: 'Report', actions: LONG },
];

/**
 * Short labels that fill the row at double text, then a longer first one. The actions' panel is already as wide as the
 * row, so it keeps its size, and so does the row.
 */
function Lengthened() {
  const [long, setLong] = React.useState(false);
  const actions: RowAction[] = [{ label: long ? 'Move' : 'A' }, { label: 'B', tone: 'neutral' }, { label: 'C', tone: 'critical' }];
  return (
    <section aria-label="A label lengthens, 228px" className="docs-section">
      <div style={{ width: 228 }}>
        <ListGroup>
          <ListRow title="Notes" actions={actions} actionsOpen />
        </ListGroup>
      </div>
      <Button variant="gray" onClick={() => setLong((l) => !l)}>Lengthen the first action</Button>
    </section>
  );
}

/** A row its parent opens and one a swipe opens, narrowed until their actions don't fit, then restored. */
function Narrowed() {
  const [narrow, setNarrow] = React.useState(false);
  const [open, setOpen] = React.useState(true);
  const [changes, setChanges] = React.useState<boolean[]>([]);
  return (
    <section aria-label="Opened, then narrowed" className="docs-section">
      <div style={{ width: narrow ? 140 : 288 }}>
        <ListGroup>
          <ListRow
            title="Parent-controlled"
            actions={THREE}
            actionsOpen={open}
            onActionsOpenChange={(v) => { setOpen(v); setChanges((c) => [...c, v]); }}
          />
          <ListRow title="Swiped open" actions={THREE} />
        </ListGroup>
      </div>
      <p>Changes: {changes.length ? changes.map((v) => (v ? 'open' : 'closed')).join(', ') : 'none'}</p>
      <Button variant="gray" onClick={() => setNarrow((n) => !n)}>{narrow ? 'Restore the width' : 'Narrow the rows'}</Button>
    </section>
  );
}

/** Group headers whose summary is too long to sit beside the title on a phone, so it moves under it. */
const HEADERS = [
  { title: 'Saturday', summary: 'The castle and old town, with fado at night.' },
  { title: 'Sunday', summary: 'Monuments and pastries by the river, then the sunset.' },
  { title: 'Notifications for every shared calendar', summary: '2 on' },
];

/**
 * ListRows with their swipe actions revealed in narrow boxes, for tests/row-menu.spec.ts, which also doubles the text
 * size and lengthens a label, and ListGroup headers with long summaries, for tests/reflow.spec.ts. Not linked from the
 * navigation.
 */
export function ListRowFixtures() {
  return (
    <div className="ld-flow">
      <PageHeader title="List row fixtures" summary="Revealed swipe actions in narrow boxes and group headers with long summaries, for the automated tests." />
      {CASES.map((c) => (
        <section key={c.title} aria-label={c.title} className="docs-section">
          <div style={{ width: c.width }}>
            <ListGroup>
              <ListRow title={c.row} subtitle={c.subtitle} actions={c.actions} actionsOpen />
            </ListGroup>
          </div>
        </section>
      ))}
      <Lengthened />
      <Narrowed />
      <section aria-label="Group headers with long summaries" className="docs-section">
        {HEADERS.map((h) => (
          <ListGroup key={h.title} title={h.title} summary={h.summary}>
            <ListRow title="Castelo de São Jorge" value="9:30 AM" />
          </ListGroup>
        ))}
      </section>
    </div>
  );
}
