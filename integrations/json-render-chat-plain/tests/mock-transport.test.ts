import { describe, expect, test } from 'vitest';
import type { UIMessage, UIMessageChunk } from 'ai';
import { buildSpecFromParts } from '@json-render/react';
import { check } from '../src/check';
import { MockChatTransport } from '../src/mock-transport';

/** Sends one prompt through the mock transport and collects what the client would receive. */
async function ask(transport: MockChatTransport, text: string) {
  const messages: UIMessage[] = [{ id: 'u1', role: 'user', parts: [{ type: 'text', text }] }];
  const stream = await transport.sendMessages({ trigger: 'submit-message', chatId: 'c', messageId: undefined, messages, abortSignal: undefined });
  const chunks: UIMessageChunk[] = [];
  for (const reader = stream.getReader(); ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const text_ = chunks.flatMap((c) => (c.type === 'text-delta' ? [c.delta] : [])).join('');
  const spec = buildSpecFromParts(chunks.filter((c) => c.type.startsWith('data-')) as Array<{ type: string; data: unknown }>);
  return { chunks, text: text_, spec };
}

describe.each([
  ['Show my notification settings', 'Notifications'],
  ['What’s in my inbox?', 'Inbox'],
  ['Help me sign up', 'Create your account'],
  ['Any projects?', 'Projects'],
])('%s', (prompt, title) => {
  test('streams prose, then a spec that passes the catalog', async () => {
    const { chunks, text, spec } = await ask(new MockChatTransport(0), prompt);
    expect(chunks.at(-1)?.type).toBe('finish');
    expect(text.trim().length).toBeGreaterThan(0);
    expect(text).not.toContain('{');
    expect(spec).not.toBeNull();
    expect(check(spec!)).toEqual([]);
    expect(spec!.elements[spec!.elements[spec!.root].children![0]].props).toMatchObject({ text: title });
  });
});

test('an unmatched prompt gets prose and no spec', async () => {
  const { text, spec } = await ask(new MockChatTransport(0), 'Hello');
  expect(text).toMatch(/inbox/);
  expect(spec).toBeNull();
});

test('“fail” fails once with an error chunk, then answers', async () => {
  const transport = new MockChatTransport(0);
  expect((await ask(transport, 'Fail once')).chunks.at(-1)).toMatchObject({ type: 'error' });
  expect((await ask(transport, 'Fail once')).chunks.at(-1)).toMatchObject({ type: 'finish' });
});
