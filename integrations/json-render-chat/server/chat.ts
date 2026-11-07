import { createServer, type IncomingMessage } from 'node:http';
import { anthropic } from '@ai-sdk/anthropic';
import { pipeJsonRender } from '@json-render/core';
import { convertToModelMessages, pipeUIMessageStreamToResponse, streamText, type UIMessage } from 'ai';
import { catalog } from '@json-render-lede/catalog';

// A reference backend for the chat: POST /api/chat on port 4882, which `npm run dev` proxies to. The key stays here,
// read from the environment, and never reaches the browser.

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Set ANTHROPIC_API_KEY to run the chat server.');
  process.exit(1);
}

const PORT = Number(process.env.PORT ?? 4882);

// Inline mode asks the model for its prose first and then the spec as JSONL patches, in one text stream.
const system = catalog.prompt({
  mode: 'inline',
  system: 'You are Daybook, the assistant in a calendar, inbox and settings app. Answer in a sentence or two, and add a screen when one helps the person act.',
});

const body = async (req: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as { messages: UIMessage[] };
};

createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/api/chat') return void res.writeHead(404).end();
  const { messages } = await body(req);
  const stopped = new AbortController();
  res.on('close', () => stopped.abort());
  const result = streamText({
    model: anthropic('claude-sonnet-5-5'),
    system,
    messages: await convertToModelMessages(messages),
    abortSignal: stopped.signal,
  });
  // json-render's transform lifts each JSONL patch line out of the text into a `data-spec` part, which the client
  // reads with `buildSpecFromParts`. The prose stays as text parts, in order around it.
  await pipeUIMessageStreamToResponse({ response: res, stream: pipeJsonRender(result.toUIMessageStream()) });
}).listen(PORT, () => console.log(`Chat server on http://localhost:${PORT}/api/chat`));
