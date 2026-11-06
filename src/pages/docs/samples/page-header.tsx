import { PageHeader } from '@/components/lede/blocks/page-header';
import { Button } from '@/components/lede/button';

// The screen's one h1. It takes focus when the screen mounts.
export function InboxHeader({ unread, total }: { unread: number; total: number }) {
  return (
    <PageHeader
      title="Inbox"
      summary={`${unread} unread of ${total}`}
      back={{ href: '/', label: 'Today' }}
      actions={<Button size="sm">Select</Button>}
    />
  );
}
