import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { ThemeProvider } from '@/components/lede/theme-provider';
import { Avatar } from '@/components/lede/avatar';
import { Button } from '@/components/lede/button';
import { SegmentedControl } from '@/components/lede/segmented-control';
import { TextField } from '@/components/lede/text-field';
import { PageHeader } from '@/components/lede/blocks/page-header';
import { SPEC_DATA_PART_TYPE, type Spec } from '@json-render/core';
import { catalog, type CatalogAction } from '@/components/lede/json-render/catalog';
import { specFromParts } from '@/components/lede/json-render/patches';
import { SpecView, type HeldAction, type SpecHandlers } from '@/components/lede/json-render/spec-view';
import { transport, chatApi } from './transport';
import type { AppMessage } from './app-message';
import { describe } from './describe';
import { ASSISTANT, SUGGESTIONS } from './assistant';
import './chat.css';

const SCHEMES = ['System', 'Light', 'Dark'] as const;
export type Scheme = (typeof SCHEMES)[number];
type Ending = 'stopped' | 'failed';
type State = Record<string, unknown>;
/** Each screen's state as the person left it, by the id of the reply that drew it. */
export type Screens = Record<string, State>;

/** The Appearance control, and the ThemeProvider scheme each choice sets. */
export const Appearance = ({ value, onValueChange }: { value: Scheme; onValueChange: (value: Scheme) => void }) => (
  <SegmentedControl label="Appearance" size="sm" options={[...SCHEMES]} value={value} onValueChange={(v) => onValueChange(v as Scheme)} />
);
export const schemeOf = (scheme: Scheme) => (scheme === 'System' ? 'auto' : scheme === 'Dark' ? 'dark' : 'light');

/** The name of the focused control in a screen, such as a row's title: the control a person just used. */
const focusedName = () => {
  const el = document.activeElement?.closest('.jrc-screen') ? document.activeElement : null;
  return el?.getAttribute('aria-label') ?? el?.querySelector('.ld-row-title')?.textContent ?? el?.textContent?.trim() ?? undefined;
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

/** The chat as a page of its own, with its theme and the Appearance control. */
export function Chat() {
  const [scheme, setScheme] = React.useState<Scheme>('System');
  return (
    <ThemeProvider scheme={schemeOf(scheme)} surface="grouped" className="jrc-app">
      <main className="jrc-page">
        <ChatPage actions={<Appearance value={scheme} onValueChange={setScheme} />} />
      </main>
    </ThemeProvider>
  );
}

/** One fired action, with the params its handler received. */
export interface RanAction { name: CatalogAction; params: Record<string, unknown> }

/** What a reply's account of itself can show: the request that asked for it, and what its screen did since. */
export interface TraceProps {
  message: AppMessage;
  /** The spec its parts build so far. */
  spec: Spec | null;
  /** The person's words and each earlier screen's state, as the request that drew this reply sent them. */
  asked?: { text: string; screens: Screens };
  /** The screen's state now. */
  state?: State;
  ran: RanAction[];
  held: HeldAction[];
  live: boolean;
}

export interface ChatPageProps {
  /** Beside the title, such as the Appearance control. */
  actions?: React.ReactNode;
  /** Drawn under each reply, such as an account of how it was made. */
  trace?: (props: TraceProps) => React.ReactNode;
  /** A question to send once, such as from a link; `key` changes for each new one. It waits for a streaming reply. */
  ask?: { text: string; key: number };
  /** PageHeader's `focusOnMount`. Pass false when the page around the chat moves focus itself. */
  focusOnMount?: boolean;
}

/** The chat page: the conversation, then the composer at the foot of the window. */
export function ChatPage({ actions, trace, ask, focusOnMount }: ChatPageProps) {
  const { messages, sendMessage, status, stop, error, regenerate } = useChat<AppMessage>({ transport });
  const [draft, setDraft] = React.useState('');
  const [endings, setEndings] = React.useState<Record<string, Ending>>({});
  const [notes, setNotes] = React.useState<Record<string, string[]>>({});
  const [times, setTimes] = React.useState<Record<string, Date>>({});
  const form = React.useRef<HTMLFormElement>(null);
  // Each screen's state as the person left it, sent with the next message so the model sees what they entered.
  const screens = React.useRef<Record<string, Record<string, unknown>>>({});
  const body = () => ({ screens: screens.current });
  const keep = React.useCallback((id: string, state: Record<string, unknown>) => { screens.current[id] = state; }, []);
  // What each question's request carried, by the question's place among the person's turns, for `trace`.
  const asked = React.useRef<Array<{ text: string; screens: Screens }>>([]);
  const record = (at: number, text: string) => { if (trace) asked.current[at] = { text, screens: structuredClone(screens.current) }; };
  const questions = messages.filter((m) => m.role === 'user').length;
  const focusComposer = () => form.current?.querySelector('textarea')?.focus();
  const busy = status === 'submitted' || status === 'streaming';
  const last = messages.at(-1);

  React.useEffect(() => {
    const fresh = messages.filter((m) => !times[m.id]);
    if (fresh.length) setTimes((prev) => ({ ...prev, ...Object.fromEntries(fresh.map((m) => [m.id, new Date()])) }));
  }, [messages, times]);

  /**
   * Sends `text`, and clears the composer unless the text came from elsewhere, such as a waiting question. A question
   * held for its button waits again for this reply to end; `replace` drops it, as a newer Try link does.
   */
  const send = (text: string, { keepDraft = false, replace = false } = {}) => {
    if (!text.trim() || busy) return;
    record(questions, text.trim());
    void sendMessage({ text: text.trim() }, { body: body() });
    if (!keepDraft) setDraft('');
    if (waiting?.ready && !replace && waiting.text !== text.trim()) {
      setWaiting({ text: waiting.text });
      setSaid(`Next, once this reply ends: “${waiting.text}”.`);
    } else {
      setWaiting(undefined);
      setSaid('');
    }
    focusComposer();
  };

  // A reply stopped before it began has no message of its own, so the ending sits on the question.
  const onStop = () => {
    if (last) setEndings((prev) => ({ ...prev, [last.id]: 'stopped' }));
    void stop();
    focusComposer();
  };

  const retry = () => {
    const question = messages.findLast((m) => m.role === 'user');
    if (question) record(questions - 1, textOf(question).join(' '));
    focusComposer();
    void regenerate({ body: body() });
  };

  // A question from a link waits for a reply that's still streaming, then goes; a later one takes its place, and Escape
  // cancels it. If the person has typed in the composer by then, it waits for a press instead, and their text stays.
  // The page around the chat moved there, so it puts focus in the composer, before this runs. `said` announces each
  // change.
  const asking = React.useRef<number | undefined>(undefined);
  const [waiting, setWaiting] = React.useState<{ text: string; ready?: boolean }>();
  const [said, setSaid] = React.useState('');
  React.useEffect(() => {
    if (!ask || asking.current === ask.key) return;
    asking.current = ask.key;
    if (!busy) return send(ask.text, { keepDraft: true, replace: true });
    setWaiting({ text: ask.text });
    setSaid(waiting ? `Next, once this reply ends: “${ask.text}”, in place of “${waiting.text}”.` : `Next, once this reply ends: “${ask.text}”.`);
  });
  React.useEffect(() => {
    if (busy || !waiting || waiting.ready) return;
    if (!draft.trim()) return send(waiting.text);
    setWaiting({ ...waiting, ready: true });
    setSaid(`“${waiting.text}” is ready to send, and your message stays in the composer.`);
  });
  const cancelWaiting = () => {
    if (!waiting) return false;
    setWaiting(undefined);
    setSaid(`You canceled “${waiting.text}”.`);
    focusComposer();
    return true;
  };
  // A cancel's note lasts while the reply it waited on streams.
  const wasBusy = React.useRef(busy);
  React.useEffect(() => {
    if (wasBusy.current && !busy && !waiting) setSaid('');
    wasBusy.current = busy;
  });

  // A control that held focus can leave as the reply ends, such as Stop. Focus then returns to the composer, where the
  // person acts next, so it never falls to `<body>`. On load it lands there too: a chat's next act is to type.
  React.useEffect(() => {
    if (!busy && (document.activeElement === document.body || !document.activeElement)) focusComposer();
  }, [busy]);

  // The window follows a reply as it grows, until the question that asked for it reaches the top: the question and
  // the start of its reply stay in view together. It follows only while the reply streams, and any scroll it didn't
  // make itself, by wheel, keys, the scrollbar or Tab, stops it until the next send.
  const lastUser = messages.findLast((m) => m.role === 'user')?.id;
  const following = React.useRef(false);
  const placed = React.useRef<number | null>(null);
  React.useEffect(() => {
    following.current = true;
    placed.current = null;
    addEventListener('scroll', moved, { passive: true });
    return () => removeEventListener('scroll', moved);
  }, [lastUser]);
  // A scroll event can arrive after the next chunk has scrolled again, so each follow first checks where the window is.
  const moved = () => { if (placed.current !== null && Math.abs(scrollY - placed.current) > 1) following.current = false; };
  React.useLayoutEffect(() => {
    const turn = lastUser && document.querySelector<HTMLElement>(`[data-message="${CSS.escape(lastUser)}"]`);
    moved();
    if (!busy || !turn || !following.current || !turn.checkVisibility()) return;
    const top = turn.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(turn).scrollMarginTop);
    scrollTo({ top: Math.min(top, document.documentElement.scrollHeight - innerHeight) });
    placed.current = scrollY;
  }, [messages, busy, lastUser]);

  // The composer covers the foot of the window while it's sticky, so the page keeps that much room when it scrolls a
  // control into view, such as the last switch of a screen reached with Shift+Tab. While the person types in the
  // composer the room goes, since the browser would otherwise scroll the page on each key to clear it; Tab brings it
  // back before focus moves on.
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
    <>
      <PageHeader
        title={`Ask ${ASSISTANT}`}
        summary={chatApi ? `Replies come from ${chatApi}, and can bring a screen with them.` : 'Replies come from a script here, and can bring a screen with them.'}
        actions={actions}
        focusOnMount={focusOnMount}
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
                onStateChange={keep}
                asked={m.role === 'assistant' ? asked.current[messages.slice(0, i).filter((q) => q.role === 'user').length - 1] : undefined}
                trace={trace}
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
        {/* The suggestions stay after the first message, so “Fail once” and the rest are always a press away. */}
        {messages.length && !busy ? (
          <ul className="jrc-suggestions jrc-more" aria-label="Suggestions">
            {SUGGESTIONS.map((s) => <li key={s}><Button size="sm" variant="tinted" onClick={() => send(s)}>{s}</Button></li>)}
          </ul>
        ) : null}
      </section>
      {/* Escape backs out one layer per press anywhere in the footer: a waiting question first, then the reply. */}
      <div
        className="jrc-footer"
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key !== 'Escape' || e.defaultPrevented || !(waiting || busy)) return;
          e.preventDefault();
          if (!cancelWaiting()) onStop();
        }}
      >
        <p role="status" className={failed ? 'jrc-status' : 'ld-sr-only'}>{statusText}</p>
        {failed ? <Button size="sm" onClick={retry}>Try again</Button> : null}
        <p role="status" className={said ? 'jrc-queued' : 'jrc-queued ld-sr-only'}>{said}</p>
        {waiting?.ready && !busy ? <Button size="sm" onClick={() => send(waiting.text, { keepDraft: true })}>Send “{waiting.text}”</Button> : null}
        <form ref={form} className="jrc-composer" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
          <TextField
            label="Message"
            rows={2}
            value={draft}
            placeholder={`Ask ${ASSISTANT}…`}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(e.currentTarget.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
            }}
            hint="Enter sends and Shift+Enter starts a new line. Escape cancels a waiting question, then stops a reply."
          />
          <div className="jrc-composer-actions">
            {busy ? <Button type="button" onClick={onStop}>Stop</Button> : null}
            <Button type="submit" variant="filled">Send</Button>
          </div>
        </form>
      </div>
    </>
  );
}

interface TurnProps {
  message: AppMessage;
  time?: Date;
  live: boolean;
  ending?: Ending;
  notes: string[];
  onNote: (id: string, text: string) => void;
  onStateChange: (id: string, state: Record<string, unknown>) => void;
  asked?: TraceProps['asked'];
  trace?: ChatPageProps['trace'];
}

/** One turn: its author and time as a heading, its text and then, when the reply has one, the screen its spec describes. */
function Turn({ message, time, live, ending, notes, onNote, onStateChange, asked, trace }: TurnProps) {
  // What the screen did, kept only for `trace`: without one, a key in a screen draws nothing here again.
  const tracing = !!trace;
  const [ran, setRan] = React.useState<RanAction[]>([]);
  const [held, setHeld] = React.useState<HeldAction[]>([]);
  const [state, setState] = React.useState<State>();
  const spec = React.useMemo(() => specFromParts(message.parts), [message.parts]);
  const specRef = React.useRef(spec);
  specRef.current = spec;
  // json-render reads its handlers once, when the screen mounts, so these read the latest spec through a ref.
  const handlers = React.useMemo<SpecHandlers>(
    () => Object.fromEntries(ACTIONS.map((name) => [name, (params: Record<string, unknown>) => {
      onNote(message.id, describe(specRef.current, name, params, focusedName()));
      if (tracing) setRan((prev) => [...prev, { name, params }]);
    }])),
    [message.id, onNote, tracing],
  );
  const keep = React.useCallback((next: State) => { onStateChange(message.id, next); if (tracing) setState(next); }, [message.id, onStateChange, tracing]);
  const hold = React.useCallback((h: HeldAction) => setHeld((prev) => [...prev, h]), []);
  // Drawn once per spec, so the state this turn keeps for `trace` doesn't draw the screen again on each key.
  const screen = React.useMemo(
    () => <SpecView spec={spec} streaming={live} headingLevel={3} handlers={handlers} onStateChange={keep} onActionHeld={tracing ? hold : undefined} />,
    [spec, live, handlers, keep, hold, tracing],
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
            {screen}
          </div>
        ) : null}
        {notes.length ? (
          <ul className="jrc-notes" aria-label="What you did here">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        ) : null}
        {ending && message.role === 'assistant' ? <Ending ending={ending} /> : null}
        {trace && message.role === 'assistant' ? trace({ message, spec, asked, state, ran, held, live }) : null}
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
