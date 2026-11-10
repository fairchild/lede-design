import { describe, expect, test } from 'vitest';
import type { UIMessageChunk } from 'ai';
import { specFromParts } from '../src/screens/patches';
import { check } from '../src/screens/check';
import type { AppMessage } from '../src/chat/app-message';
import { MockChatTransport } from '../src/chat/mock-transport';

/** Sends one prompt through the mock transport and collects what the client would receive. */
export async function ask(transport: MockChatTransport, text: string) {
  const messages: AppMessage[] = [{ id: 'u1', role: 'user', parts: [{ type: 'text', text }] }];
  const stream = await transport.sendMessages({ trigger: 'submit-message', chatId: 'c', messageId: undefined, messages, abortSignal: undefined });
  const chunks: UIMessageChunk[] = [];
  for (const reader = stream.getReader(); ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const text_ = chunks.flatMap((c) => (c.type === 'text-delta' ? [c.delta] : [])).join('');
  const spec = specFromParts(chunks as Array<{ type: string; data?: unknown }>);
  return { chunks, text: text_, spec };
}

describe.each([
  ['How’s my week?', 'Your week'],
  ['Show my tasks', 'Today’s tasks'],
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
    // The first Heading under the root, or under its list Stack when the screen opens items in place.
    const first = (key: string): string => (spec!.elements[key].type === 'Stack' ? first(spec!.elements[key].children![0]) : key);
    expect(spec!.elements[first(spec!.elements[spec!.root].children![0])].props).toMatchObject({ text: title });
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

test('a reply that streams a list an item at a time builds the same spec on every render', async () => {
  const { chunks } = await ask(new MockChatTransport(0), 'How’s my week?');
  const paths = chunks.flatMap((c) => (c.type === 'data-spec' ? [(c.data as { patch: { path: string } }).patch.path] : []));
  expect(paths).toContain('/state/meetings/2');
  const parts = chunks as Array<{ type: string; data?: unknown }>;
  const counts = [1, 2, 3].map(() => (specFromParts(parts)!.state as { meetings: unknown[] }).meetings.length);
  expect(counts).toEqual([3, 3, 3]);
});
