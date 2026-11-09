import * as React from 'react';
import { Button } from '@lede/button';
import { PageHeader } from '@lede/blocks/page-header';
import { Table } from '@lede/table';

/** A collapsible table whose `open` the page passes, then stops passing, which development builds warn about. */
export function TableFixtures() {
  const [controlled, setControlled] = React.useState(true);
  return (
    <div className="ld-flow">
      <PageHeader title="Table fixtures" summary="A collapsible table that switches from controlled to uncontrolled, for the automated tests." />
      <section aria-label="Controlled, then not" className="docs-section">
        <Table.Root caption="Quarter totals" collapsible={controlled ? { open: false, summary: '2 quarters' } : { summary: '2 quarters' }}>
          <Table.Body>
            <Table.Row>
              <Table.RowHeader>Q3</Table.RowHeader>
              <Table.Cell align="end">$12,400.00</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Root>
        <Button variant="gray" onClick={() => setControlled(false)}>Stop passing open</Button>
      </section>
    </div>
  );
}
