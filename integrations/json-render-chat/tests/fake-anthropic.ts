import { createServer } from 'node:http';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

// A stand-in for Anthropic's Messages API, for the tests of server/chat.ts. It streams a reply a model wrote, in
// Anthropic's SSE events: the notification settings, or the reply named by a word in the last message. A message
// containing “drop” loses its connection halfway through the reply. With `FAKE_LOG` set, it appends each request's
// body to that file, one JSON line each.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
// Each entry: the word, the reply, and the pause between pieces in ms. The checklist streams slowly enough to use a
// row while later rows are still coming.
const replies: Array<[string, string, number?]> = [
  ['quiz', read('./fake-replies/quiz.txt')],
  ['patch', read('./fake-replies/patch-only.txt')],
  ['check-in', read('./fake-replies/checkin.txt')],
  ['trip', read('./fake-replies/checklist.txt'), 60],
];
const settings = read('./model-replies/after/2-settings.txt');
const port = Number(process.env.FAKE_PORT ?? 4885);
if (process.env.FAKE_LOG) writeFileSync(process.env.FAKE_LOG, '');

const server = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  if (process.env.FAKE_LOG) appendFileSync(process.env.FAKE_LOG, `${body}\n`);
  // The latest question: the last block of the last message, since Anthropic's API takes consecutive user turns as one.
  const last = JSON.parse(body || '{}').messages?.at(-1)?.content;
  const asked = JSON.stringify((Array.isArray(last) ? last.at(-1) : last) ?? '');
  const drop = asked.includes('drop');
  const [, reply, pause = 5] = replies.find(([word]) => asked.includes(word)) ?? ['', settings];
  const send = (type: string, data: object) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  send('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } });
  send('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
  const pieces = reply.match(/[\s\S]{1,40}/g) ?? [];
  for (const [i, text] of pieces.entries()) {
    if (res.destroyed) return;
    if (drop && i === Math.floor(pieces.length / 2)) return void res.destroy();
    send('content_block_delta', { index: 0, delta: { type: 'text_delta', text } });
    await new Promise((resolve) => setTimeout(resolve, pause));
  }
  send('content_block_stop', { index: 0 });
  send('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 15 } });
  send('message_stop', {});
  res.end();
});
server.listen(port, () => console.log(`Fake Anthropic on ${(server.address() as import('node:net').AddressInfo).port}`));
