import * as React from 'react';
import { Button } from '@lede/button';
import { PageHeader } from '@lede/blocks/page-header';
import { Table } from '@lede/table';

const body = (
  <Table.Body>
    <Table.Row>
      <Table.RowHeader>Q3</Table.RowHeader>
      <Table.Cell align="end">$12,400.00</Table.Cell>
    </Table.Row>
  </Table.Body>
);

/**
 * Collapsible tables for the development warnings: one whose `open` the page passes, then stops passing, and captions
 * with phrasing content. `?caption=link` adds one with a link, which can't sit inside the toggle button.
 */
export function TableFixtures() {
  const [controlled, setControlled] = React.useState(true);
  const link = new URLSearchParams(window.location.search).get('caption') === 'link';
  return (
    <div className="ld-flow">
      <PageHeader title="Table fixtures" summary="Collapsible tables that development builds warn about, or don’t, for the automated tests." />
      <section aria-label="Controlled, then not" className="docs-section">
        <Table.Root caption="Quarter totals" collapsible={controlled ? { open: false, summary: '2 quarters' } : { summary: '2 quarters' }}>
          {body}
        </Table.Root>
        <Button variant="gray" onClick={() => setControlled(false)}>Stop passing open</Button>
      </section>
      <section aria-label="Phrasing content" className="docs-section">
        <Table.Root
          caption={<>Totals in <abbr title="United States dollars">USD</abbr>, <em>audited</em></>}
          collapsible={{ summary: <>Also called <span lang="fr">totaux trimestriels</span></> }}
        >
          {body}
        </Table.Root>
      </section>
      {link ? (
        <section aria-label="A link" className="docs-section">
          <Table.Root caption={<>Totals, <a href="#q3">see Q3</a></>} collapsible>
            {body}
          </Table.Root>
        </section>
      ) : null}
    </div>
  );
}
