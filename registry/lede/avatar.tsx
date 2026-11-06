import * as React from 'react';
import { cn } from './cn';

export interface AvatarProps {
  /** Whose avatar this is: the source of the initials and, unless `alt` is set, the text alternative. */
  name: string;
  /** Picture URL. With none, or if it fails to load, the initials show. */
  src?: string;
  /** Text alternative. Default `name`. Pass `""` when the name is already beside the avatar, so it isn't read twice. */
  alt?: string;
  /** `'md'` fits ListRow's leading slot, and `'lg'` leads a profile. Default `'md'`. */
  size?: 'md' | 'lg';
  className?: string;
}

const graphemes = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter() : null;
/** The first character as a person sees it, so a flag or an emoji stays whole. */
const firstCharacter = (word: string) => (graphemes ? [...graphemes.segment(word)][0]?.segment : [...word][0]) ?? '';

/** First and last initials: "Hana Sato" is "HS". */
function initials(name: string) {
  const words = name.trim().split(/\s+/);
  return (words.length > 1 ? [words[0], words.at(-1)!] : words).map((w) => firstCharacter(w)).join('').toUpperCase();
}

/** A real `<img>` with alt text when there's a picture, and initials on a tint when there isn't. */
export function Avatar({ name, src, alt = name, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = React.useState<string>();
  const cls = cn('ld-avatar', size === 'lg' && 'ld-avatar-lg', className);
  if (src && src !== failed) return <img className={cls} src={src} alt={alt} onError={() => setFailed(src)} />;
  return <span className={cls} {...(alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true })}>{initials(name)}</span>;
}
