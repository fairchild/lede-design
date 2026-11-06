import * as React from 'react';
import { GlassBar } from '../glass-bar';
import { useLinkComponent } from '../link';
import { cn } from '../cn';

export interface ShellNavItem { value: string; label: string; href: string; icon?: React.ReactNode; }
export interface AppShellProps {
  /** Product name or wordmark, shown at the top of the sidebar. */
  brand: React.ReactNode;
  /** Three to five places. Sidebar on wide screens, a floating GlassBar on narrow ones. */
  nav: ShellNavItem[];
  /** The current place, marked with `aria-current="page"`. Its label also names `<main>`. */
  current: string;
  /** Accessible name of the primary navigation. Default `'Primary'`. */
  navLabel?: string;
  /** Extra sidebar content under the nav, on wide screens only, such as a footer link. */
  sidebarFooter?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Page layout: a skip link, a `<nav>` and `<main id="main">`. Wide screens get a sidebar, and narrow screens get the
 * same places in a bottom GlassBar. CSS shows only one of the two navs at a time, so assistive tech meets exactly one
 * "Primary" landmark.
 */
export function AppShell(props: AppShellProps) {
  const Link = useLinkComponent();
  const label = props.navLabel ?? 'Primary';
  return (
    <div className={cn('ld-shell', props.className)}>
      <a className="ld-skip" href="#main">Skip to content</a>
      <nav className="ld-shell-sidebar" aria-label={label}>
        <div className="ld-shell-brand">{props.brand}</div>
        <ul className="ld-shell-nav">
          {props.nav.map((it) => (
            <li key={it.value}>
              <Link className="ld-shell-link" href={it.href} aria-current={it.value === props.current ? 'page' : undefined}>
                {it.icon ? <span className="ld-shell-icon" aria-hidden="true">{it.icon}</span> : null}
                <span>{it.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        {props.sidebarFooter ? <div className="ld-shell-footer">{props.sidebarFooter}</div> : null}
      </nav>
      <main id="main" className="ld-shell-main" tabIndex={-1} aria-label={props.nav.find((it) => it.value === props.current)?.label}>
        {props.children}
      </main>
      <div className="ld-shell-tabbar">
        <GlassBar aria-label={label} items={props.nav} value={props.current} />
      </div>
    </div>
  );
}
