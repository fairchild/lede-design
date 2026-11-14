import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { anthropic } from '@ai-sdk/anthropic';
import { pipeJsonRender, SPEC_DATA_PART_TYPE, type SpecDataPart } from '@json-render/core';
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, safeValidateUIMessages, streamText } from 'ai';
import { z } from 'zod';
import { specFromParts, toPatches } from '@/components/lede/json-render/patches';
import type { AppMessage } from '../src/chat/app-message';
import { system } from '../src/chat/system';

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
const object = z.record(z.string(), z.unknown());
const specPart: z.ZodType<SpecDataPart> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('patch'), patch: z.object({ op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']), path: z.string(), value: z.unknown().optional(), from: z.string().optional() }) }),
  z.object({ type: z.literal('flat'), spec: z.object({ root: z.string(), elements: z.record(z.string(), object), state: object.optional() }) }),
  z.object({ type: z.literal('nested'), spec: object }),
]) as z.ZodType<SpecDataPart>;
/**
 * The parts of a spec `forModel` reads to write it back as patches. Each patch is valid alone, yet a sequence can still
 * build something else, such as a patch that sets `/elements` to null, so the spec they build is checked too.
 */
const builtSpec = z.object({
  root: z.string(),
  elements: z.record(z.string(), z.object({ type: z.string(), children: z.array(z.string()).optional(), slots: z.record(z.string(), z.array(z.string())).optional() })),
  state: object.optional(),
});

const reason = (error: unknown) => (error instanceof Error ? error.message : 'The model call failed.');

/**
 * What the person reads when a reply fails. A provider's message can name keys or accounts, so the browser gets it
 * only with `CHAT_DEBUG` set; the server's log always has it.
 */
const shown = (error: unknown) => (process.env.CHAT_DEBUG ? reason(error) : 'The assistant couldn’t answer.');

/** Each screen's state as the person left it when they sent, by the id of the reply that drew it. */
const screensSchema = z.record(z.string(), z.record(z.string(), z.unknown())).optional();
export type Screens = z.infer<typeof screensSchema>;
/** The ids of replies that failed partway. The person saw them marked as failed, so the model doesn't read them. */
const failedSchema = z.array(z.string()).max(LIMITS.messages).optional();

/**
 * The conversation as the model reads it. `convertToModelMessages` drops data parts, so without this the model never
 * sees the screens it sent, and a follow-up such as “turn off push” has nothing to refer to. Each reply's patches
 * become one text part, in the fenced form the inline prompt asks the model to write, with the state the person left
 * in that screen: what they typed and chose there reaches the model with their next message. That state is the
 * person's input, written into the assistant's turn, which a model trusts more than the user's. An app that wants the
 * model to treat it as user input sends it as a part of the user's message instead.
 */
const FENCE = '`'.repeat(3);

export function forModel(messages: AppMessage[], screens: Screens = {}): AppMessage[] {
  return messages.map((message) => {
    const spec = specFromParts(message.parts);
    if (!spec?.elements[spec.root]) return message;
    const left = { ...spec, state: screens[message.id] ?? spec.state };
    const parts = message.parts.filter((part) => part.type !== SPEC_DATA_PART_TYPE);
    return { ...message, parts: [...parts, { type: 'text' as const, text: `\n\n${FENCE}spec\n${toPatches(left).join('')}${FENCE}` }] };
  });
}

/** Whether a message's spec parts build a spec `forModel` can write back. A patch that can't apply throws as it builds. */
const replays = (message: AppMessage) => {
  try {
    const spec = specFromParts(message.parts);
    return !spec || builtSpec.safeParse(spec).success;
  } catch {
    return false;
  }
};

const refuse = (status: number, text: string) => new Response(text, { status, headers: { 'content-type': 'text/plain' } });
const malformed = () => refuse(400, 'The body must be JSON with a messages array.');

/** The body as text, or undefined once it passes `limit` bytes. Leaving the loop there cancels the rest of the upload. */
async function readCapped(request: Request, limit: number): Promise<string | undefined> {
  if (!request.body) return '';
  const decoder = new TextDecoder();
  let text = '', bytes = 0;
  for await (const chunk of request.body as unknown as AsyncIterable<Uint8Array>) {
    bytes += chunk.byteLength;
    if (bytes > limit) return undefined;
    text += decoder.decode(chunk, { stream: true });
  }
  return text + decoder.decode();
}

export async function handleChat(request: Request): Promise<Response> {
  // JSON only: a cross-site form or `text/plain` POST, which a browser sends without asking first, is refused.
  if (!request.headers.get('content-type')?.startsWith('application/json')) return refuse(415, 'Send the body as application/json.');
  if (Number(request.headers.get('content-length') ?? 0) > LIMITS.bodyBytes) return refuse(413, 'The body is too large.');
  const body = await readCapped(request, LIMITS.bodyBytes);
  if (body === undefined) return refuse(413, 'The body is too large.');
  let raw: unknown, sent: unknown, ended: unknown;
  try {
    ({ messages: raw, screens: sent, failed: ended } = JSON.parse(body) as { messages?: unknown; screens?: unknown; failed?: unknown });
  } catch {
    return malformed();
  }
  if (Array.isArray(raw) && raw.length > LIMITS.messages) return refuse(413, 'The conversation is too long.');
  const checked = await safeValidateUIMessages<AppMessage>({ messages: raw, dataSchemas: { spec: specPart } });
  const screens = screensSchema.safeParse(sent);
  const failed = failedSchema.safeParse(ended);
  if (!checked.success || !screens.success || !failed.success) return malformed();
  // The person's turns and the replies, each with the parts the model reads. A turn left with nothing to read would
  // reach the model empty, so it's refused; that includes every system message, since the system prompt is the
  // server's alone. A reply that failed, or one left empty, such as one stopped before its first word, is dropped.
  const dropped = new Set(failed.data);
  const messages = checked.data
    .map((m) => ({ ...m, parts: m.parts.filter((part) => KEPT[m.role].has(part.type)) }))
    .filter((m) => m.role !== 'assistant' || (m.parts.length && !dropped.has(m.id)));
  if (messages.some((m) => !m.parts.length)) return refuse(400, 'Send only user and assistant messages, each with text.');
  if (!messages.every(replays)) return malformed();

  const result = streamText({
    model: anthropic('claude-sonnet-5-5'),
    system,
    messages: await convertToModelMessages(forModel(messages, screens.data)),
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
  const server = createServer(async (req, res) => {
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
  });
  server.listen(port, () => console.log(`Chat server on http://localhost:${(server.address() as import('node:net').AddressInfo).port}/api/chat`));
}
