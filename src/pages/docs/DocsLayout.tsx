import { Outlet, useLocation } from 'react-router';
import { AppShell } from '@lede/blocks/app-shell';
import { SegmentedControl } from '@lede/segmented-control';
import { Switch } from '@lede/switch';
import type { AppearancePrefs } from '@lede/flows/settings';
import { IconBook, IconSwatch, IconBlocks, IconLayers, IconLayout, IconGitHub } from '@/icons';
import { BrandMark } from '@/brand-mark';
import { useAppearance } from '@/theme';
import { version } from '../../../package.json';

export const REPO = 'https://github.com/fairchild/lede-design';

const NAV = [
  { value: 'overview', label: 'Overview', href: '/', icon: <IconBook /> },
  { value: 'foundations', label: 'Foundations', href: '/foundations', icon: <IconSwatch /> },
  { value: 'components', label: 'Components', href: '/components', icon: <IconBlocks /> },
  { value: 'blocks', label: 'Blocks', href: '/blocks', icon: <IconLayers /> },
  { value: 'layouts', label: 'Layouts', href: '/layouts', icon: <IconLayout /> },
];

const SCHEMES = [{ value: 'auto', label: 'Automatic' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }];

/**
 * The site's appearance and its two links out: GitHub and the version's changelog. The sidebar holds it on wide screens
 * and the page's foot on narrow ones, where the tab bar has room for five places at 320px. The demo app and Decisions
 * are reached from Overview.
 */
function DocsFooter() {
  const { prefs, setPrefs } = useAppearance();
  return (
    <div className="docs-footer">
      <SegmentedControl
        label="Mode"
        size="sm"
        block
        options={SCHEMES}
        value={prefs.scheme}
        onValueChange={(scheme) => setPrefs({ ...prefs, scheme: scheme as AppearancePrefs['scheme'] })}
      />
      <Switch label="Increase contrast" checked={prefs.highContrast} onCheckedChange={(highContrast) => setPrefs({ ...prefs, highContrast })} />
      <ul className="docs-footer-links">
        <li><a href={REPO}><IconGitHub />GitHub</a></li>
        <li><a href={`${REPO}/blob/main/CHANGELOG.md`}>Version {version}</a></li>
      </ul>
    </div>
  );
}

export function DocsLayout() {
  const { pathname } = useLocation();
  const current = NAV.find((n) => n.href !== '/' && pathname.startsWith(n.href))?.value ?? 'overview';
  return (
    <AppShell brand={<span className="docs-brand"><BrandMark className="docs-mark" />Lede</span>} nav={NAV} current={current} navLabel="Documentation" sidebarFooter={<DocsFooter />}>
      <Outlet />
      <footer className="docs-page-foot"><DocsFooter /></footer>
    </AppShell>
  );
}
