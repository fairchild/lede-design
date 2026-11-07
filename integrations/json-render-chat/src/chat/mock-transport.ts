import { pipeJsonRender, type Spec } from '@json-render/core';
import type { ChatTransport, UIMessageChunk } from 'ai';
import type { AppMessage } from './app-message';
import { toPatches } from '@/components/lede/json-render/patches';
import settings from './replies/settings.json';
import inbox from './replies/inbox.json';
import signup from './replies/signup.json';
import projects from './replies/projects.json';
import week from './replies/week.json';
import tasks from './replies/tasks.json';
import { SUGGESTIONS } from './assistant';

const pushOff = { ...settings, state: { ...settings.state, settings: { ...settings.state.settings, push: false } } };
const quoted = SUGGESTIONS.filter((s) => !/fail/i.test(s)).map((s) => `“${s}”`);

interface Reply {
  text: string;
  spec?: Spec;
  /** Fails the first time it's asked, partway through or before a word arrives, and answers on a retry. */
  failsOnce?: 'partway' | 'at once';
}

/** The scripted replies, matched in order by the first pattern the prompt contains. The last one always matches. */
export const script: Array<{ match: RegExp; reply: Reply }> = [
  {
    match: /fail/i,
    reply: { text: 'This reply fails partway through the first time, so you can see the error state.', failsOnce: 'partway' },
  },
  {
    match: /offline/i,
    reply: { text: 'The connection is back. This reply failed before it began the first time, as a server error does.', failsOnce: 'at once' },
  },
  {
    match: /week|calendar|schedule|meeting|busy/i,
    reply: { text: 'You have 4 meetings left this week, and Thursday afternoon is the busiest stretch.', spec: week as Spec },
  },
  {
    match: /task|to-?do/i,
    reply: { text: 'You have 3 tasks today, about an hour and a half of work. Add one below.', spec: tasks as Spec },
  },
  {
    match: /(turn|switch) off push|push (alerts )?off/i,
    reply: { text: 'Push alerts are off now. Here are your notification settings with that change.', spec: pushOff as Spec },
  },
  {
    match: /notification|setting|alert/i,
    reply: { text: 'Here are your notification settings. Push alerts and mentions are on, and email alerts are off.', spec: settings as Spec },
  },
  {
    match: /inbox|mail|message/i,
    reply: { text: 'You have 3 unread messages. Grace needs an answer about the venue by 5:00 PM.', spec: inbox as Spec },
  },
  {
    match: /sign ?up|account|register/i,
    reply: { text: 'Here’s the sign-up form. Fill in your name and email, and I’ll send your sign-in link.', spec: signup as Spec },
  },
  {
    match: /project/i,
    reply: { text: 'You have no projects yet. You can start one from here.', spec: projects as Spec },
  },
  {
    match: /./s,
    reply: { text: `This demo answers from a script, so it can’t answer that. Try one of these: ${quoted.slice(0, -1).join(', ')} or ${quoted.at(-1)}.` },
  },
];

const textOf = (message: AppMessage | undefined) =>
  message?.parts.map((part) => (part.type === 'text' ? part.text : '')).join('') ?? '';

/**
 * The reply as a model writes it under `prompt()`, in inline mode: its prose, then the spec as JSONL patches,
 * one per line. Words go out a few at a time and each patch line in two halves, the way network chunks fall.
 */
export function modelOutput(reply: Reply): string[] {
  const words = reply.text.match(/\S+\s*/g) ?? [];
  const prose = Array.from({ length: Math.ceil(words.length / 3) }, (_, i) => words.slice(i * 3, i * 3 + 3).join(''));
  const lines = reply.spec ? ['\n\n', ...toPatches(reply.spec).flatMap((line) => [line.slice(0, line.length >> 1), line.slice(line.length >> 1)])] : [];
  return [...prose, ...lines];
}

/**
 * A ChatTransport that needs no network. It streams a scripted reply through json-render's own transform, the one the
 * server in `server/chat.ts` uses, so text arrives as text parts and the spec as `data-spec` patch parts.
 */
export class MockChatTransport implements ChatTransport<AppMessage> {
  private failed = new Set<RegExp>();
  private delay: number;

  /** `delay` is the pause before each chunk, in ms. Tests pass 0. */
  constructor(delay = 60) {
    this.delay = delay;
  }

  async sendMessages({ messages, abortSignal }: Parameters<ChatTransport<AppMessage>['sendMessages']>[0]) {
    const prompt = textOf(messages.findLast((m) => m.role === 'user'));
    const { match, reply } = script.find(({ match }) => match.test(prompt))!;
    const fails = !!reply.failsOnce && !this.failed.has(match);
    if (fails) this.failed.add(match);
    const deltas = modelOutput(reply);
    const cut = fails ? Math.ceil(deltas.length / 2) : deltas.length;
    const wait = () => new Promise((resolve) => setTimeout(resolve, this.delay));
    let i = 0;

    const model = new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        controller.enqueue({ type: 'start' });
        if (fails && reply.failsOnce === 'at once') {
          controller.enqueue({ type: 'error', errorText: 'The server couldn’t reach the model.' });
          return controller.close();
        }
        controller.enqueue({ type: 'text-start', id: '1' });
      },
      pull: async (controller) => {
        await wait();
        if (abortSignal?.aborted) return controller.close();
        if (i < cut) return controller.enqueue({ type: 'text-delta', id: '1', delta: deltas[i++] });
        controller.enqueue({ type: 'text-end', id: '1' });
        if (fails) controller.enqueue({ type: 'error', errorText: 'The connection dropped partway through the reply.' });
        else controller.enqueue({ type: 'finish', finishReason: 'stop' });
        controller.close();
      },
    });
    return pipeJsonRender(model);
  }

  async reconnectToStream() {
    return null;
  }
}
