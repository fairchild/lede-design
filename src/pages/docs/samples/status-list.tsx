import { StatusList, type StatusItem } from '@/components/lede/blocks/status-list';

export function NeedsAttention({ items }: { items: StatusItem[] }) {
  const failed = items.filter((i) => i.tone === 'critical').length;
  return (
    <StatusList
      title="Needs attention"
      summary={items.length ? `${failed} failed of ${items.length}` : undefined}
      items={items}
      empty="Nothing needs a look. Every host deployed and checked in."
    />
  );
}
