import * as React from 'react';
import { cn } from './cn';

export interface AvatarProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'role'> {
  /** Whose avatar this is: the source of the initials and, unless `alt` is set, the text alternative. */
  name: string;
  /** Picture URL. With none, or if it fails to load, the initials show. */
  src?: string;
  /** Text alternative. Default `name`. Pass `""` when the name is already beside the avatar, so it isn't read twice. */
  alt?: string;
  /** `'md'` fits ListRow's leading slot, and `'lg'` leads a profile. Default `'md'`. */
  size?: 'md' | 'lg';
  /** The `<img>`, or the `<span>` of initials. */
  ref?: React.Ref<HTMLImageElement | HTMLSpanElement>;
}

const graphemes = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter() : null;
/** The first character as a person sees it, so a flag or an emoji stays whole. */
const firstCharacter = (word: string) => (graphemes ? [...graphemes.segment(word)][0]?.segment : [...word][0]) ?? '';

/** First and last initials: "Hana Sato" is "HS". */
function initials(name: string) {
  const words = name.trim().split(/\s+/);
  return (words.length > 1 ? [words[0], words.at(-1)!] : words).map((w) => firstCharacter(w)).join('').toUpperCase();
}

/**
 * A real `<img>` with alt text when there's a picture, and initials on a tint when there isn't. Other HTML attributes
 * and `ref` go on whichever of the two renders.
 */
export function Avatar({ name, src, alt = name, size = 'md', className, ref, onError, ...rest }: AvatarProps) {
  const [failed, setFailed] = React.useState<string>();
  const cls = cn('ld-avatar', size === 'lg' && 'ld-avatar-lg', className);
  if (src && src !== failed) {
    return (
      <img
        {...rest}
        ref={ref as React.Ref<HTMLImageElement>}
        className={cls}
        src={src}
        alt={alt}
        onError={(e) => { setFailed(src); onError?.(e); }}
      />
    );
  }
  return (
    <span {...rest} ref={ref as React.Ref<HTMLSpanElement>} className={cls} {...(alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true })}>
      {initials(name)}
    </span>
  );
}
