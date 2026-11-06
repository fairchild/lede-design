import { ListGroup, ListRow } from '@/components/lede/list';
import { Switch } from '@/components/lede/switch';

export function SyncSettings({ onDelete }: { onDelete: () => void }) {
  return (
    <ListGroup title="Sync" summary="On for 2 devices">
      <ListRow title="Appearance" value="Automatic" href="/settings/appearance" />
      <ListRow title="Sync across devices" trailing={<Switch aria-label="Sync across devices" defaultChecked />} />
      <ListRow title="Old laptop" href="/settings/devices/2" actions={[{ label: 'Delete', tone: 'critical', onSelect: onDelete }]} />
    </ListGroup>
  );
}
