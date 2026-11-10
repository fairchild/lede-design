import * as React from 'react';
import { Button } from '@lede/button';
import { PageHeader } from '@lede/blocks/page-header';
import { MasterDetail } from '@lede/blocks/master-detail';
import { ListGroup, ListRow } from '@lede/list';

const DEVICES = ['Old laptop', 'Work phone', 'Tablet'];

/**
 * Row actions that remove their row with nothing in the parent to move focus, as the docs sample's Delete does, a row
 * whose action leaves it in place, and a row with both `href` and `onClick`. Not linked from the navigation;
 * `tests/focus-table.ts` and `tests/list-focus.spec.ts` drive it.
 */
export function ListFocusFixtures() {
  const [devices, setDevices] = React.useState(DEVICES);
  const [alone, setAlone] = React.useState(true);
  const [untitled, setUntitled] = React.useState(true);
  const [read, setRead] = React.useState(false);
  const [clicks, setClicks] = React.useState(0);
  const remove = (name: string) => setDevices((d) => d.filter((x) => x !== name));
  return (
    <div className="ld-flow">
      <PageHeader title="List focus fixtures" summary="Row actions that remove or keep their row, for the automated tests." />
      <ListGroup title="Devices" summary={`${devices.length} signed in`}>
        {devices.map((name) => (
          <ListRow key={name} title={name} href={`#${name.replace(/ /g, '-')}`} actions={[{ label: 'Delete', tone: 'critical', onSelect: () => remove(name) }]} />
        ))}
      </ListGroup>
      <ListGroup title="Last device">
        {alone ? <ListRow title="Desk computer" href="#desk" actions={[{ label: 'Delete', tone: 'critical', onSelect: () => setAlone(false) }]} /> : null}
      </ListGroup>
      {untitled ? (
        <ListGroup>
          <ListRow title="Guest session" href="#guest" actions={[{ label: 'End', tone: 'critical', onSelect: () => setUntitled(false) }]} />
        </ListGroup>
      ) : null}
      <Button variant="gray">After the list</Button>
      <ListGroup title="Mail">
        <ListRow title="Weekly summary" subtitle={read ? 'Read' : 'Unread'} href="#summary" actions={[{ label: read ? 'Mark unread' : 'Mark read', onSelect: () => setRead((r) => !r) }]} />
        <ListRow title="Counted link" subtitle={`Clicks: ${clicks}`} href="#counted" onClick={() => setClicks((c) => c + 1)} />
      </ListGroup>
    </div>
  );
}

const ITEMS = [
  { id: 'a', title: 'Quarterly report', body: 'Numbers for the quarter.' },
  { id: 'b', title: 'Team offsite', body: 'Dates and places.' },
];

/**
 * A MasterDetail whose detail is `false` when nothing is open, with no focus code of its own, so the block moves focus
 * when the panes swap. The selection is state, so the site's history focus restoration plays no part. Not linked from
 * the navigation; `tests/focus-table.ts` and `tests/list-focus.spec.ts` drive it.
 */
export function MasterDetailFixtures() {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const open = ITEMS.find((i) => i.id === openId);
  return (
    <MasterDetail
      listLabel="Items"
      detailLabel="Item"
      list={
        <>
          <PageHeader title="Master detail fixture" summary={`${ITEMS.length} items`} />
          <ListGroup title="All items">
            {ITEMS.map((i) => <ListRow key={i.id} title={i.title} onClick={() => setOpenId(i.id)} />)}
          </ListGroup>
        </>
      }
      detail={!!open && (
        <article>
          <Button variant="gray" onClick={() => setOpenId(null)}>Close</Button>
          <h2>{open.title}</h2>
          <p>{open.body}</p>
        </article>
      )}
      empty={<p>Pick an item to read it.</p>}
    />
  );
}
