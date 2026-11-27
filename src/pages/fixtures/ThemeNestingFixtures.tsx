import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from '@lede/button';
import { Card } from '@lede/card';
import { PageHeader } from '@lede/blocks/page-header';
import { ThemeProvider } from '@lede/theme-provider';

/** What each theme decides: a `dark:` utility, a Card's -hc edge, a glass Card's material and a Button's motion. */
function Probes({ id, title }: { id: string; title: string }) {
  return (
    <section aria-labelledby={`${id}-title`} className="docs-section" data-probe={id}>
      <h2 id={`${id}-title`} className="text-headline">{title}</h2>
      <p className="dark:underline">Underlined in a dark theme</p>
      <Card data-probe-card="">A card</Card>
      <Card surface="glass" data-probe-glass="">A glass card</Card>
      <Button variant="gray">Press {title}</Button>
    </section>
  );
}

const SLOW = { 'duration-standard': '2s', 'easing-spring': 'ease-in' };

/**
 * A root ThemeProvider with `scheme="inherit"`, in a React root of its own under an element whose `data-theme` a plain
 * script changes, with nothing in React re-rendering.
 */
function InheritsFromScript() {
  const host = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const root = createRoot(host.current!);
    root.render(<ThemeProvider scheme="inherit" contrast="inherit"><p>Inside the separate root</p></ThemeProvider>);
    return () => queueMicrotask(() => root.unmount());
  }, []);
  return (
    <section aria-label="Inherits from a script" className="docs-section">
      <div id="fx-script-theme" data-theme="light">
        <div id="fx-script-closer">
          <div ref={host} />
        </div>
      </div>
      <button type="button" onClick={() => document.getElementById('fx-script-theme')!.setAttribute('data-theme', 'dark-hc')}>Set the outer theme by script</button>
      <button type="button" onClick={() => document.getElementById('fx-script-closer')!.setAttribute('data-theme', 'dark')}>Set a closer theme by script</button>
    </section>
  );
}

export function ThemeNestingFixtures() {
  return (
    <div className="ld-flow">
      <PageHeader title="Theme nesting fixtures" summary="Providers inside providers, for the automated tests. Each probe follows its nearest ThemeProvider." />
      <InheritsFromScript />
      <ThemeProvider scheme="light" contrast="standard" surface="grouped">
        <Probes id="reference" title="Light on its own" />
      </ThemeProvider>
      <ThemeProvider scheme="dark" contrast="high" glass="solid" surface="grouped">
        <Probes id="outer" title="Dark, high contrast, solid glass" />
        <ThemeProvider scheme="light" surface="grouped">
          <Probes id="inherits" title="Light inside dark, glass and contrast unset" />
        </ThemeProvider>
        <ThemeProvider scheme="light" contrast="standard" glass="regular" surface="grouped" tokens={SLOW}>
          <Probes id="nested" title="Light inside dark, slow motion" />
          <ThemeProvider scheme="dark" contrast="high" glass="solid" surface="grouped">
            <Probes id="again" title="Dark inside light inside dark" />
          </ThemeProvider>
        </ThemeProvider>
      </ThemeProvider>
    </div>
  );
}
