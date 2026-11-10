import { Avatar } from '@lede/avatar';
import { Button } from '@lede/button';
import { Disclosure } from '@lede/disclosure';
import { PageHeader } from '@lede/blocks/page-header';
import { SegmentedControl } from '@lede/segmented-control';
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
        <Avatar {...pass('pass-avatar-picture')} name="Ren Ito" src={PICTURE} title="Ren Ito" />
      </section>
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
