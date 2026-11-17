import { AppShell } from '@/components/lede/blocks/app-shell';
import { PageHeader } from '@/components/lede/blocks/page-header';

const NAV = [
  { value: 'today', label: 'Today', href: '/' },
  { value: 'inbox', label: 'Inbox', href: '/inbox' },
  { value: 'settings', label: 'Settings', href: '/settings' },
];

// A sidebar on wide screens and a floating GlassBar on narrow ones; the page goes inside <main>.
export function Layout({ current }: { current: string }) {
  return (
    <AppShell brand="Daybook" nav={NAV} current={current}>
      <PageHeader title="Today" summary="2 decisions need you" focusOnMount={false} />
    </AppShell>
  );
}
