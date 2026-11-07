import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { anthropic } from '@ai-sdk/anthropic';
import { pipeJsonRender, SPEC_DATA_PART_TYPE, type SpecDataPart } from '@json-render/core';
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, safeValidateUIMessages, streamText } from 'ai';
import { z } from 'zod';
import { prompt } from '@/components/lede/json-render/catalog';
import { specFromParts, toPatches } from '@/components/lede/json-render/patches';
import type { AppMessage } from '../src/chat/app-message';
import { ASSISTANT, DOMAIN } from '../src/chat/assistant';

// The reference backend for the chat. `handleChat` is a fetch-style handler, so it drops into any framework's route
// (Hono, a Next.js route handler, a Worker). Run this file and it serves POST /api/chat on port 4882, or on `PORT`,
// which `npm run dev` proxies to. The key is read from the server's environment and never reaches the browser.

/** What one request may carry. A chat's history and screens fit well inside these; a larger body is refused. */
const LIMITS = { bodyBytes: 1_000_000, messages: 200, outputTokens: 4_000 };

/** The client's message parts the model reads: what the person typed, and the replies' text and screens. */
const KEPT: Record<AppMessage['role'], ReadonlySet<string>> = {
  user: new Set(['text']),
  assistant: new Set(['text', SPEC_DATA_PART_TYPE]),
  system: new Set(),
};
const specPart = z.custom<SpecDataPart>((part) => ['patch', 'flat', 'nested'].includes((part as { type?: string } | null)?.type ?? ''));

/** Inline mode, the default, asks the model for its prose first and then the spec as JSONL patches, in one stream. */
const system = prompt({
  system: `You are ${ASSISTANT}, the assistant in ${DOMAIN}. Answer in a sentence or two, and add a screen when one helps the person act.`,
});

const reason = (error: unknown) => (error instanceof Error ? error.message : 'The model call failed.');

/**
 * What the person reads when a reply fails. A provider's message can name keys or accounts, so the browser gets it
 * only with `CHAT_DEBUG` set; the server's log always has it.
 */
const shown = (error: unknown) => (process.env.CHAT_DEBUG ? reason(error) : 'The assistant couldn’t answer.');

/**
 * The conversation as the model reads it. `convertToModelMessages` drops data parts, so without this the model never
 * sees the screens it sent, and a follow-up such as “turn off push” has nothing to refer to. Each reply's patches
 * become one text part, in the fenced form the inline prompt asks the model to write. The model sees each screen as
 * it was sent: an edit the person made on it reaches the model only through an action the app reports.
 */
const FENCE = '`'.repeat(3);

export function forModel(messages: AppMessage[]): AppMessage[] {
  return messages.map((message) => {
    const spec = specFromParts(message.parts);
    if (!spec?.elements[spec.root]) return message;
    const parts = message.parts.filter((part) => part.type !== SPEC_DATA_PART_TYPE);
    return { ...message, parts: [...parts, { type: 'text' as const, text: `\n\n${FENCE}spec\n${toPatches(spec).join('')}${FENCE}` }] };
  });
}

const refuse = (status: number, text: string) => new Response(text, { status, headers: { 'content-type': 'text/plain' } });

export async function handleChat(request: Request): Promise<Response> {
  // JSON only: a cross-site form or `text/plain` POST, which a browser sends without asking first, is refused.
  if (!request.headers.get('content-type')?.startsWith('application/json')) return refuse(415, 'Send the body as application/json.');
  if (Number(request.headers.get('content-length') ?? 0) > LIMITS.bodyBytes) return refuse(413, 'The body is too large.');
  const body = await request.text();
  if (body.length > LIMITS.bodyBytes) return refuse(413, 'The body is too large.');
  let raw: unknown;
  try {
    raw = (JSON.parse(body) as { messages?: unknown }).messages;
  } catch {
    return refuse(400, 'The body must be JSON with a messages array.');
  }
  if (Array.isArray(raw) && raw.length > LIMITS.messages) return refuse(413, 'The conversation is too long.');
  const checked = await safeValidateUIMessages<AppMessage>({ messages: raw, dataSchemas: { spec: specPart } });
  if (!checked.success) return refuse(400, 'The body must be JSON with a messages array.');
  const messages = checked.data.map((m) => ({ ...m, parts: m.parts.filter((part) => KEPT[m.role].has(part.type)) }));

  const result = streamText({
    model: anthropic('claude-sonnet-5-5'),
    system,
    messages: await convertToModelMessages(forModel(messages)),
    maxOutputTokens: LIMITS.outputTokens,
    abortSignal: request.signal,
    // One line per failure. Without this the AI SDK logs the whole error, stack and response headers included.
    onError: ({ error }) => console.error(`Model call failed: ${reason(error)}`),
  });
  // Merged into a stream of its own, a connection that drops partway through a reply becomes an error part the
  // client shows, with Try again, rather than a broken response. json-render's transform then lifts each JSONL patch
  // line out of the text into a `data-spec` part, which the client reads with `specFromParts`.
  const stream = createUIMessageStream<AppMessage>({
    execute: ({ writer }) => writer.merge(result.toUIMessageStream({ onError: shown })),
    onError: (error) => { console.error(`Reply failed: ${reason(error)}`); return shown(error); },
  });
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
    try {
      const response = await handleChat(new Request(`http://localhost${req.url}`, {
        method: 'POST',
        headers: req.headers as Record<string, string>,
        body: Readable.toWeb(req) as ReadableStream,
        signal: stopped.signal,
        duplex: 'half',
      } as RequestInit));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      // `pipeline` ends the response when either side fails, so a dropped client or upstream can't crash the server.
      if (response.body) await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), res);
      else res.end();
    } catch (error) {
      if (!res.headersSent) res.writeHead(500).end();
      else res.destroy();
      if (!stopped.signal.aborted) console.error(`Request failed: ${reason(error)}`);
    }
  }).listen(port, () => console.log(`Chat server on http://localhost:${port}/api/chat`));
}
