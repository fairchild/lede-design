import { createContext, useContext, type ReactNode } from 'react';

/**
 * Each docs page also builds as Markdown (`scripts/llms/`), rendered in Node with this context set. The site never sets
 * it, so a page reads `null` and renders as it always does.
 */
export interface Twin {
  /** Each registry item's import line, such as `import { Button } from '@/components/lede/button';`. */
  imports: Record<string, string>;
}

export const TwinContext = createContext<Twin | null>(null);

/** The Markdown build's context, or `null` on the site. */
export const useTwin = () => useContext(TwinContext);

/**
 * A live example. The site renders its children with no element of its own, and the Markdown build leaves it out:
 * the code beside it says the same, and its buttons and fields would read as noise.
 */
export function Live({ children }: { children: ReactNode }) {
  return useTwin() ? null : children;
}

/**
 * In the Markdown build only: a link to each item's reference page, with its import line, after `children`. The site
 * renders `children` alone, so wrapping an element adds no sibling, and React's ids in the page stay the same.
 */
export function ReferenceLinks({ items, children = null }: { items: string[]; children?: ReactNode }) {
  const twin = useTwin();
  if (!twin) return children;
  const links = (
    <ul>
      {items.map((item) => (
        <li key={item}>
          <a href={`/reference/${item}.md`}>Reference for <code>{item}</code></a>
          {twin.imports[item] ? <>: <code>{twin.imports[item]}</code></> : null}
        </li>
      ))}
    </ul>
  );
  return children ? <>{children}{links}</> : links;
}
