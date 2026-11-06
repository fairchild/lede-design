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
  | (Common & React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined })
  | (Common & React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string });

export function buttonClass(p: Common & { iconOnly?: boolean; className?: string }) {
  const { variant = 'gray', size = 'md' } = p;
  return cn(
    'ld-btn', `ld-btn-${variant}`, size !== 'md' && `ld-btn-${size}`, p.shape === 'rounded' && 'ld-btn-rounded',
    p.tone === 'critical' && 'ld-btn-critical', p.block && 'ld-btn-block', variant === 'glass' && 'ld-glass',
    p.iconOnly && 'ld-btn-icononly', p.className,
  );
}

/** A native `<button>`, or a native `<a>` when given `href`. */
export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(function Button(props, ref) {
  const Link = useLinkComponent();
  const { variant, size, shape, tone, icon, block, className, children, ...rest } = props as Common &
    React.HTMLAttributes<HTMLElement> & { href?: string };
  const cls = buttonClass({ variant, size, shape, tone, block, className, iconOnly: !!icon && !children });
  const inner = (
    <>
      {icon ? <span className="ld-btn-icon" aria-hidden="true">{icon}</span> : null}
      {children}
    </>
  );
  if (rest.href !== undefined) {
    const anchor = rest as React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
    return <Link ref={ref as React.Ref<HTMLAnchorElement>} {...anchor} className={cls}>{inner}</Link>;
  }
  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} type="button" {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)} className={cls}>
      {inner}
    </button>
  );
});
