import * as React from 'react';
import { useParams, useSearchParams } from 'react-router';
import { Button } from '@lede/button';
import { InboxFlow, type InboxMessage, type InboxNotice, type InboxReply } from '@lede/flows/inbox';
import { initialMessages } from '@/data/inbox';

/**
 * Test fixtures for what the demo inbox doesn't exercise: a Reply action, which wraps the message's bar on a narrow
 * screen, a long address as the sender, with nowhere to break, a long name as another, and a thread that changes while
 * it is open. It sits in the app shell for the tab bar. Not linked from the navigation; tests/inbox.spec.ts drives it.
 * With `?undo=later`, Archive removes the message and its Undo renders the restore a moment later, as an app waiting on
 * a server would; `tests/focus-table.ts` drives that.
 */
const initial: InboxMessage[] = initialMessages.map((m) =>
  m.thread ? { ...m, from: 'notifications@accounts.northwindpayroll.example' }
  : m.id === 'm5' ? { ...m, from: 'Alexandria Montgomery-Vandenberg' }
  : m);
const earlier = { from: 'Mei Lindqvist', date: 'Oct 19', datetime: '2026-10-19T09:00' };
const older: InboxReply[] = [
  { ...earlier, preview: 'Starting a thread for the offsite.', body: ['Starting a thread for the offsite.'] },
  { ...earlier, preview: 'Adding last year’s agenda.', body: ['Adding last year’s agenda.'] },
];
const newer = { from: 'Ari Chen', preview: 'One more thing on the roadmap.', date: '11:02', datetime: '2026-10-31T11:02', quote: undefined, body: ['One more thing on the roadmap.'] };
const ignore = () => {};
/** How long `?undo=later` takes to put a message back. */
const UNDO_DELAY = 300;

export function InboxFixtures() {
  const { id } = useParams();
  const [messages, setMessages] = React.useState(initial);
  const [notice, setNotice] = React.useState<InboxNotice>();
  const later = useSearchParams()[0].get('undo') === 'later';
  const archive = (ids: string[]) => {
    const before = messages;
    setMessages((ms) => ms.filter((m) => !ids.includes(m.id)));
    const undo = () => setTimeout(() => { setMessages(before); setNotice({ id: 'restored', text: 'Restored.' }); }, UNDO_DELAY);
    setNotice({ id: 'archived', text: 'Archived.', action: { label: 'Undo', onSelect: undo } });
  };
  const changeThread = (change: (m: InboxMessage) => InboxMessage) => setMessages((ms) => ms.map((m) => (m.thread ? change(m) : m)));
  return (
    <>
      <InboxFlow
        messages={messages}
        selectedId={id}
        hrefFor={(m) => `/fixtures/inbox/${m}`}
        listHref="/fixtures/inbox"
        onArchive={later ? archive : ignore}
        onDelete={ignore}
        onReply={ignore}
        notice={notice}
      />
      <p className="ld-preview-card">
        <Button variant="gray" size="sm" onClick={() => changeThread((m) => ({ ...m, thread: [...older, ...m.thread!] }))}>Load older messages</Button>
        <Button variant="gray" size="sm" onClick={() => changeThread((m) => ({ ...m, ...newer, thread: [...m.thread!, m] }))}>Add a new reply</Button>
      </p>
    </>
  );
}
