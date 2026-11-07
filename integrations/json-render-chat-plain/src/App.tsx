import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { JSONUIProvider, Renderer, buildSpecFromParts } from '@json-render/react';
import { registry } from './registry';
import { MockChatTransport } from './mock-transport';

const api = import.meta.env.VITE_CHAT_API as string | undefined;
const transport = api ? new DefaultChatTransport({ api }) : new MockChatTransport();
const ASSISTANT = 'Daybook';
const SUGGESTIONS = ['Show my notification settings', 'What’s in my inbox?', 'Help me sign up', 'Fail once'];

const button = 'inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50';
const primary = `${button} bg-primary text-primary-foreground hover:bg-primary/90`;
const secondary = `${button} bg-secondary text-secondary-foreground hover:bg-secondary/80`;

type Ending = { kind: 'stopped' } | { kind: 'failed'; message: string };

export function App() {
  const [dark, setDark] = React.useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const { messages, sendMessage, status, stop, error, regenerate } = useChat({ transport });
  const [draft, setDraft] = React.useState('');
  const [stopped, setStopped] = React.useState<Set<string>>(() => new Set());
  const [notes, setNotes] = React.useState<Record<string, string[]>>({});
  const input = React.useRef<HTMLTextAreaElement>(null);
  const focusComposer = () => input.current?.focus();
  const busy = status === 'submitted' || status === 'streaming';
  const last = messages.at(-1);

  React.useLayoutEffect(() => void document.documentElement.classList.toggle('dark', dark), [dark]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    void sendMessage({ text: text.trim() });
    setDraft('');
    focusComposer();
  };

  const onStop = () => {
    if (last?.role === 'assistant') setStopped((prev) => new Set(prev).add(last.id));
    void stop();
    focusComposer();
  };

  // Stop and Try again leave as the reply ends. Focus then returns to the composer, so it never falls to `<body>`.
  React.useEffect(() => {
    if (!busy && (document.activeElement === document.body || !document.activeElement)) focusComposer();
  }, [busy]);

  const log = React.useRef<HTMLElement>(null);
  const following = React.useRef(true);
  React.useLayoutEffect(() => {
    const el = log.current;
    if (el && following.current) el.scrollTop = el.scrollHeight;
  });

  const note = (id: string) => (name: string, params: Record<string, unknown>) => {
    const detail = typeof params?.id === 'string' ? ` (${params.id})` : typeof params?.form === 'string' ? ` (${params.form})` : '';
    setNotes((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), `You chose ${name}${detail}.`] }));
  };

  const endingOf = (m: UIMessage, i: number): Ending | undefined =>
    status === 'error' && i === messages.length - 1 && m.role === 'assistant' ? { kind: 'failed', message: error?.message ?? 'The reply failed.' }
    : stopped.has(m.id) ? { kind: 'stopped' }
    : undefined;

  const reply = last?.role === 'assistant' ? last : undefined;
  const firstLine = reply?.parts.find((p) => p.type === 'text')?.text.split(/(?<=[.!?])\s/)[0];
  const statusText =
    busy ? `${ASSISTANT} is replying.`
    : status === 'error' ? `The reply failed: ${error?.message ?? 'unknown error'}`
    : reply && stopped.has(reply.id) ? 'You stopped the reply.'
    : firstLine ? `${ASSISTANT} replied: ${firstLine}` : '';

  return (
    <main className="mx-auto grid h-dvh max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-4 px-4 pt-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold">Ask Daybook</h1>
          <p className="text-sm text-muted-foreground">
            A chat whose replies can include screens that json-render builds from its shadcn components. {api ? `Replies come from ${api}.` : 'Replies come from a script, so it needs no network or key.'}
          </p>
        </div>
        <button type="button" className={secondary} aria-pressed={dark} onClick={() => setDark((d) => !d)}>Dark mode</button>
      </header>
      <section
        ref={log}
        aria-label="Conversation"
        tabIndex={0}
        className="overflow-y-auto overscroll-contain rounded-md p-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onScroll={(e) => { const el = e.currentTarget; following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48; }}
      >
        {messages.length ? (
          <ol className="grid gap-6">
            {messages.map((m, i) => (
              <Message key={m.id} message={m} live={busy && i === messages.length - 1} ending={endingOf(m, i)} notes={notes[m.id] ?? []} onAction={note(m.id)} />
            ))}
          </ol>
        ) : (
          <div className="grid gap-3">
            <p className="text-muted-foreground">Ask about your notifications, inbox, sign-up or projects. Each reply can bring a screen with it.</p>
            <ul className="flex flex-wrap gap-2" aria-label="Suggestions">
              {SUGGESTIONS.map((s) => <li key={s}><button type="button" className={secondary} onClick={() => send(s)}>{s}</button></li>)}
            </ul>
          </div>
        )}
      </section>
      <div className="grid gap-3 border-t pt-3 pb-4">
        <p role="status" className={statusText ? 'text-sm' : 'sr-only'}>{statusText}</p>
        {status === 'error' ? <button type="button" className={`${secondary} justify-self-start`} onClick={() => void regenerate()}>Try again</button> : null}
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
          <label htmlFor="message" className="text-sm font-medium">Message</label>
          <textarea
            id="message"
            ref={input}
            rows={2}
            value={draft}
            aria-describedby="message-hint"
            className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
            }}
          />
          <p id="message-hint" className="text-sm text-muted-foreground">Enter sends, and Shift+Enter starts a new line.</p>
          <div className="flex justify-end gap-2">
            {busy ? <button type="button" className={secondary} onClick={onStop}>Stop</button> : null}
            <button type="submit" className={primary}>Send</button>
          </div>
        </form>
      </div>
    </main>
  );
}

interface MessageProps {
  message: UIMessage;
  live: boolean;
  ending?: Ending;
  notes: string[];
  onAction: (name: string, params: Record<string, unknown>) => void;
}

/** One turn: its author as a heading, its text and, where the reply has one, the screen its spec describes. */
function Message({ message, live, ending, notes, onAction }: MessageProps) {
  const spec = buildSpecFromParts(message.parts.filter((p) => p.type.startsWith('data-')) as Array<{ type: string; data: unknown }>);
  const ready = !!spec?.elements[spec.root];
  const handlers = React.useMemo(() => Object.fromEntries(['open', 'archive', 'submit'].map((name) => [name, (params: Record<string, unknown>) => onAction(name, params)])), [onAction]);
  const firstData = message.parts.findIndex((p) => p.type.startsWith('data-'));
  const user = message.role === 'user';

  return (
    <li className={user ? 'grid max-w-[85%] gap-2 justify-self-end rounded-xl bg-muted px-4 py-3' : 'grid min-w-0 gap-2'}>
      <h2 className={user ? 'text-sm font-semibold' : 'text-sm font-semibold text-muted-foreground'}>{user ? 'You' : ASSISTANT}</h2>
      {message.parts.map((part, i) => {
        if (part.type === 'text') return part.text.trim() ? <p key={i} className="whitespace-pre-wrap [overflow-wrap:anywhere]">{part.text.trim()}</p> : null;
        if (i !== firstData || !ready) return null;
        return (
          <div key="spec" className="rounded-xl border p-4">
            <JSONUIProvider registry={registry} initialState={spec.state ?? {}} handlers={handlers}>
              <Renderer spec={spec} registry={registry} loading={live} />
            </JSONUIProvider>
          </div>
        );
      })}
      {ending ? (
        <p className="text-sm italic text-muted-foreground">{ending.kind === 'stopped' ? 'You stopped this reply.' : `This reply failed: ${ending.message}`}</p>
      ) : null}
      {notes.map((n, i) => <p key={i} className="text-sm text-muted-foreground">{n}</p>)}
    </li>
  );
}
