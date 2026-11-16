import * as React from 'react';
import { ListGroup, ListRow } from '@/components/lede/list';
import { SearchField } from '@/components/lede/search-field';

export function HostList({ hosts }: { hosts: { id: string; name: string }[] }) {
  const [query, setQuery] = React.useState('');
  const shown = hosts.filter((h) => h.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <>
      <SearchField label="Filter hosts" value={query} onValueChange={setQuery} />
      <ListGroup title="Hosts" summary={query ? `${shown.length} of ${hosts.length}` : `${hosts.length}`}>
        {shown.map((h) => <ListRow key={h.id} title={h.name} href={`/hosts/${h.id}`} />)}
      </ListGroup>
    </>
  );
}
