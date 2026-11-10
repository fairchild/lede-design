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

/** Captions a toggle button can't hold, picked by `?caption=`: interactive phrasing content, and block content. */
const INVALID: Record<string, React.ReactNode> = {
  link: <>Totals, <a href="#q3">see Q3</a></>,
  label: <>Totals, <label>by quarter</label></>,
  iframe: <>Totals <iframe title="Chart" src="about:blank" width={1} height={1} /></>,
  section: <>Totals <section>by quarter</section></>,
  li: <>Totals <li>by quarter</li></>,
};

/**
 * Collapsible tables for the development warnings: one whose `open` the page passes, then stops passing, captions
 * with phrasing content, and with `?caption=` one of INVALID's.
 */
export function TableFixtures() {
  const [controlled, setControlled] = React.useState(true);
  const invalid = INVALID[new URLSearchParams(window.location.search).get('caption') ?? ''];
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
      {invalid ? (
        <section aria-label="Content a button can’t hold" className="docs-section">
          <Table.Root caption={invalid} collapsible>
            {body}
          </Table.Root>
        </section>
      ) : null}
    </div>
  );
}
