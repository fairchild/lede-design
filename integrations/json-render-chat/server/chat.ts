import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { anthropic } from '@ai-sdk/anthropic';
import { pipeJsonRender } from '@json-render/core';
import { convertToModelMessages, createUIMessageStreamResponse, streamText, type UIMessage } from 'ai';
import { catalog } from '@json-render-lede/catalog';

// The reference backend for the chat. `handleChat` is a fetch-style handler, so it drops into any framework's route
// (Hono, a Next.js route handler, a Worker). Run this file and it serves POST /api/chat on port 4882, which
// `npm run dev` proxies to. The key is read from the server's environment and never reaches the browser.

/** Inline mode asks the model for its prose first and then the spec as JSONL patches, in one text stream. */
const system = catalog.prompt({
  mode: 'inline',
  system: 'You are Daybook, the assistant in a calendar, inbox and settings app. Answer in a sentence or two, and add a screen when one helps the person act.',
});

export async function handleChat(request: Request): Promise<Response> {
  const { messages } = (await request.json()) as { messages: UIMessage[] };
  const result = streamText({
    model: anthropic('claude-sonnet-5-5'),
    system,
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
  });
  // json-render's transform lifts each JSONL patch line out of the text into a `data-spec` part, which the client
  // reads with `buildSpecFromParts`. The prose stays as text parts, in order around it.
  return createUIMessageStreamResponse({ stream: pipeJsonRender(result.toUIMessageStream()) });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Set ANTHROPIC_API_KEY to run the chat server.');
    process.exit(1);
  }
  const port = Number(process.env.PORT ?? 4882);
  createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/api/chat') return void res.writeHead(404).end();
    const stopped = new AbortController();
    res.on('close', () => stopped.abort());
    const request = new Request(`http://localhost${req.url}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: Readable.toWeb(req) as ReadableStream,
      signal: stopped.signal,
      duplex: 'half',
    } as RequestInit);
    const response = await handleChat(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body as import('node:stream/web').ReadableStream).pipe(res);
    else res.end();
  }).listen(port, () => console.log(`Chat server on http://localhost:${port}/api/chat`));
}
