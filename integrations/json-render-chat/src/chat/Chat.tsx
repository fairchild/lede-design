import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { ThemeProvider } from '@/components/lede/theme-provider';
import { Button } from '@/components/lede/button';
import { SegmentedControl } from '@/components/lede/segmented-control';
import { TextField } from '@/components/lede/text-field';
import { PageHeader } from '@/components/lede/blocks/page-header';
import { transport, chatApi as api } from './transport';
import { SpecView, type SpecActions } from './spec-view';
import { toChatMessage, type ChatMessage } from './chat-message';
import './chat.css';

const ASSISTANT = 'Daybook';
const SUGGESTIONS = ['Show my notification settings', 'What’s in my inbox?', 'Help me sign up', 'Fail once'];

/** The chat page: the conversation, then the composer, which stays at the foot of the window. */
export function Chat() {
  const [scheme, setScheme] = React.useState<'Light' | 'Dark'>(() => (matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light'));
  const { messages, sendMessage, status, stop, error, regenerate } = useChat({ transport });
  const [draft, setDraft] = React.useState('');
  const [stopped, setStopped] = React.useState<Set<string>>(() => new Set());
  const [notes, setNotes] = React.useState<Record<string, string[]>>({});
  const form = React.useRef<HTMLFormElement>(null);
  const focusComposer = () => form.current?.querySelector('textarea')?.focus();
  const busy = status === 'submitted' || status === 'streaming';
  const last = messages.at(-1);

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

  // A control that held focus can leave as the reply ends, such as Stop or Try again. Focus then returns to the
  // composer, where the person acts next, so it never falls to `<body>`.
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

  const note = (id: string) => (name: string, params: Record<string, unknown>) => {
    const detail = typeof params?.id === 'string' ? ` (${params.id})` : typeof params?.form === 'string' ? ` (${params.form})` : '';
    setNotes((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), `You chose ${name}${detail}.`] }));
  };

  const chat: ChatMessage[] = messages.map((m, i) => {
    const message = toChatMessage(m, busy && i === messages.length - 1);
    const failed = status === 'error' && i === messages.length - 1 && m.role === 'assistant';
    return {
      ...message,
      author: message.role === 'user' ? 'You' : ASSISTANT,
      ending: failed ? { kind: 'failed', message: error?.message ?? 'The reply failed.' } : stopped.has(m.id) ? { kind: 'stopped' } : undefined,
    };
  });

  const reply = last?.role === 'assistant' ? chat.at(-1) : undefined;
  const firstLine = reply?.parts.find((p) => p.type === 'text')?.text.split(/(?<=[.!?])\s/)[0];
  const statusText =
    status === 'submitted' || status === 'streaming' ? `${ASSISTANT} is replying.`
    : status === 'error' ? `The reply failed: ${error?.message ?? 'unknown error'}`
    : reply?.ending?.kind === 'stopped' ? 'You stopped the reply.'
    : firstLine ? `${ASSISTANT} replied: ${firstLine}` : '';

  return (
    <ThemeProvider scheme={scheme === 'Dark' ? 'dark' : 'light'} surface="grouped" className="jrc-app">
      <main className="jrc-page">
        <PageHeader
          title="Ask Daybook"
          summary={`A chat whose replies can include screens that json-render builds from Lede. ${api ? `Replies come from ${api}.` : 'Replies come from a script, so it needs no network or key.'}`}
          actions={<SegmentedControl label="Appearance" size="sm" options={['Light', 'Dark']} value={scheme} onValueChange={(v) => setScheme(v as 'Light' | 'Dark')} />}
        />
        <section aria-label="Conversation" className="jrc-conversation">
          {chat.length ? (
            <ol className="jrc-messages">
              {chat.map((m, i) => (
                <Message key={m.id} message={m} live={busy && i === chat.length - 1} notes={notes[m.id] ?? []} onAction={note(m.id)} />
              ))}
            </ol>
          ) : (
            <div className="jrc-empty">
              <p className="jrc-muted">Ask about your notifications, inbox, sign-up or projects. Each reply can bring a screen with it.</p>
              <ul className="jrc-suggestions" aria-label="Suggestions">
                {SUGGESTIONS.map((s) => <li key={s}><Button size="sm" variant="tinted" onClick={() => send(s)}>{s}</Button></li>)}
              </ul>
            </div>
          )}
        </section>
        <div className="jrc-footer">
          <p role="status" className={status === 'error' ? 'jrc-status' : 'ld-sr-only'}>{statusText}</p>
          {status === 'error' ? <Button size="sm" onClick={() => void regenerate()}>Try again</Button> : null}
          <form ref={form} className="jrc-composer" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
            <TextField
              label="Message"
              rows={2}
              value={draft}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(e.currentTarget.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
              }}
              hint="Enter sends, and Shift+Enter starts a new line."
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

interface MessageProps {
  message: ChatMessage;
  live: boolean;
  notes: string[];
  onAction: (name: string, params: Record<string, unknown>) => void;
}

/** One turn: its author as a heading, its text and, where the reply has one, the screen its spec describes. */
function Message({ message, live, notes, onAction }: MessageProps) {
  const actions = React.useMemo<SpecActions>(() => ({
    open: (params) => onAction('open', params),
    archive: (params) => onAction('archive', params),
    submit: (params) => onAction('submit', params),
  }), [onAction]);
  const firstData = message.parts.findIndex((p) => p.type === 'data');
  const parts = message.parts.flatMap((p) => (p.type === 'data' ? [{ type: `data-${p.name}`, data: p.data }] : []));

  return (
    <li className="jrc-message" data-role={message.role} data-message={message.id}>
      <h2 className="jrc-author">{message.author}</h2>
      {message.parts.map((part, i) => {
        if (part.type === 'data') return i === firstData ? <SpecView key="spec" parts={parts} streaming={live} actions={actions} /> : null;
        return part.text.trim() ? <p key={i} className="jrc-text">{part.text.trim()}</p> : null;
      })}
      {message.ending ? (
        <p className="jrc-ending">{message.ending.kind === 'stopped' ? 'You stopped this reply.' : `This reply failed: ${message.ending.message}`}</p>
      ) : null}
      {notes.map((n, i) => <p key={i} className="jrc-note">{n}</p>)}
    </li>
  );
}
