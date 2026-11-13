import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { createStateStore, SPEC_DATA_PART_TYPE, type Spec } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import { catalog, type CatalogAction } from '../screens/catalog';
import { registry } from '../screens/registry';
import { specFromParts } from '../screens/patches';
import { transport, chatApi } from './transport';
import type { AppMessage } from './app-message';
import { describe } from './describe';
import { ASSISTANT, SUGGESTIONS } from './assistant';
import './chat.css';

const SCHEMES = ['System', 'Light', 'Dark'] as const;
type Scheme = (typeof SCHEMES)[number];
type Ending = 'stopped' | 'failed';
type Changes = Record<string, unknown>;
type Change = { path: string; value: unknown };
type Handlers = Record<string, (params: Record<string, unknown>) => void>;

/** The name of the focused control in a screen: the control a person just used. */
const focusedName = () => {
  const el = document.activeElement?.closest('.jrc-screen') ? document.activeElement : null;
  return el?.getAttribute('aria-label') ?? el?.textContent?.trim() ?? undefined;
};
const ACTIONS = Object.keys(catalog.data.actions) as CatalogAction[];

const clock = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const textOf = (message: AppMessage) => message.parts.flatMap((p) => (p.type === 'text' && p.text.trim() ? [p.text.trim()] : []));

/** Why a finished reply shows nothing: no words and no screen, or a screen that can't draw, such as patches to an old one. */
const emptiness = (message: AppMessage) => {
  const spec = specFromParts(message.parts);
  if (spec?.elements[spec.root]) return undefined;
  if (message.parts.some((p) => p.type === SPEC_DATA_PART_TYPE)) return 'The reply’s screen couldn’t be drawn.';
  return textOf(message).length ? undefined : 'The reply was empty.';
};

/** A screen's state as the person left it: the spec's state with each change they made written over it. */
const leftIn = (spec: Spec, changes: Changes) => {
  const store = createStateStore(structuredClone(spec.state ?? {}));
  store.update(changes);
  return store.getSnapshot();
};

const dark = matchMedia('(prefers-color-scheme: dark)');
const useDark = (scheme: Scheme) => {
  const system = React.useSyncExternalStore((on) => { dark.addEventListener('change', on); return () => dark.removeEventListener('change', on); }, () => dark.matches);
  return scheme === 'Dark' || (scheme === 'System' && system);
};

/** The chat page: the conversation, then the composer at the foot of the window. */
export function Chat() {
  const [scheme, setScheme] = React.useState<Scheme>('System');
  const isDark = useDark(scheme);
  const { messages, sendMessage, status, stop, error, regenerate } = useChat<AppMessage>({ transport });
  const [draft, setDraft] = React.useState('');
  const [endings, setEndings] = React.useState<Record<string, Ending>>({});
  const [notes, setNotes] = React.useState<Record<string, string[]>>({});
  const [times, setTimes] = React.useState<Record<string, Date>>({});
  const form = React.useRef<HTMLFormElement>(null);
  // What the person changed in each screen, sent with the next message so the model sees what they entered.
  const changes = React.useRef<Record<string, Changes>>({});
  const latest = React.useRef(messages);
  latest.current = messages;
  const body = () => ({
    screens: Object.fromEntries(latest.current.flatMap((m) => {
      const spec = changes.current[m.id] ? specFromParts(m.parts) : null;
      return spec ? [[m.id, leftIn(spec, changes.current[m.id])]] : [];
    })),
  });
  const keep = React.useCallback((id: string, made: Change[]) => {
    changes.current[id] = { ...changes.current[id], ...Object.fromEntries(made.map((c) => [c.path, c.value])) };
  }, []);
  const focusComposer = () => form.current?.querySelector('textarea')?.focus();
  const busy = status === 'submitted' || status === 'streaming';
  const last = messages.at(-1);

  React.useLayoutEffect(() => void document.documentElement.classList.toggle('dark', isDark), [isDark]);

  React.useEffect(() => {
    const fresh = messages.filter((m) => !times[m.id]);
    if (fresh.length) setTimes((prev) => ({ ...prev, ...Object.fromEntries(fresh.map((m) => [m.id, new Date()])) }));
  }, [messages, times]);

  // A message sent while a reply streams waits for that reply to end, a later one takes its place and Escape cancels it.
  const [waiting, setWaiting] = React.useState<string>();
  const [said, setSaid] = React.useState('');
  const send = (text: string, keepDraft = false) => {
    if (!text.trim()) return;
    setWaiting(busy ? text.trim() : undefined);
    setSaid(busy ? `Next, once this reply ends: “${text.trim()}”.` : '');
    if (!keepDraft) setDraft('');
    focusComposer();
    if (busy) return;
    void sendMessage({ text: text.trim() }, { body: body() });
  };
  React.useEffect(() => { if (!busy && waiting) send(waiting, true); });
  const cancelWaiting = () => {
    if (!waiting) return false;
    setWaiting(undefined);
    setSaid(`You canceled “${waiting}”.`);
    return true;
  };

  // A reply stopped before it began has no message of its own, so the ending sits on the question.
  const onStop = () => {
    if (last) setEndings((prev) => ({ ...prev, [last.id]: 'stopped' }));
    void stop();
    focusComposer();
  };

  const retry = () => {
    focusComposer();
    void regenerate({ body: body() });
  };

  // Stop leaves as the reply ends, so focus returns to the composer and never falls to `<body>`. On load it lands there.
  React.useEffect(() => {
    if (!busy && (document.activeElement === document.body || !document.activeElement)) focusComposer();
  }, [busy]);

  // The window follows a reply while it streams, until the question that asked for it reaches the top. A scroll it
  // didn't make itself stops it until the next send.
  const lastUser = messages.findLast((m) => m.role === 'user')?.id;
  const following = React.useRef(false);
  const placed = React.useRef<number | null>(null);
  React.useEffect(() => {
    following.current = true;
    placed.current = null;
    addEventListener('scroll', moved, { passive: true });
    return () => removeEventListener('scroll', moved);
  }, [lastUser]);
  const moved = () => { if (placed.current !== null && Math.abs(scrollY - placed.current) > 1) following.current = false; };
  React.useLayoutEffect(() => {
    const turn = lastUser && document.querySelector<HTMLElement>(`[data-message="${CSS.escape(lastUser)}"]`);
    moved();
    if (!busy || !turn || !following.current) return;
    const top = turn.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(turn).scrollMarginTop);
    scrollTo({ top: Math.min(top, document.documentElement.scrollHeight - innerHeight) });
    placed.current = scrollY;
  }, [messages, busy, lastUser]);

  // The sticky composer covers the foot of the window, so the page keeps that much room when it scrolls a control into
  // view. While the person types in the composer the room goes; Tab brings it back before focus moves on.
  React.useEffect(() => {
    const footer = form.current?.closest<HTMLElement>('.jrc-footer');
    if (!footer) return;
    const root = document.documentElement;
    const pad = (tabbing = false) => {
      const typing = !tabbing && !!document.activeElement?.matches('.jrc-footer textarea');
      root.style.scrollPaddingBottom = getComputedStyle(footer).position === 'sticky' && !typing ? `${footer.offsetHeight}px` : '';
    };
    const refresh = () => pad();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Tab') pad(true); };
    const observer = new ResizeObserver(refresh);
    observer.observe(footer);
    addEventListener('resize', refresh);
    addEventListener('focusin', refresh);
    addEventListener('keydown', onKey, true);
    return () => {
      observer.disconnect();
      removeEventListener('resize', refresh);
      removeEventListener('focusin', refresh);
      removeEventListener('keydown', onKey, true);
      root.style.scrollPaddingBottom = '';
    };
  }, []);

  const note = React.useCallback((id: string, text: string) => setNotes((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), text] })), []);

  const reply = last?.role === 'assistant' ? last : undefined;
  const empty = status === 'ready' && reply && !endings[reply.id] ? emptiness(reply) : undefined;
  const failed = status === 'error' || empty ? last?.id : undefined;
  const statusText =
    busy ? `${ASSISTANT} is replying.`
    : status === 'error' ? `The reply failed: ${error?.message ?? 'unknown error'}`
    : empty ? `The reply failed: ${empty}`
    : last && endings[last.id] === 'stopped' ? 'You stopped the reply.'
    : reply ? `${ASSISTANT} replied: ${textOf(reply)[0]?.split(/(?<=[.!?])\s/)[0] ?? 'a screen.'}` : '';

  return (
    <main className="jrc-page">
      <header className="jrc-header">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold">Ask {ASSISTANT}</h1>
          <p className="text-muted-foreground">
            {chatApi ? `Replies come from ${chatApi}, and can bring a screen with them.` : 'Replies come from a script here, and can bring a screen with them.'}
          </p>
        </div>
        <fieldset className="jrc-segmented">
          <legend className="sr-only">Appearance</legend>
          {SCHEMES.map((s) => (
            <label key={s}>
              <input type="radio" name="appearance" value={s} checked={scheme === s} onChange={() => setScheme(s)} />
              <span>{s}</span>
            </label>
          ))}
        </fieldset>
      </header>
      <section aria-label="Conversation">
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
                onStateChange={keep}
              />
            ))}
            {status === 'submitted' && last?.role === 'user' ? (
              <li className="jrc-message" data-role="assistant" aria-hidden="true">
                <span className="jrc-avatar">{ASSISTANT[0]}</span>
                <p className="jrc-typing"><span /><span /><span /></p>
              </li>
            ) : null}
          </ol>
        ) : (
          <div className="grid gap-3">
            <p className="text-muted-foreground">Ask about your week, inbox, notifications, sign-up or projects. Each reply can bring a screen you can use.</p>
            <ul className="flex flex-wrap gap-2" aria-label="Suggestions">
              {SUGGESTIONS.map((s) => <li key={s}><button type="button" className="jrc-button jrc-secondary" onClick={() => send(s)}>{s}</button></li>)}
            </ul>
          </div>
        )}
      </section>
      <div className="jrc-footer">
        <p role="status" className={failed ? 'jrc-status' : 'sr-only'}>{statusText}</p>
        {failed ? <button type="button" className="jrc-button jrc-secondary justify-self-start" onClick={retry}>Try again</button> : null}
        <p role="status" className={said ? 'text-sm text-muted-foreground' : 'sr-only'}>{said}</p>
        <form ref={form} className="jrc-composer" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
          <div className="grid gap-2">
            <label htmlFor="message" className="text-sm font-medium">Message</label>
            <textarea
              id="message"
              rows={2}
              value={draft}
              placeholder={`Ask ${ASSISTANT}…`}
              aria-describedby="message-hint"
              className="jrc-input"
              onChange={(e) => setDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && (waiting || busy)) { e.preventDefault(); if (!cancelWaiting()) onStop(); }
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
              }}
            />
            <p id="message-hint" className="text-sm text-muted-foreground">Enter sends, once any reply ends, and Shift+Enter starts a new line. Escape cancels a waiting message, then stops a reply.</p>
          </div>
          <div className="jrc-composer-actions">
            {busy ? <button type="button" className="jrc-button jrc-secondary" onClick={onStop}>Stop</button> : null}
            <button type="submit" className="jrc-button jrc-primary">Send</button>
          </div>
        </form>
      </div>
    </main>
  );
}

interface TurnProps {
  message: AppMessage;
  time?: Date;
  live: boolean;
  ending?: Ending;
  notes: string[];
  onNote: (id: string, text: string) => void;
  onStateChange: (id: string, changes: Change[]) => void;
}

/** One turn: its author and time as a heading, its text and then, when the reply has one, the screen its spec describes. */
function Turn({ message, time, live, ending, notes, onNote, onStateChange }: TurnProps) {
  const spec = React.useMemo(() => specFromParts(message.parts), [message.parts]);
  const specRef = React.useRef(spec);
  specRef.current = spec;
  // json-render reads its handlers once, when the screen mounts, so these read the latest spec through a ref.
  const handlers = React.useMemo<Handlers>(
    () => Object.fromEntries(ACTIONS.map((name) => [name, (params: Record<string, unknown>) => onNote(message.id, describe(specRef.current, name, params, focusedName()))])),
    [message.id, onNote],
  );
  const keep = React.useCallback((made: Change[]) => onStateChange(message.id, made), [message.id, onStateChange]);
  const author = message.role === 'user' ? 'You' : ASSISTANT;

  return (
    <li className="jrc-message" data-role={message.role} data-message={message.id}>
      {message.role === 'assistant' ? <span className="jrc-avatar" aria-hidden="true">{ASSISTANT[0]}</span> : null}
      <div className="jrc-body">
        <h2 className="jrc-author">
          {author}
          {time ? <> · <time dateTime={time.toISOString()}>{clock.format(time)}</time></> : null}
        </h2>
        {textOf(message).map((text, i) => <p key={i} className="jrc-text">{text}</p>)}
        {spec?.elements[spec.root] ? (
          <div className="jrc-screen">
            <JSONUIProvider registry={registry} initialState={spec.state ?? {}} handlers={handlers} onStateChange={keep}>
              <Renderer spec={spec} registry={registry} loading={live} />
            </JSONUIProvider>
          </div>
        ) : null}
        {notes.length ? (
          <ul className="jrc-notes" aria-label="What you did here">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        ) : null}
        {ending && message.role === 'assistant' ? <EndingNote ending={ending} /> : null}
      </div>
      {ending && message.role === 'user' ? <EndingNote ending={ending} /> : null}
    </li>
  );
}

/** How a reply ended early. The status line above the composer says why a reply failed. */
const EndingNote = ({ ending }: { ending: Ending }) => (
  <p className="jrc-ending">{ending === 'stopped' ? 'You stopped this reply.' : 'This reply failed.'}</p>
);
