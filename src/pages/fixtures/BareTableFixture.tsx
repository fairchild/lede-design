import { DataTable } from '@lede/blocks/data-table';
import type { Column } from '@lede/blocks/use-data-table';

/**
 * A test fixture, not linked from the navigation: a selectable DataTable on a page with no AppShell, as in an app that
 * installs DataTable alone. tests/data-table.spec.ts checks that its SelectionBar centers in the viewport.
 */
type Num = { id: string; n: number };
const rows: Num[] = Array.from({ length: 3 }, (_, n) => ({ id: `n${n}`, n }));
const columns: Column<Num>[] = [{ id: 'n', label: 'Number', value: (r) => r.n }];

export function BareTableFixture() {
  return (
    <main>
      <h1>A table without a shell</h1>
      <DataTable
        caption="Numbers"
        noun={{ one: 'number', other: 'numbers' }}
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        rowHeader="n"
        selectionMode="multiple"
        bulkActions={[{ label: 'Archive', onSelect: () => undefined }]}
      />
    </main>
  );
}
