import * as React from 'react';
import { ThemeProvider } from '@/components/lede/theme-provider';
import { GlassBar } from '@/components/lede/glass-bar';
import { LinkProvider, type LinkComponent } from '@/components/lede/link';
import { focusLanding } from '@/components/lede/input-modality';
import { Appearance, ChatPage, schemeOf, type Scheme, type TraceProps } from '../chat/Chat';
import { Trace } from './Trace';

// The pages parse README.md as they load, so a README they can't draw fails there and leaves Try it working.
const pages = () => import('./pages');
const HowItWorks = React.lazy(() => pages().then((m) => ({ default: m.HowItWorks })));
const BuildIt = React.lazy(() => pages().then((m) => ({ default: m.BuildIt })));
const SystemPrompt = React.lazy(() => pages().then((m) => ({ default: m.SystemPrompt })));
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

interface At { route: Route; ask?: string; step?: string }

/** The screen a hash names, a question to ask in Try it (`#/?ask=…`) and a step of How it works (`?step=2`). */
export function route(hash: string): At {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const found = (Object.keys(PATHS) as Route[]).find((r) => PATHS[r] === `#${path || '/'}`);
  const params = new URLSearchParams(query);
  return { route: found ?? 'try', ask: params.get('ask') ?? undefined, step: params.get('step') ?? undefined };
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
      if (event.defaultPrevented || !/(^|\s)ld-back(\s|$)/.test(props.className ?? '') || !(history.state as Entry | null)?.inApp) return;
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

  const arrive = React.useCallback((next: At, n: number) => {
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

  // Each move lands focus once: back on the control the person left, on a step a link names, or on the new screen's
  // h1. A question from a link goes to the composer, as a suggestion's press does, whether it's sent now or waits for
  // a reply. On load, Try it leaves focus to the chat, which starts in the composer.
  const [shown, setShown] = React.useState(0);
  const landed = React.useRef<At | undefined>(undefined);
  React.useLayoutEffect(() => {
    if (landed.current === at) return;
    const screen = document.querySelector<HTMLElement>(`[data-screen="${at.route}"]`);
    const title = () => focusLanding(screen?.querySelector<HTMLElement>('.ld-page-title'));
    // A page that's still loading lands focus once it shows.
    if (!screen?.querySelector('.ld-page-title')) return;
    landed.current = at;
    if (at.ask) {
      screen.querySelector('textarea')?.focus();
      return;
    }
    const step = at.step && document.getElementById(`step-${at.step}`);
    if (step) {
      step.focus();
      return;
    }
    if (!moved.current) {
      if (at.route !== 'try') title();
      return;
    }
    const place = back.current;
    scrollTo(0, place?.y ?? 0);
    const focus = place?.focus;
    if (focus instanceof HTMLElement && focus.isConnected && focus !== document.body && focus.checkVisibility()) focus.focus({ preventScroll: true });
    else title();
  }, [at, shown]);

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
          <React.Suspense fallback={null}>
            {at.route === 'how' ? <div data-screen="how"><Shown onShow={setShown}><HowItWorks /></Shown></div> : null}
            {at.route === 'build' ? <div data-screen="build"><Shown onShow={setShown}><BuildIt /></Shown></div> : null}
            {at.route === 'prompt' ? <div data-screen="prompt"><Shown onShow={setShown}><SystemPrompt /></Shown></div> : null}
          </React.Suspense>
        </main>
      </LinkProvider>
    </ThemeProvider>
  );
}

/** Tells the App each time a lazily loaded page shows, so focus can land on it. */
function Shown({ onShow, children }: { onShow: React.Dispatch<React.SetStateAction<number>>; children: React.ReactNode }) {
  React.useLayoutEffect(() => onShow((n) => n + 1), [onShow]);
  return <>{children}</>;
}
