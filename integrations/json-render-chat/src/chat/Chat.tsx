import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { ThemeProvider } from '@/components/lede/theme-provider';
import { Avatar } from '@/components/lede/avatar';
import { Button } from '@/components/lede/button';
import { SegmentedControl } from '@/components/lede/segmented-control';
import { TextField } from '@/components/lede/text-field';
import { PageHeader } from '@/components/lede/blocks/page-header';
import { catalog, type CatalogAction } from '@/components/lede/json-render/catalog';
import { specFromParts } from '@/components/lede/json-render/patches';
import { SpecView, type SpecHandlers } from '@/components/lede/json-render/spec-view';
import { transport, chatApi } from './transport';
import type { AppMessage } from './app-message';
import { describe } from './describe';
import { ASSISTANT, SUGGESTIONS } from './assistant';
import './chat.css';

const SCHEMES = ['System', 'Light', 'Dark'] as const;
type Scheme = (typeof SCHEMES)[number];
type Ending = 'stopped' | 'failed';

/** The name of the focused control in a screen, such as a row's title: the control a person just used. */
const focusedName = () => {
  const el = document.activeElement?.closest('.jrc-screen') ? document.activeElement : null;
  return el?.getAttribute('aria-label') ?? el?.querySelector('.ld-row-title')?.textContent ?? el?.textContent?.trim() ?? undefined;
};
const ACTIONS = Object.keys(catalog.data.actions) as CatalogAction[];

const clock = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const textOf = (message: AppMessage) => message.parts.flatMap((p) => (p.type === 'text' && p.text.trim() ? [p.text.trim()] : []));

/** The chat page: the conversation, then the composer at the foot of the window. */
export function Chat() {
  const [scheme, setScheme] = React.useState<Scheme>('System');
  const { messages, sendMessage, status, stop, error, regenerate } = useChat<AppMessage>({ transport });
  const [draft, setDraft] = React.useState('');
  const [endings, setEndings] = React.useState<Record<string, Ending>>({});
  const [notes, setNotes] = React.useState<Record<string, string[]>>({});
  const [times, setTimes] = React.useState<Record<string, Date>>({});
  const form = React.useRef<HTMLFormElement>(null);
  const focusComposer = () => form.current?.querySelector('textarea')?.focus();
  const busy = status === 'submitted' || status === 'streaming';
  const last = messages.at(-1);

  React.useEffect(() => {
    const fresh = messages.filter((m) => !times[m.id]);
    if (fresh.length) setTimes((prev) => ({ ...prev, ...Object.fromEntries(fresh.map((m) => [m.id, new Date()])) }));
  }, [messages, times]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    void sendMessage({ text: text.trim() });
    setDraft('');
    focusComposer();
  };

  // A reply stopped before it began has no message of its own, so the ending sits on the question.
  const onStop = () => {
    if (last) setEndings((prev) => ({ ...prev, [last.id]: 'stopped' }));
    void stop();
    focusComposer();
  };

  const retry = () => {
    focusComposer();
    void regenerate();
  };

  // A control that held focus can leave as the reply ends, such as Stop. Focus then returns to the composer, where the
  // person acts next, so it never falls to `<body>`. On load it lands there too: a chat's next act is to type.
  React.useEffect(() => {
    if (!busy && (document.activeElement === document.body || !document.activeElement)) focusComposer();
  }, [busy]);

  // The window follows a reply as it grows, until the question that asked for it reaches the top: the question and
  // the start of its reply stay in view together. Scrolling by hand stops the following until the next send.
  const lastUser = messages.findLast((m) => m.role === 'user')?.id;
  const following = React.useRef(false);
  React.useEffect(() => {
    following.current = true;
    const stopFollowing = () => { following.current = false; };
    addEventListener('wheel', stopFollowing, { passive: true });
    addEventListener('touchmove', stopFollowing, { passive: true });
    return () => { removeEventListener('wheel', stopFollowing); removeEventListener('touchmove', stopFollowing); };
  }, [lastUser]);
  React.useLayoutEffect(() => {
    const turn = lastUser && document.querySelector<HTMLElement>(`[data-message="${CSS.escape(lastUser)}"]`);
    if (!turn || !following.current) return;
    const top = turn.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(turn).scrollMarginTop);
    scrollTo({ top: Math.min(top, document.documentElement.scrollHeight - innerHeight) });
  });

  // The composer covers the foot of the window while it's sticky, so the page keeps that much room when it scrolls a
  // control into view, such as the last switch of a screen reached with Tab.
  React.useEffect(() => {
    const footer = form.current?.closest<HTMLElement>('.jrc-footer');
    if (!footer) return;
    const root = document.documentElement;
    const pad = () => { root.style.scrollPaddingBottom = getComputedStyle(footer).position === 'sticky' ? `${footer.offsetHeight}px` : ''; };
    const observer = new ResizeObserver(pad);
    observer.observe(footer);
    addEventListener('resize', pad);
    return () => { observer.disconnect(); removeEventListener('resize', pad); root.style.scrollPaddingBottom = ''; };
  }, []);

  const note = React.useCallback((id: string, text: string) => setNotes((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), text] })), []);

  const failed = status === 'error' ? last?.id : undefined;
  const reply = last?.role === 'assistant' ? last : undefined;
  const statusText =
    busy ? `${ASSISTANT} is replying.`
    : status === 'error' ? `The reply failed: ${error?.message ?? 'unknown error'}`
    : last && endings[last.id] === 'stopped' ? 'You stopped the reply.'
    : reply ? `${ASSISTANT} replied: ${textOf(reply)[0]?.split(/(?<=[.!?])\s/)[0] ?? 'a screen.'}` : '';

  return (
    <ThemeProvider scheme={scheme === 'System' ? 'auto' : scheme === 'Dark' ? 'dark' : 'light'} surface="grouped" className="jrc-app">
      <main className="jrc-page">
        <PageHeader
          title={`Ask ${ASSISTANT}`}
          summary={chatApi ? `Replies come from ${chatApi}, and can bring a screen with them.` : 'Replies come from a script here, and can bring a screen with them.'}
          actions={<SegmentedControl label="Appearance" size="sm" options={[...SCHEMES]} value={scheme} onValueChange={(v) => setScheme(v as Scheme)} />}
        />
        <section aria-label="Conversation" className="jrc-conversation">
          {messages.length ? (
            <ol className="jrc-messages">
              {messages.map((m, i) => (
                <Turn
                  key={m.id}
                  message={m}
                  time={times[m.id]}
                  live={busy && i === messages.length - 1}
                  ending={m.id === failed ? 'failed' : endings[m.id]}
                  notes={notes[m.id] ?? []}
                  onNote={note}
                />
              ))}
              {status === 'submitted' && last?.role === 'user' ? (
                <li className="jrc-message" data-role="assistant" aria-hidden="true">
                  <Avatar name={ASSISTANT} alt="" className="jrc-avatar" />
                  <p className="jrc-typing"><span /><span /><span /></p>
                </li>
              ) : null}
            </ol>
          ) : (
            <div className="jrc-empty">
              <p className="jrc-muted">Ask about your week, inbox, notifications, sign-up or projects. Each reply can bring a screen you can use.</p>
              <ul className="jrc-suggestions" aria-label="Suggestions">
                {SUGGESTIONS.map((s) => <li key={s}><Button size="sm" variant="tinted" onClick={() => send(s)}>{s}</Button></li>)}
              </ul>
            </div>
          )}
        </section>
        <div className="jrc-footer">
          <p role="status" className={status === 'error' ? 'jrc-status' : 'ld-sr-only'}>{statusText}</p>
          {status === 'error' ? <Button size="sm" onClick={retry}>Try again</Button> : null}
          <form ref={form} className="jrc-composer" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
            <TextField
              label="Message"
              rows={2}
              value={draft}
              placeholder={`Ask ${ASSISTANT}…`}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(e.currentTarget.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === 'Escape' && busy) { e.preventDefault(); onStop(); }
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
              }}
              hint="Enter sends, Shift+Enter starts a new line and Escape stops a reply."
            />
            <div className="jrc-composer-actions">
              {busy ? <Button type="button" onClick={onStop}>Stop</Button> : null}
              <Button type="submit" variant="filled">Send</Button>
            </div>
          </form>
        </div>
      </main>
    </ThemeProvider>
  );
}

interface TurnProps {
  message: AppMessage;
  time?: Date;
  live: boolean;
  ending?: Ending;
  notes: string[];
  onNote: (id: string, text: string) => void;
}

/** One turn: its author and time as a heading, its text and then, when the reply has one, the screen its spec describes. */
function Turn({ message, time, live, ending, notes, onNote }: TurnProps) {
  const spec = React.useMemo(() => specFromParts(message.parts), [message.parts]);
  const specRef = React.useRef(spec);
  specRef.current = spec;
  // json-render reads its handlers once, when the screen mounts, so these read the latest spec through a ref.
  const handlers = React.useMemo<SpecHandlers>(
    () => Object.fromEntries(ACTIONS.map((name) => [name, (params: Record<string, unknown>) => onNote(message.id, describe(specRef.current, name, params, focusedName()))])),
    [message.id, onNote],
  );
  const author = message.role === 'user' ? 'You' : ASSISTANT;

  return (
    <li className="jrc-message" data-role={message.role} data-message={message.id}>
      {message.role === 'assistant' ? <Avatar name={ASSISTANT} alt="" className="jrc-avatar" /> : null}
      <div className="jrc-body">
        <h2 className="jrc-author">
          {author}
          {time ? <> · <time dateTime={time.toISOString()}>{clock.format(time)}</time></> : null}
        </h2>
        {textOf(message).map((text, i) => <p key={i} className="jrc-text">{text}</p>)}
        {spec?.elements[spec.root] ? (
          <div className="jrc-screen">
            <SpecView spec={spec} streaming={live} headingLevel={3} handlers={handlers} />
          </div>
        ) : null}
        {notes.length ? (
          <ul className="jrc-notes" aria-label="What you did here">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        ) : null}
        {ending && message.role === 'assistant' ? <Ending ending={ending} /> : null}
      </div>
      {/* A reply that ends before it begins has no turn of its own, so its ending follows the question, outside it. */}
      {ending && message.role === 'user' ? <Ending ending={ending} /> : null}
    </li>
  );
}

/** How a reply ended early. The status line above the composer says why a reply failed. */
const Ending = ({ ending }: { ending: Ending }) => (
  <p className="jrc-ending">{ending === 'stopped' ? 'You stopped this reply.' : 'This reply failed.'}</p>
);
