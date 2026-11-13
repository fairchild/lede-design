import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { Spec } from '@json-render/core';
import { ThemeProvider } from '@/components/lede/theme-provider';
import { SpecView, type HeldAction } from '@/components/lede/json-render/spec-view';
import '../src/styles.css';

/**
 * A page for the browser tests: `window.draw(spec, streaming)` draws a spec in SpecView, as a host page does, and each
 * action a spec runs lands in `window.ran`, each held action in `window.held` and each state in `window.states`.
 * Only the dev server serves it; the build leaves it out.
 */
declare global {
  interface Window {
    draw: (spec: Spec | null, streaming?: boolean) => void;
    ran: Array<{ name: string; params: unknown }>;
    held: HeldAction[];
    states: Array<Record<string, unknown>>;
  }
}

window.ran = [];
window.held = [];
window.states = [];
const handlers = {
  archive: (params: { id: string }) => { window.ran.push({ name: 'archive', params }); },
  submit: (params: { form: string; values?: Record<string, unknown> }) => { window.ran.push({ name: 'submit', params }); },
};

const root = createRoot(document.getElementById('root')!);
window.draw = (spec, streaming = false) => flushSync(() => root.render(
  <ThemeProvider scheme="light" surface="grouped">
    <main className="jr-page">
      <h1>Fixture</h1>
      <SpecView spec={spec} streaming={streaming} handlers={handlers} onActionHeld={(h) => window.held.push(h)} onStateChange={(s) => window.states.push(s)} />
    </main>
  </ThemeProvider>,
));
window.draw(null);
