import { ListGroup, ListRow } from '@/components/lede/list';
import { StatusText } from '@/components/lede/status-text';

export function DeployChecks() {
  return (
    <ListGroup title="Needs attention" summary="2 of 14 hosts">
      <ListRow title="edge-sfo-2" subtitle="Deploy failed at 9:41 AM" value={<StatusText tone="critical">Failed</StatusText>} href="/hosts/edge-sfo-2" />
      <ListRow title="api-iad-1" subtitle="Plan has 3 changes" value={<StatusText tone="caution">Would change</StatusText>} href="/hosts/api-iad-1" />
    </ListGroup>
  );
}
