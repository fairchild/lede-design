import { Table } from '@/components/lede/table';

export function QuarterTotals({ rows }: { rows: Array<{ quarter: string; amount: string }> }) {
  return (
    <Table.Root caption="Quarter totals">
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>Quarter</Table.HeaderCell>
          <Table.HeaderCell align="end">Amount</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {rows.map((r) => (
          <Table.Row key={r.quarter}>
            <Table.RowHeader>{r.quarter}</Table.RowHeader>
            <Table.Cell align="end">{r.amount}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
