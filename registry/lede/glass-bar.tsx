import * as React from 'react';
import { Toolbar } from '@base-ui/react/toolbar';
import { cn } from './cn';
import { useLinkComponent } from './link';

export interface GlassBarItem { value: string; label: React.ReactNode; icon?: React.ReactNode; href?: string; }
export interface GlassBarProps {
  /** Accessible name of the navigation landmark. */
  'aria-label': string;
  items: GlassBarItem[];
  /** The current place, marked with `aria-current="page"`. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** `'inline'`, or fixed at the top or bottom center of the viewport. Default `'inline'`. */
  placement?: 'inline' | 'top' | 'bottom';
  className?: string;
  style?: React.CSSProperties;
}

/** Navigation between places: a `<nav>` and a `<ul>` of real links, or of buttons for client routing, with `aria-current`. */
export function GlassBar(props: GlassBarProps) {
  const Link = useLinkComponent();
  const [inner, setInner] = React.useState(props.defaultValue ?? props.items[0]?.value);
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
                <Link className="ld-bar-item" href={it.href} aria-current={sel ? 'page' : undefined} onClick={() => pick(it.value)}>{inner}</Link>
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
