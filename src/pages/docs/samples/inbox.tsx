import { useState } from 'react';
import { Page } from '@/components/lede/blocks/page';
import { InboxFlow, type InboxMessage } from '@/components/lede/flows/inbox';

// A flow brings no gutter of its own: put it in Page, or in AppShell's main region. The open message's id comes from
// the route, so each message has its own URL and Back returns to the list.
export function InboxScreen({ initial, openId }: { initial: InboxMessage[]; openId?: string }) {
  const [messages, setMessages] = useState(initial);
  const remove = (ids: string[]) => setMessages((all) => all.filter((m) => !ids.includes(m.id)));
  return (
    <Page render={<main />} width="full">
      <InboxFlow
        messages={messages}
        selectedId={openId}
        hrefFor={(id) => `/inbox/${id}`}
        listHref="/inbox"
        onArchive={remove}
        onDelete={remove}
      />
    </Page>
  );
}
