import * as React from 'react';
import { Avatar } from '@lede/avatar';
import { Button } from '@lede/button';
import { Checkbox } from '@lede/checkbox';
import { Disclosure } from '@lede/disclosure';
import { GlassBar } from '@lede/glass-bar';
import { PageHeader } from '@lede/blocks/page-header';
import { SegmentedControl } from '@lede/segmented-control';
import { Switch } from '@lede/switch';
import { Table } from '@lede/table';

const PICTURE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3Crect width="1" height="1" fill="gray"/%3E%3C/svg%3E';

/** A ref callback that marks the element it receives, so a test can find where the ref landed. */
const mark = (el: HTMLElement | null) => { if (el) el.dataset.ref = 'attached'; };

/** Each case's props: an `id`, a `data-*` attribute, a description and a ref, all of which should land on one element. */
const pass = (id: string) => ({ id, 'data-case': id, 'aria-describedby': 'pass-note', ref: mark });

/**
 * Components given an `id`, a `data-*` attribute, `aria-describedby` and a ref, for tests/pass-through.spec.ts, which
 * checks each lands on the element the component's doc comment names. Not linked from the navigation.
 */
/** A SegmentedControl and a Table.Root whose ref callbacks return a cleanup, which React 19 runs on unmount. */
function RefCleanups() {
  const [shown, setShown] = React.useState(true);
  const [cleanups, setCleanups] = React.useState({ segmented: 0, table: 0 });
  const counted = (key: keyof typeof cleanups) => (el: HTMLElement | null) => {
    if (!el) return undefined;
    return () => setCleanups((c) => ({ ...c, [key]: c[key] + 1 }));
  };
  const segmentedRef = React.useMemo(() => counted('segmented'), []);
  const tableRef = React.useMemo(() => counted('table'), []);
  return (
    <section aria-label="Ref cleanups" className="docs-section">
      {shown ? (
        <>
          <SegmentedControl ref={segmentedRef} label="Size" options={['Small', 'Large']} />
          <Table.Root ref={tableRef} aria-label="One day">
            <Table.Body><Table.Row><Table.Cell>Monday</Table.Cell></Table.Row></Table.Body>
          </Table.Root>
        </>
      ) : null}
      <Button variant="gray" onClick={() => setShown((v) => !v)}>Toggle the refs</Button>
      <p>SegmentedControl cleanups: {cleanups.segmented} · Table cleanups: {cleanups.table}</p>
    </section>
  );
}

export function PassThroughFixtures() {
  return (
    <div className="ld-flow">
      <PageHeader title="Pass-through fixtures" summary="Components given HTML attributes and a ref, for the automated tests." />
      <p id="pass-note">Every component below names this paragraph as its description.</p>
      <section aria-label="Button" className="docs-section">
        <Button {...pass('pass-button')}>A button</Button>
        <Button {...pass('pass-button-link')} href="#pass-note">A link</Button>
      </section>
      <section aria-label="Disclosure" className="docs-section">
        <a href="#pass-disclosure">Go to the level</a>
        <div style={{ blockSize: '150vh' }} />
        <Disclosure {...pass('pass-disclosure')} title="A level" summary="Its takeaway." style={{ maxInlineSize: '40rem' }}>
          The next level down.
        </Disclosure>
      </section>
      <section aria-label="Segmented control" className="docs-section">
        <form id="pass-form" />
        <SegmentedControl {...pass('pass-segmented')} label="Range" options={['Day', 'Week']} form="pass-form" required />
      </section>
      <section aria-label="Avatar" className="docs-section">
        <Avatar {...pass('pass-avatar')} name="Hana Sato" title="Hana Sato" />
        <Avatar
          {...pass('pass-avatar-picture')}
          name="Ren Ito"
          src={PICTURE}
          title="Ren Ito"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
        />
      </section>
      <section aria-label="Switch" className="docs-section">
        <form id="pass-switch-form" />
        <Switch
          {...pass('pass-switch')}
          label="Reminders"
          name="reminders"
          value="on"
          uncheckedValue="off"
          form="pass-switch-form"
          required
          className="pass-switch-wrapper"
          style={{ maxInlineSize: '40rem' }}
        />
      </section>
      <section aria-label="Checkbox" className="docs-section">
        <label htmlFor="pass-checkbox">Starred</label>
        <Checkbox {...pass('pass-checkbox')} className="pass-checkbox-wrapper" style={{ maxInlineSize: '40rem' }} />
        <Checkbox id="pass-checkbox-hidden" aria-label="Hidden" className="pass-checkbox-hidden" hidden />
      </section>
      <section aria-label="Glass bar" className="docs-section">
        <GlassBar
          {...pass('pass-glass-bar')}
          aria-label="Places"
          items={[{ value: 'a', label: 'Today' }, { value: 'b', label: 'Later' }]}
          style={{ maxInlineSize: '40rem' }}
        />
      </section>
      <RefCleanups />
      <section aria-label="Table" className="docs-section">
        <Table.Root
          id="pass-table"
          data-case="pass-table"
          aria-describedby="pass-note"
          ref={mark}
          className="pass-table-box"
          style={{ maxInlineSize: '40rem' }}
          caption="Two days"
        >
          <Table.Head>
            <Table.Row><Table.HeaderCell>Day</Table.HeaderCell></Table.Row>
          </Table.Head>
          <Table.Body>
            <Table.Row><Table.Cell>Monday</Table.Cell></Table.Row>
            <Table.Row><Table.Cell>Tuesday</Table.Cell></Table.Row>
          </Table.Body>
        </Table.Root>
      </section>
    </div>
  );
}
