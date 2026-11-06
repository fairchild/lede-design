import { DailyBriefFlow } from '@lede/flows/daily-brief';
import { brief } from '@/data/brief';
import { inboxMessages, useDemo } from '@/demo-store';

export function TodayPage() {
  const unread = inboxMessages(useDemo()).filter((m) => m.unread); // newest first, as the Inbox lists them
  const inbox = {
    title: 'Inbox',
    figure: String(unread.length),
    summary: unread.length ? `Unread, the newest from ${unread[0].from.split(' ')[0]}.` : 'All read.',
    href: '/app/inbox',
  };
  return <DailyBriefFlow {...brief} cards={[...brief.cards, inbox]} />;
}
