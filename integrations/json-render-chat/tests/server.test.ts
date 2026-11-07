import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('the model sees each earlier screen with the state the person left in it', async () => {
  const reply = await replyTo('Show my notification settings');
  const ask = { id: 'u1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Show my notification settings' }] };
  const said = async (screens?: Record<string, Record<string, unknown>>) => JSON.stringify((await convertToModelMessages(forModel([ask, reply], screens)))[1].content);
  expect(await said()).toContain('\\"push\\":true');
  const left = await said({ a1: { settings: { push: false, mentions: true, email: false } } });
  expect(left).toContain('\\"push\\":false');
  expect(left).not.toContain('\\"push\\":true');
});

test('the server starts, answers 404 off its route, refuses a body that is malformed, not JSON or too large, and logs a failed model call in one line', async () => {
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
    const post = (body: string, type = 'application/json') => fetch(`http://localhost:${port}/api/chat`, { method: 'POST', headers: { 'content-type': type }, body });
    expect((await post('{}')).status).toBe(400);
    const many = Array.from({ length: 201 }, (_, i) => ({ id: `u${i}`, role: 'user', parts: [{ type: 'text', text: 'x' }] }));
    expect((await post(JSON.stringify({ messages: many }))).status).toBe(413);
    expect((await post('{"messages":[],"screens":{"a1":"x"}}')).status).toBe(400);
    expect((await post('{"messages":[]}', 'text/plain')).status).toBe(415);
    expect((await post(JSON.stringify({ messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'x'.repeat(1_100_000) }] }] }))).status).toBe(413);
    const reply = await fetch(`http://localhost:${port}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }] }),
    });
    const said = await reply.text();
    expect(said).toContain('"type":"error"');
    expect(said).toContain('The assistant couldn’t answer.');
    await new Promise((resolve) => setTimeout(resolve, 200));
    const failures = log.split('\n').filter((line) => line.trim());
    expect(failures.filter((line) => /Model call failed/.test(line))).toHaveLength(1);
    expect(failures.filter((line) => /^\s+at /.test(line))).toEqual([]);
  } finally {
    process.kill(-server.pid!);
  }
}, 20_000);

test('the server caps a reply’s length and passes the model only what the person typed', async () => {
  const log = join(mkdtempSync(join(tmpdir(), 'chat-')), 'requests.jsonl');
  const fake = spawn('npx', ['tsx', 'tests/fake-anthropic.ts'], { env: { ...process.env, FAKE_PORT: '4886', FAKE_LOG: log }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const server = spawn('npm', ['run', 'server'], { env: { ...process.env, ANTHROPIC_API_KEY: 'test', PORT: '4884', ANTHROPIC_BASE_URL: 'http://127.0.0.1:4886/v1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  try {
    await Promise.all([[fake, /Fake Anthropic/], [server, /Chat server on/]].map(([child, ready]) => new Promise<void>((resolve) => {
      let out = '';
      (child as typeof fake).stdout!.on('data', (d) => { out += d; if ((ready as RegExp).test(out)) resolve(); });
    })));
    const reply = await fetch('http://localhost:4884/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ id: 'u1', role: 'user', parts: [
        { type: 'text', text: 'Show my settings' },
        { type: 'file', mediaType: 'text/plain', url: 'data:text/plain;base64,c2VjcmV0' },
      ] }] }),
    });
    await reply.text();
    const [sent] = readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    expect(sent.max_tokens).toBe(4000);
    expect(JSON.stringify(sent.messages)).toContain('Show my settings');
    expect(sent.messages[0].content).toHaveLength(1);
  } finally {
    process.kill(-server.pid!);
    process.kill(-fake.pid!);
  }
}, 20_000);
