import { useRender } from '@base-ui/react/use-render';
import { mergeProps } from '@base-ui/react/merge-props';
import { cn } from '../cn';

export interface PageProps extends useRender.ComponentProps<'div'> {
  /**
   * How wide the page gets: `'flow'` is `layout-flow-max-width`, `'narrow'` is `layout-flow-narrow-max-width`, for a
   * form, and `'full'` fills its box. Default `'flow'`.
   */
  width?: 'flow' | 'narrow' | 'full';
  /**
   * The gutter around the page: `--space-4`, and `--space-8` from the sidebar's breakpoint, as AppShell's main area
   * has. Turn it off inside AppShell, which has its own. Default `true`.
   */
  inset?: boolean;
  /** Space between the page’s children, as Stack’s `gap`. Default `'lg'`. */
  gap?: StackProps['gap'];
}

/**
 * A page’s box for an app without AppShell: a gutter, a widest width and the space between its sections, a PageHeader
 * first. A `<div>` by default; pass `render={<main />}` when it’s the page’s main content.
 */
export function Page(props: PageProps) {
  const { render, width = 'flow', inset = true, gap = 'lg', className, ...rest } = props;
  return useRender({
    defaultTagName: 'div',
    render,
    props: mergeProps<'div'>(
      { className: cn('ld-page', `ld-stack-${gap}`, width !== 'full' && `ld-page-${width}`, inset && 'ld-page-inset', className as string) },
      rest,
    ),
  });
}

export interface StackProps extends useRender.ComponentProps<'div'> {
  /**
   * Space between the children: `'sm'` is `--space-2`, for parts of one thing, `'md'` is `--space-4`, for related
   * things, and `'lg'` is `--space-6`, for a page’s sections, as Lede’s flows space theirs. Default `'lg'`.
   */
  gap?: 'sm' | 'md' | 'lg';
}

/**
 * Children one under another, with the same space between each. A `<div>` by default; pass `render={<section />}` for
 * a titled region. A PageHeader in it drops its own bottom margin, so the gap alone spaces it.
 */
export function Stack(props: StackProps) {
  const { render, gap = 'lg', className, ...rest } = props;
  return useRender({
    defaultTagName: 'div',
    render,
    props: mergeProps<'div'>({ className: cn('ld-stack', `ld-stack-${gap}`, className as string) }, rest),
  });
}
