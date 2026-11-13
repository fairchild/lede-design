import * as React from 'react';
import type { Spec } from '@json-render/core';
import type { ComponentRenderer } from '@json-render/react';
import { ThemeProvider } from '@/components/lede/theme-provider';
import { Button } from '@/components/lede/button';
import { Disclosure } from '@/components/lede/disclosure';
import { SegmentedControl } from '@/components/lede/segmented-control';
import { PageHeader } from '@/components/lede/blocks/page-header';
import { prompt } from '@/components/lede/json-render/catalog';
import { SpecView, type SpecHandlers } from '@/components/lede/json-render/spec-view';
import { check } from '@/components/lede/json-render/check';
import { replay } from './stream';
import { specs, type SpecName } from './specs';

const shown = prompt({ mode: 'standalone' });

/** Drawn for a type the registry doesn't have. Without it, json-render logs a warning and draws nothing. */
const Unknown: ComponentRenderer = ({ element }) => (
  <p className="jr-unknown" role="note">
    <strong>{element.type}</strong> isn’t in the catalog, so this fallback stands in for it.
  </p>
);

export function App() {
  const [scheme, setScheme] = React.useState<'Light' | 'Dark'>(() => (matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light'));
  const [name, setName] = React.useState<SpecName>('Settings');
  const [streamed, setStreamed] = React.useState<{ spec: Spec; done: number; total: number } | null>(null);
  const [log, setLog] = React.useState<string[]>([]);
  const [state, setState] = React.useState<Record<string, unknown>>(() => specs.Settings.state ?? {});
  const stream = React.useRef<AbortController | null>(null);

  const full = specs[name];
  const spec = streamed?.spec ?? full;
  const issues = React.useMemo(() => check(full), [full]);
  const streaming = !!streamed && streamed.done < streamed.total;

  // Each catalog action a spec runs, with its params, newest first.
  const handlers = React.useMemo<SpecHandlers>(() => {
    const record = (action: string) => (params: unknown) => setLog((prev) => [`${action} ${JSON.stringify(params ?? {})}`, ...prev].slice(0, 5));
    return { archive: record('archive'), submit: record('submit') };
  }, []);

  const pick = (next: string) => {
    stream.current?.abort();
    setStreamed(null);
    setLog([]);
    setState(specs[next as SpecName].state ?? {});
    setName(next as SpecName);
  };

  const play = () => {
    stream.current?.abort();
    const controller = new AbortController();
    stream.current = controller;
    setStreamed({ spec: { root: '', elements: {} }, done: 0, total: 1 });
    void replay(full, (partial, done, total) => setStreamed({ spec: partial, done, total }), controller.signal);
  };

  const status = streamed
    ? streaming ? `Streaming ${name}.` : `${name} streamed in ${streamed.total} patches.`
    : issues.length === 0 ? `${name}: no issues.` : `${name}: ${issues.length} issues.`;

  return (
    <ThemeProvider scheme={scheme === 'Dark' ? 'dark' : 'light'} surface="grouped" className="jr-app">
      <main className="jr-page">
        <PageHeader
          title="Lede, drawn by json-render"
          summary="A model writes a JSON spec from a catalog of Lede components, and json-render draws it. These specs were recorded, so the page needs no network or key."
          actions={<SegmentedControl label="Appearance" size="sm" options={['Light', 'Dark']} value={scheme} onValueChange={(v) => setScheme(v as 'Light' | 'Dark')} />}
        />
        <div className="jr-controls">
          <SegmentedControl label="Recorded spec" options={Object.keys(specs)} value={name} onValueChange={pick} block />
          <Button variant="tinted" onClick={play}>{streaming ? 'Restart the stream' : 'Replay as a stream'}</Button>
        </div>
        <div className="jr-layout">
          <section className="jr-preview" aria-label="Preview" aria-busy={streaming}>
            <SpecView key={name} spec={spec} streaming={streaming} handlers={handlers} fallback={Unknown} onStateChange={setState} />
          </section>
          <aside className="jr-inspector" aria-labelledby="checks">
            <h2 id="checks" className="text-title-3">Checks</h2>
            <p role="status" className="jr-status">{status}</p>
            {issues.length ? (
              <ul className="jr-issues">{issues.map((issue, i) => <li key={i}><code>{issue}</code></li>)}</ul>
            ) : null}
            <h3 className="text-headline">Actions</h3>
            {log.length ? (
              <ol className="jr-log" aria-label="Actions, newest first">{log.map((line, i) => <li key={`${i}-${line}`}><code>{line}</code></li>)}</ol>
            ) : <p className="jr-muted">Press a button or a row in the preview, and the action it runs shows here.</p>}
          </aside>
        </div>
        <section aria-labelledby="under" className="jr-under">
          <h2 id="under" className="text-title-3">What json-render sees</h2>
          <Disclosure title="The prompt" summary="What prompt() tells a model: the spec format, each component with its props and when to use it, the actions and Lede’s rules." headingLevel={3}>
            <pre className="jr-code" tabIndex={0} aria-label="The prompt"><code>{shown}</code></pre>
          </Disclosure>
          <Disclosure title="The spec" summary={`The JSON a model wrote for ${name}.`} headingLevel={3}>
            <pre className="jr-code" tabIndex={0} aria-label="The spec"><code>{JSON.stringify(full, null, 2)}</code></pre>
          </Disclosure>
          <Disclosure title="The state" summary="What the bound fields and switches have written, through $bindState and setState." headingLevel={3}>
            <pre className="jr-code" tabIndex={0} aria-label="The state"><code>{JSON.stringify(state, null, 2)}</code></pre>
          </Disclosure>
        </section>
      </main>
    </ThemeProvider>
  );
}
