import { Page, Stack } from '@/components/lede/blocks/page';
import { PageHeader } from '@/components/lede/blocks/page-header';
import { ListGroup, ListRow } from '@/components/lede/list';

export function HostsPage() {
  return (
    <Page render={<main />}>
      <PageHeader title="Hosts" summary="1 needs a look" />
      <Stack gap="sm">
        <p>Checked 2 minutes ago.</p>
        <ListGroup title="Sorted by name">
          <ListRow title="api-iad-1" value="Up to date" />
          <ListRow title="edge-sfo-2" value="Failed" />
        </ListGroup>
      </Stack>
    </Page>
  );
}
