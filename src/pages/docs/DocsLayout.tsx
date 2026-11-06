import { Outlet, useLocation } from 'react-router';
import { AppShell } from '@lede/blocks/app-shell';
import { IconBook, IconSwatch, IconBlocks, IconLayers, IconLayout } from '@/icons';
import { RouterLink } from '@/router-link';
import { BrandMark } from '@/brand-mark';

const NAV = [
  { value: 'overview', label: 'Overview', href: '/', icon: <IconBook /> },
  { value: 'foundations', label: 'Foundations', href: '/foundations', icon: <IconSwatch /> },
  { value: 'components', label: 'Components', href: '/components', icon: <IconBlocks /> },
  { value: 'blocks', label: 'Blocks', href: '/blocks', icon: <IconLayers /> },
  { value: 'layouts', label: 'Layouts', href: '/layouts', icon: <IconLayout /> },
];

export function DocsLayout() {
  const { pathname } = useLocation();
  const current = NAV.find((n) => n.href !== '/' && pathname.startsWith(n.href))?.value ?? 'overview';
  return (
    <AppShell brand={<span className="docs-brand"><BrandMark className="docs-mark" />Lede</span>} nav={NAV} current={current} navLabel="Documentation" sidebarFooter={<RouterLink href="/app">Demo app</RouterLink>}>
      <Outlet />
    </AppShell>
  );
}
