import { useState } from 'react';
import { DataTable } from '@/components/lede/blocks/data-table';
import { defineColumns, type TableView } from '@/components/lede/blocks/use-data-table';
import { useServerRows, type ServerRowsResponse } from '@/components/lede/blocks/use-server-rows';

interface WorkItem { id: string; title: string }

const columns = defineColumns<WorkItem>([
  { id: 'id', label: 'ID', value: (r) => r.id, sortable: true },
  { id: 'title', label: 'Title', value: (r) => r.title, sortable: true },
]);

// A failed response must reject: fetch resolves on a 500, so check r.ok.
async function json<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(`The server answered ${r.status}.`);
  return r.json() as Promise<T>;
}

// The hook fetches and caches the pages of the view on screen; spread what it returns onto the DataTable.
export function WorkItems() {
  const [view, setView] = useState<TableView>({ sort: [] });
  const server = useServerRows<WorkItem>({
    view,
    fetchRows: ({ offset, limit, signal }) => fetch(`/api/items?offset=${offset}&limit=${limit}`, { signal }).then((r) => json<ServerRowsResponse<WorkItem>>(r)),
  });
  return (
    <DataTable
      caption="Work items"
      noun={{ one: 'work item', other: 'work items' }}
      columns={columns}
      getRowId={(r) => r.id}
      rowHeader="id"
      processing="server"
      view={view}
      onViewChange={setView}
      {...server}
    />
  );
}
