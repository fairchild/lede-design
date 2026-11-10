import * as React from 'react';
import { Toolbar } from '@base-ui/react/toolbar';
import { cn } from './cn';
import { useLinkComponent } from './link';

export interface GlassBarItem { value: string; label: React.ReactNode; icon?: React.ReactNode; href?: string; }
export interface GlassBarProps {
  /** Accessible name of the navigation landmark. */
  'aria-label': string;
  items: GlassBarItem[];
  /**
   * The current place, marked with `aria-current="page"`. With a router, pass the item for its location, so Back and
   * Forward move the mark too. Without `value` or `defaultValue`, link items mark the one whose `href` is the page's
   * path as it mounts, or none, and button items mark the first.
   */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** `'inline'`, or fixed at the top or bottom center of the viewport. Default `'inline'`. */
  placement?: 'inline' | 'top' | 'bottom';
  className?: string;
  style?: React.CSSProperties;
}

/** For link items, the one at the page's path or none, since the page may have loaded at any of them. Button items start on the first. */
function initial(items: GlassBarItem[]) {
  if (!items.some((it) => it.href)) return items[0]?.value;
  if (typeof location === 'undefined') return undefined;
  return items.find((it) => it.href && new URL(it.href, location.href).pathname === location.pathname)?.value;
}

/** A click that opens the link in a new tab or window, or downloads it, which leaves this page where it is. */
const opensElsewhere = (e: React.MouseEvent) => e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;

/** Navigation between places: a `<nav>` and a `<ul>` of real links, or of buttons for client routing, with `aria-current`. */
export function GlassBar(props: GlassBarProps) {
  const Link = useLinkComponent();
  const [inner, setInner] = React.useState(() => props.defaultValue ?? initial(props.items));
  const current = props.value !== undefined ? props.value : inner;
  const pick = (v: string) => { if (props.value === undefined) setInner(v); props.onValueChange?.(v); };
  return (
    <nav
      aria-label={props['aria-label']}
      className={cn('ld-bar', 'ld-glass', props.placement && props.placement !== 'inline' && `ld-bar-${props.placement}`, props.className)}
      style={props.style}
    >
      <ul className="ld-bar-list">
        {props.items.map((it) => {
          const sel = it.value === current;
          const inner = (
            <>
              {it.icon ? <span className="ld-bar-icon" aria-hidden="true">{it.icon}</span> : null}
              <span>{it.label}</span>
            </>
          );
          return (
            <li key={it.value}>
              {it.href ? (
                <Link className="ld-bar-item" href={it.href} aria-current={sel ? 'page' : undefined} onClick={(e) => { if (!opensElsewhere(e)) pick(it.value); }}>{inner}</Link>
              ) : (
                <button type="button" className="ld-bar-item" aria-current={sel ? 'page' : undefined} onClick={() => pick(it.value)}>{inner}</button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export interface GlassToolbarProps extends Omit<React.ComponentProps<typeof Toolbar.Root>, 'className'> {
  'aria-label': string;
  placement?: 'inline' | 'top' | 'bottom';
  className?: string;
}
/** Actions on the current view: a Base UI Toolbar (`role="toolbar"`, roving arrow-key focus) on glass. */
export function GlassToolbar({ placement, className, ...rest }: GlassToolbarProps) {
  return (
    <Toolbar.Root
      {...rest}
      className={cn('ld-bar', 'ld-bar-tools', 'ld-glass', placement && placement !== 'inline' && `ld-bar-${placement}`, className)}
    />
  );
}
export interface GlassToolbarButtonProps extends Omit<React.ComponentProps<typeof Toolbar.Button>, 'className'> {
  icon?: React.ReactNode;
  className?: string;
}
export function GlassToolbarButton({ icon, children, className, ...rest }: GlassToolbarButtonProps) {
  return (
    <Toolbar.Button {...rest} className={cn('ld-bar-tool', !children && 'ld-bar-tool-icon', className)}>
      {icon ? <span className="ld-bar-icon" aria-hidden="true">{icon}</span> : null}
      {children as React.ReactNode}
    </Toolbar.Button>
  );
}
export function GlassToolbarSeparator() {
  return <Toolbar.Separator className="ld-bar-sep" />;
}
