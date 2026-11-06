import * as React from 'react';
import { Disclosure } from '@lede/disclosure';
import { tokenize, type Language } from './tokenize';

interface CodeExampleProps {
  /** What the code shows: the closed row's title, and the scroller's name. */
  label: string;
  language: Language;
  code: string;
  defaultOpen?: boolean;
}

/** A Disclosure around highlighted code. Wider than its box, the code becomes a named, focusable region, as Table's box does. */
export function CodeExample({ label, language, code, defaultOpen }: CodeExampleProps) {
  const scroller = React.useRef<HTMLPreElement>(null);
  const [overflowing, setOverflowing] = React.useState(false);
  React.useLayoutEffect(() => {
    const el = scroller.current!;
    const measure = () => setOverflowing(el.scrollWidth > el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <Disclosure className="docs-code-example" title={label} defaultOpen={defaultOpen}>
      <pre ref={scroller} className="docs-code" {...(overflowing ? { role: 'region', tabIndex: 0, 'aria-label': label } : {})}>
        <code>{tokenize(code, language).map(({ text, kind }, i) => (kind ? <span key={i} className={`docs-tk-${kind}`}>{text}</span> : text))}</code>
      </pre>
    </Disclosure>
  );
}
