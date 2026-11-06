import * as React from 'react';
import { useNavigate, useParams } from 'react-router';
import { formatCount } from '@lede/blocks/selection-bar';
import { InboxFlow, type InboxFlowProps, type InboxNotice } from '@lede/flows/inbox';
import { dispatch, getDemo, inboxMessages, useDemo, type DemoState, type Removal } from '@/demo-store';

const messages = (count: number) => formatCount(count, { one: 'message', other: 'messages' }, 'en-US');
const DONE: Record<Removal, string> = { archived: 'Archived', deleted: 'Deleted' };

/** Why a message URL shows no message: the store knows what this visit archived and deleted. */
function notFound(s: DemoState, id: string): InboxFlowProps['notFound'] {
  switch (s.inbox.removed.find((r) => r.ids.includes(id))?.how) {
    case 'archived': return { title: 'This message is archived' };
    case 'deleted': return { title: 'This message was deleted' };
    default: return { title: 'Message not found', description: 'This link doesn’t match any message in the Inbox.' };
  }
}

export function InboxPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const demo = useDemo();
  const list = inboxMessages(demo);
  const open = list.some((m) => m.id === id);
  // Opening a message marks it read; a URL whose message is gone marks nothing, so an Undo brings it back as it was.
  React.useEffect(() => {
    if (id && open) dispatch({ type: 'inbox/open', id });
  }, [id, open]);
  // The last removal can be undone while the reader stays in the Inbox, moving between messages included. Leaving the
  // Inbox or reloading ends the offer, and the removal stays. Each notice gets the next id, so each is announced.
  const [notice, setNotice] = React.useState<InboxNotice & { id: number }>();
  const say = (next: Omit<InboxNotice, 'id'>) => setNotice((prev) => ({ ...next, id: (prev?.id ?? 0) + 1 }));
  const remove = (how: Removal) => (ids: string[]) => {
    const before = getDemo().inbox.removed.length;
    dispatch({ type: 'inbox/remove', ids, how });
    const after = getDemo().inbox.removed;
    if (after.length > before) {
      const count = messages(after.at(-1)!.ids.length);
      const undo = () => { dispatch({ type: 'inbox/undo' }); say({ text: `Restored ${count}.` }); };
      say({ text: `${DONE[how]} ${count}.`, action: { label: 'Undo', onSelect: undo } });
    }
    // In the same commit as the removal, so the gone message's not-found detail never renders and takes focus.
    if (id && ids.includes(id)) navigate('/app/inbox', { flushSync: true });
  };
  return (
    <InboxFlow
      messages={list}
      selectedId={id}
      hrefFor={(m) => `/app/inbox/${m}`}
      listHref="/app/inbox"
      onArchive={remove('archived')}
      onDelete={remove('deleted')}
      notice={notice}
      notFound={id && !open ? notFound(demo, id) : undefined}
      locale="en-US"
    />
  );
}
