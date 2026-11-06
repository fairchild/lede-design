import { Outlet, useLocation, useMatches } from 'react-router';
import { AppShell } from '@lede/blocks/app-shell';
import { Avatar } from '@lede/avatar';
import { IconSun, IconInbox, IconGear, IconTable } from '@/icons';
import { useProfile } from '@/profile';
import { RouterLink } from '@/router-link';

const NAV = [
  { value: 'today', label: 'Today', href: '/app', icon: <IconSun /> },
  { value: 'inbox', label: 'Inbox', href: '/app/inbox', icon: <IconInbox /> },
  { value: 'work', label: 'Work', href: '/app/work', icon: <IconTable /> },
  { value: 'settings', label: 'Settings', href: '/app/settings', icon: <IconGear /> },
];

/** The demo product: a four-place app built only from Lede blocks and flows. */
export function AppLayout() {
  const { pathname } = useLocation();
  const { profile } = useProfile();
  // Only the not-found route matches the rest of a path, and a page that isn't there belongs to no place.
  const lost = '*' in (useMatches().at(-1)?.params ?? {});
  // The profile is an account page with no place of its own: it sits under Settings, like Appearance.
  const current = lost ? '' : pathname.startsWith('/app/inbox') ? 'inbox' : pathname.startsWith('/app/work') ? 'work' : /^\/app\/(settings|profile)/.test(pathname) ? 'settings' : 'today';
  const footer = (
    <>
      <RouterLink className="ld-shell-link docs-person-link" href="/app/profile">
        <Avatar name={profile.name} src={profile.avatarUrl} alt="" />
        <span className="docs-person-name">{profile.name}<span className="ld-sr-only"> (your profile)</span></span>
      </RouterLink>
      <RouterLink href="/">Back to Lede docs</RouterLink>
    </>
  );
  return (
    <AppShell brand="Daybook" nav={NAV} current={current} navLabel="App" sidebarFooter={footer}>
      <Outlet />
    </AppShell>
  );
}
