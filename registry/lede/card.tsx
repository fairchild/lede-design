import { useRender } from '@base-ui/react/use-render';
import { mergeProps } from '@base-ui/react/merge-props';
import { cn } from './cn';

export interface CardProps extends useRender.ComponentProps<'div'> {
  /** Outer radius: `'md'` is `--radius-lg`, `'xl'` is `--radius-xl`. Default `'md'`. */
  size?: 'md' | 'xl';
  /** Inner padding: `'sm'` is `--space-2`, `'md'` is `--space-4`, `'lg'` is `--space-6`. Default `'sm'`. A child with the `ld-concentric` class gets the card's radius less its padding. */
  padding?: 'sm' | 'md' | 'lg';
  surface?: 'card' | 'muted' | 'glass';
}

/** A neutral `<div>` by default. Pass `render={<article />}` for a self-contained item, or `render={<section />}` for a titled region. */
export function Card(props: CardProps) {
  const { render, size, padding, surface, className, ...rest } = props;
  return useRender({
    defaultTagName: 'div',
    render,
    props: mergeProps<'div'>(
      {
        className: cn(
          'ld-card', size === 'xl' && 'ld-card-xl', padding && padding !== 'sm' && `ld-card-pad-${padding}`,
          surface === 'muted' && 'ld-card-muted', surface === 'glass' && 'ld-card-glass ld-glass', className as string,
        ),
      },
      rest,
    ),
  });
}
