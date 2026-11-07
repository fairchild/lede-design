import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { anthropic } from '@ai-sdk/anthropic';
import { pipeJsonRender, SPEC_DATA_PART_TYPE } from '@json-render/core';
import { convertToModelMessages, createUIMessageStreamResponse, streamText, type UIMessage } from 'ai';
import { catalog, rules } from '@/components/lede/json-render/catalog';
import { ASSISTANT } from '../src/chat/assistant';
import { specFromParts, toPatches } from '@/components/lede/json-render/patches';

// The reference backend for the chat. `handleChat` is a fetch-style handler, so it drops into any framework's route
// (Hono, a Next.js route handler, a Worker). Run this file and it serves POST /api/chat on port 4882, or on `PORT`,
// which `npm run dev` proxies to. The key is read from the server's environment and never reaches the browser.

/** Inline mode asks the model for its prose first and then the spec as JSONL patches, in one text stream. */
const system = catalog.prompt({
  mode: 'inline',
  system: `You are ${ASSISTANT}, the assistant in a calendar, inbox and settings app. Answer in a sentence or two, and add a screen when one helps the person act.`,
  customRules: rules,
});

const reason = (error: unknown) => (error instanceof Error ? error.message : 'The model call failed.');

/**
 * The conversation as the model reads it. `convertToModelMessages` drops data parts, so without this the model never
 * sees the screens it sent, and a follow-up such as “turn off push” has nothing to refer to. Each reply's patches
 * become one text part, in the fenced form the inline prompt asks the model to write.
 */
const FENCE = '`'.repeat(3);

export function forModel(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => {
    const spec = specFromParts(message.parts);
    if (!spec?.elements[spec.root]) return message;
    const parts = message.parts.filter((part) => part.type !== SPEC_DATA_PART_TYPE);
    return { ...message, parts: [...parts, { type: 'text', text: `\n\n${FENCE}spec\n${toPatches(spec).join('')}${FENCE}` }] };
  });
}

export async function handleChat(request: Request): Promise<Response> {
  let messages: UIMessage[];
  try {
    ({ messages } = (await request.json()) as { messages: UIMessage[] });
    if (!Array.isArray(messages)) throw new TypeError('messages is not an array');
  } catch {
    return new Response('The body must be JSON with a messages array.', { status: 400 });
  }
  const result = streamText({
    model: anthropic('claude-sonnet-5-5'),
    system,
    messages: await convertToModelMessages(forModel(messages)),
    abortSignal: request.signal,
    // One line per failure. Without this the AI SDK logs the whole error, stack and response headers included.
    onError: ({ error }) => console.error(`Model call failed: ${reason(error)}`),
  });
  // json-render's transform lifts each JSONL patch line out of the text into a `data-spec` part, which the client
  // reads with `specFromParts`. The prose stays as text parts, in order around it.
  // `onError` passes the provider's message, such as an invalid key, to the client. That suits development; in
  // production, return a generic message here and log the error.
  const stream = result.toUIMessageStream({ onError: reason });
  return createUIMessageStreamResponse({ stream: pipeJsonRender(stream) });
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
