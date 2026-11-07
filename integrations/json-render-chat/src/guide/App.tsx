import * as React from 'react';
import { ThemeProvider } from '@/components/lede/theme-provider';
import { GlassBar } from '@/components/lede/glass-bar';
import { LinkProvider, type LinkComponent } from '@/components/lede/link';
import { focusLanding } from '@/components/lede/input-modality';
import { Appearance, ChatPage, schemeOf, type Scheme, type TraceProps } from '../chat/Chat';
import { Trace } from './Trace';
import { BuildIt, HowItWorks, SystemPrompt } from './pages';
import './guide.css';

// The guide around the chat: Try it is the chat, with an account of each reply; How it works and Build it draw the
// README's sections. Each screen has a hash route, so each can be linked, and the chat stays mounted while another
// screen shows, so the conversation is there on the way back.

type Route = 'try' | 'how' | 'build' | 'prompt';
const PATHS: Record<Route, string> = { try: '#/', how: '#/how-it-works', build: '#/build', prompt: '#/prompt' };
const NAV = [
  { value: 'try', label: 'Try it', href: PATHS.try },
  { value: 'how', label: 'How it works', href: PATHS.how },
  { value: 'build', label: 'Build it', href: PATHS.build },
];

/** The screen a hash names, and a question to ask in Try it, as `#/?ask=…` carries. */
export function route(hash: string): { route: Route; ask?: string } {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const found = (Object.keys(PATHS) as Route[]).find((r) => PATHS[r] === `#${path || '/'}`);
  return { route: found ?? 'try', ask: new URLSearchParams(query).get('ask') ?? undefined };
}

interface Place { y: number; focus: Element | null }
type Entry = { n: number; inApp?: boolean };

const trace = (props: TraceProps) => <Trace {...props} />;

/** A link out of a nested screen goes back through history when the person came from inside the guide, so they return to where they were. */
const BackLink: LinkComponent = ({ ref, onClick, ...props }) => (
  <a
    ref={ref}
    {...props}
    onClick={(event) => {
      onClick?.(event);
      if (event.defaultPrevented || !props.className?.includes('ld-back') || !(history.state as Entry | null)?.inApp) return;
      event.preventDefault();
      history.back();
    }}
  />
);

export function App() {
  const [scheme, setScheme] = React.useState<Scheme>('System');
  const [at, setAt] = React.useState(() => route(location.hash));
  const [ask, setAsk] = React.useState<{ text: string; key: number }>();
  // Where the person was in each history entry, so Back returns there: the scroll position and the focused control.
  const places = React.useRef(new Map<number, Place>());
  const entry = React.useRef(0);
  const back = React.useRef<Place | undefined>(undefined);
  const moved = React.useRef(false);

  const arrive = React.useCallback((next: { route: Route; ask?: string }, n: number) => {
    if (next.ask) {
      setAsk({ text: next.ask, key: n });
      history.replaceState(history.state, '', PATHS.try);
    }
    setAt(next);
  }, []);

  React.useLayoutEffect(() => {
    history.scrollRestoration = 'manual';
    const state = history.state as Entry | null;
    entry.current = typeof state?.n === 'number' ? state.n : Date.now();
    if (state?.n !== entry.current) history.replaceState({ n: entry.current }, '');
    arrive(route(location.hash), entry.current);
    const onHash = () => {
      places.current.set(entry.current, { y: scrollY, focus: document.activeElement });
      const known = (history.state as Entry | null)?.n;
      moved.current = true;
      if (typeof known === 'number') {
        back.current = places.current.get(known);
        entry.current = known;
      } else {
        back.current = undefined;
        entry.current = Date.now();
        history.replaceState({ n: entry.current, inApp: true }, '');
      }
      arrive(route(location.hash), entry.current);
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, [arrive]);

  // Each move lands focus once: back on the control the person left, or on the new screen's h1. A question from a link
  // is sent, and the chat puts focus in the composer, as a suggestion's press does. On load, Try it leaves focus to
  // the chat, which starts in the composer.
  React.useLayoutEffect(() => {
    const title = () => focusLanding(document.querySelector<HTMLElement>(`[data-screen="${at.route}"] .ld-page-title`));
    if (!moved.current) {
      if (at.route !== 'try') title();
      return;
    }
    if (at.ask) return;
    const place = back.current;
    scrollTo(0, place?.y ?? 0);
    const focus = place?.focus;
    if (focus instanceof HTMLElement && focus.isConnected && focus !== document.body && focus.checkVisibility()) focus.focus({ preventScroll: true });
    else title();
  }, [at]);

  const nav = NAV.some((item) => item.value === at.route) ? at.route : '';
  return (
    <ThemeProvider scheme={schemeOf(scheme)} surface="grouped" className="jrc-app">
      <LinkProvider component={BackLink}>
        <header className="jrc-top">
          <GlassBar aria-label="Guide" items={NAV} value={nav} />
          <Appearance value={scheme} onValueChange={setScheme} />
        </header>
        <main>
          <div data-screen="try" hidden={at.route !== 'try'}>
            <div className="jrc-page">
              <ChatPage trace={trace} ask={ask} focusOnMount={false} />
            </div>
          </div>
          {at.route === 'how' ? <div data-screen="how"><HowItWorks /></div> : null}
          {at.route === 'build' ? <div data-screen="build"><BuildIt /></div> : null}
          {at.route === 'prompt' ? <div data-screen="prompt"><SystemPrompt /></div> : null}
        </main>
      </LinkProvider>
    </ThemeProvider>
  );
}
