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

/** A table whose rows hold a button that closes it, as a controlled `open` from outside can. */
function ClosedFromInside() {
  const [open, setOpen] = React.useState(true);
  return (
    <section aria-label="Closed from inside" className="docs-section">
      <Table.Root caption="Closing totals" collapsible={{ open, onOpenChange: setOpen }}>
        <Table.Body>
          <Table.Row>
            <Table.RowHeader>Q3</Table.RowHeader>
            <Table.Cell><Button variant="gray" onClick={() => setOpen(false)}>Close the table</Button></Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>
    </section>
  );
}

const LONG = 'A note long enough to be clipped in a narrow column, so that hovering it would show its full text';

/** Smaller findings: a sort button inside a header that sorts, a row with its own title, a nested table, a narrow box. */
function Findings() {
  return (
    <>
      <section aria-label="Sort that disagrees" className="docs-section">
        <p id="fx-sort-note">Sorting reloads the page.</p>
        <Table.Root aria-label="Sorted table">
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell sort="descending"><Table.SortButton direction="ascending" aria-describedby="fx-sort-note">Name</Table.SortButton></Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body><Table.Row><Table.Cell>Ada</Table.Cell></Table.Row></Table.Body>
        </Table.Root>
      </section>
      <section aria-label="Row titles" className="docs-section" style={{ maxWidth: 360 }}>
        <Table.Root aria-label="Titled rows">
          <Table.Columns widths={[120, 200]} />
          <Table.Body>
            <Table.Row title="The row’s own title">
              <Table.RowHeader>Own</Table.RowHeader>
              <Table.Cell truncate>{LONG}</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.RowHeader><Table.RowLink href="#linked">Linked</Table.RowLink></Table.RowHeader>
              <Table.Cell truncate>{LONG}</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.RowHeader><label>Ticked <input type="checkbox" /></label></Table.RowHeader>
              <Table.Cell truncate>{LONG}</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.RowHeader>Nested</Table.RowHeader>
              <Table.Cell>
                <Table.Root aria-label="Inner table">
                  <Table.Body><Table.Row title="The inner row’s title"><Table.Cell>Inner</Table.Cell></Table.Row></Table.Body>
                </Table.Root>
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Root>
      </section>
      <section aria-label="Narrow box" className="docs-section">
        <Table.Root aria-label="Wide table" style={{ width: 200 }}>
          <Table.Columns widths={[400]} />
          <Table.Body><Table.Row><Table.Cell>Wide</Table.Cell></Table.Row></Table.Body>
        </Table.Root>
      </section>
    </>
  );
}

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
      <ClosedFromInside />
      <Findings />
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
