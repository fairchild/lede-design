import { EmptyState } from '@/components/lede/blocks/empty-state';
import { Button } from '@/components/lede/button';

export function EmptyInbox({ onCompose }: { onCompose: () => void }) {
  return (
    <EmptyState
      title="No messages"
      description="New messages land here."
      action={<Button variant="tinted" onClick={onCompose}>Write a message</Button>}
    />
  );
}
