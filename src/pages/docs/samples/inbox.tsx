import { InboxFlow, type InboxMessage } from '@/components/lede/flows/inbox';

// The open message lives in the URL, so Back returns from it to the list. Removing messages is yours to do.
export function Inbox({ messages, selectedId, onRemove }: { messages: InboxMessage[]; selectedId?: string; onRemove: (ids: string[]) => void }) {
  return (
    <InboxFlow
      messages={messages}
      selectedId={selectedId}
      hrefFor={(id) => `/inbox/${id}`}
      listHref="/inbox"
      onArchive={onRemove}
      onDelete={onRemove}
      notFound={selectedId && !messages.some((m) => m.id === selectedId) ? { title: 'Message not found' } : undefined}
    />
  );
}
