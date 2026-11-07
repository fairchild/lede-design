import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { expect, test } from 'vitest';
import { convertToModelMessages } from 'ai';
import { forModel } from '../server/chat';
import { MockChatTransport } from '../src/chat/mock-transport';
import type { AppMessage } from '../src/chat/app-message';

/** A finished reply as `useChat` keeps it: its text, then one data part per patch. */
async function replyTo(text: string): Promise<AppMessage> {
  const stream = await new MockChatTransport(0).sendMessages({
    trigger: 'submit-message', chatId: 'c', messageId: undefined, abortSignal: undefined,
    messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text }] }],
  });
  const parts: AppMessage['parts'] = [{ type: 'text', text: '', state: 'done' }];
  for (const reader = stream.getReader(); ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value.type === 'text-delta') (parts[0] as { text: string }).text += value.delta;
    if (value.type === 'data-spec') parts.push({ type: 'data-spec', data: value.data as never });
  }
  return { id: 'a1', role: 'assistant', parts };
}

test('the model sees the screen it sent, as the patches it wrote', async () => {
  const reply = await replyTo('Show my notification settings');
  expect(reply.parts.filter((p) => p.type === 'data-spec').length).toBeGreaterThan(3);
  const [, assistant] = await convertToModelMessages(forModel([
    { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Show my notification settings' }] },
    reply,
  ]));
  const said = JSON.stringify(assistant.content);
  expect(said).toContain('```spec');
  expect(said).toContain('Notifications');
});

test('the server starts, answers 404 off its route and 400 to a body without messages, and logs a failed model call in one line', async () => {
  const port = 4884;
  const server = spawn('npm', ['run', 'server'], { env: { ...process.env, ANTHROPIC_API_KEY: 'test', PORT: String(port), ANTHROPIC_BASE_URL: 'http://127.0.0.1:9/v1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  try {
    let log = '';
    server.stderr.on('data', (d) => { log += d; });
    await new Promise<void>((resolve, reject) => {
      server.stdout.on('data', (d) => { log += d; if (/Chat server on/.test(log)) resolve(); });
      once(server, 'exit').then(() => reject(new Error(`The server exited:\n${log}`)));
    });
    expect((await fetch(`http://localhost:${port}/`)).status).toBe(404);
    expect((await fetch(`http://localhost:${port}/api/chat`, { method: 'POST', body: '{}' })).status).toBe(400);
    const reply = await fetch(`http://localhost:${port}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }] }),
    });
    expect(await reply.text()).toContain('"type":"error"');
    await new Promise((resolve) => setTimeout(resolve, 200));
    const failures = log.split('\n').filter((line) => line.trim());
    expect(failures.filter((line) => /Model call failed/.test(line))).toHaveLength(1);
    expect(failures.filter((line) => /^\s+at /.test(line))).toEqual([]);
  } finally {
    process.kill(-server.pid!);
  }
}, 20_000);
