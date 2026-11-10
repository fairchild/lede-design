import * as React from 'react';
import { cn } from './cn';
import { useLinkComponent } from './link';
import type { ToneSubset } from './tone';

type Common = {
  /** `'filled'` for the one prominent action, `'tinted'` for secondary emphasis, `'gray'` for the rest, `'plain'` for text only and `'glass'` over media. Default `'gray'`. */
  variant?: 'filled' | 'tinted' | 'gray' | 'plain' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  /** Default `'capsule'`. */
  shape?: 'capsule' | 'rounded';
  /** `'critical'` for destructive actions. */
  tone?: ToneSubset<'primary' | 'critical'>;
  /** Inline SVG drawn in `currentColor`. With no children the control is square: give it `aria-label`. */
  icon?: React.ReactNode;
  /** Full width. */
  block?: boolean;
};
export type ButtonProps =
  | (Common & Omit<React.ComponentProps<'button'>, 'ref'> & { href?: undefined; ref?: ButtonRef<HTMLButtonElement> })
  | (Common & Omit<React.ComponentProps<'a'>, 'ref'> & { href: string; ref?: ButtonRef<HTMLAnchorElement> });
/** The element's own ref, or one typed for either element, as a Button that may become a link takes. */
type ButtonRef<E extends HTMLElement> = React.Ref<E> | React.Ref<HTMLButtonElement | HTMLAnchorElement>;

export function buttonClass(p: Common & { iconOnly?: boolean; className?: string }) {
  const { variant = 'gray', size = 'md' } = p;
  return cn(
    'ld-btn', `ld-btn-${variant}`, size !== 'md' && `ld-btn-${size}`, p.shape === 'rounded' && 'ld-btn-rounded',
    p.tone === 'critical' && 'ld-btn-critical', p.block && 'ld-btn-block', variant === 'glass' && 'ld-glass',
    p.iconOnly && 'ld-btn-icononly', p.className,
  );
}

/** A native `<button>`, or a native `<a>` when given `href`. HTML attributes and `ref` go on that element. */
export function Button(props: ButtonProps) {
  const Link = useLinkComponent();
  const { variant, size, shape, tone, icon, block, className, children, ...rest } = props;
  const cls = buttonClass({ variant, size, shape, tone, block, className, iconOnly: !!icon && !children });
  const inner = (
    <>
      {icon ? <span className="ld-btn-icon" aria-hidden="true">{icon}</span> : null}
      {children}
    </>
  );
  if (rest.href !== undefined) return <Link {...(rest as React.ComponentProps<'a'> & { href: string })} className={cls}>{inner}</Link>;
  return <button type="button" {...(rest as React.ComponentProps<'button'>)} className={cls}>{inner}</button>;
}
