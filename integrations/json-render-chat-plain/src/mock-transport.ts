import { pipeJsonRender, type Spec } from '@json-render/core';
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';
import { specs } from './specs';
import { toPatches } from './stream';

interface Reply {
  text: string;
  spec?: Spec;
  /** Fails partway through the first time it's asked, and answers on a retry. */
  failsOnce?: boolean;
}

/** The scripted replies, matched in order by the first pattern the prompt contains. The last one always matches. */
export const script: Array<{ match: RegExp; reply: Reply }> = [
  {
    match: /fail/i,
    reply: { text: 'This reply fails partway through the first time, so you can see the error state.', failsOnce: true },
  },
  {
    match: /notification|setting|alert/i,
    reply: { text: 'Here are your notification settings. Push alerts and mentions are on, and email alerts are off.', spec: specs.Settings },
  },
  {
    match: /inbox|mail|message/i,
    reply: { text: 'You have 3 unread messages. Grace needs an answer about the venue by 5:00 PM.', spec: specs.Inbox },
  },
  {
    match: /sign ?up|account|register/i,
    reply: { text: 'Here’s the sign-up form. Your email address is missing its @, and the field says so once you leave it.', spec: specs['Sign-up form'] },
  },
  {
    match: /project/i,
    reply: { text: 'You have no projects yet. You can start one from here.', spec: specs['Empty state'] },
  },
  {
    match: /./s,
    reply: { text: 'I can show your notification settings, your inbox, a sign-up form or your projects. Try “what’s in my inbox”.' },
  },
];

const textOf = (message: UIMessage | undefined) =>
  message?.parts.map((part) => (part.type === 'text' ? part.text : '')).join('') ?? '';

/**
 * The reply as a model writes it under `catalog.prompt({ mode: 'inline' })`: its prose, then the spec as JSONL patches,
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
export class MockChatTransport implements ChatTransport<UIMessage> {
  private failed = new Set<RegExp>();

  constructor(private delay = 60) {}

  async sendMessages({ messages, abortSignal }: Parameters<ChatTransport<UIMessage>['sendMessages']>[0]) {
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
