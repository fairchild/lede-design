# Lede and json-render in an AI SDK chat

A chat where the assistant's replies mix text with screens built from Lede components. The model writes a json-render
spec as it replies, and the screen builds in the message while the reply streams. The chat runs on the AI SDK's
`useChat`. Its replies come from a scripted mock by default, so it runs with no network or key, and one environment
variable switches it to a real model.

```bash
npm install
npm run dev     # http://localhost:4880, with the scripted replies
npm test        # sends each scripted prompt through the mock and checks the spec it builds
npm run build   # tokens, typecheck (app, server and tests), then the site
```

Try “show my notification settings”, “what’s in my inbox”, “help me sign up”, “any projects” or “fail”. The last one
fails partway through once, and Try again then answers.

## Build this in your app

You need a Vite (or other client-only) React 19 app with Tailwind v4, the `@/*` alias and a `components.json`, as in
the main README's “Use it in a shadcn project”. Lede doesn't support server rendering yet.

1. **Install.** Add the Lede items the catalog uses, then the chat and json-render packages.

   ```bash
   npx shadcn@latest registry add '@lede=https://lede.cloudcompute.com/r/v0.4.0/{name}.json'
   npx shadcn@latest add @lede/theme-provider @lede/button @lede/checkbox @lede/list @lede/segmented-control \
     @lede/switch @lede/text-field @lede/empty-state @lede/form-section @lede/page-header @lede/summary-card
   npm install ai @ai-sdk/react @json-render/core @json-render/react zod
   npm install @ai-sdk/anthropic   # on the server
   ```

2. **Copy the catalog and registry.** [`../json-render/src/catalog.ts`](../json-render/src/catalog.ts) says which
   Lede components a model may use, with a Zod schema and a description for each.
   [`../json-render/src/registry.tsx`](../json-render/src/registry.tsx) draws each one with Lede. Both import from
   `@/components/lede/…`, the paths step 1 installs to. [`../json-render/src/check.ts`](../json-render/src/check.ts)
   is optional: it checks a spec's props, which json-render doesn't.

3. **Add the server route.** [`server/chat.ts`](server/chat.ts) is the whole backend. In your framework's route
   handler it comes down to this, with `ANTHROPIC_API_KEY` in the server's environment:

   ```ts
   const result = streamText({
     model: anthropic('claude-sonnet-5-5'),
     system: catalog.prompt({ mode: 'inline' }),
     messages: await convertToModelMessages(messages),
   });
   return createUIMessageStreamResponse({ stream: pipeJsonRender(result.toUIMessageStream()) });
   ```

4. **Connect the chat.** `useChat({ transport: new DefaultChatTransport({ api: '/api/chat' }) })`. To keep scripted
   replies for development, copy [`src/transport.ts`](src/transport.ts) and
   [`src/mock-transport.ts`](src/mock-transport.ts): `VITE_CHAT_API=/api/chat` switches from the mock to your route.

5. **Draw the screen in the message.** Copy [`src/spec-view.tsx`](src/spec-view.tsx), and render
   `<SpecView parts={message.parts} streaming={…} actions={…} />` after an assistant message's text parts. It reads
   the `data-spec` parts and draws them with the registry, and `actions` receives the catalog actions a screen runs.

Then copy [`tests/mock-transport.test.ts`](tests/mock-transport.test.ts) to check every scripted reply against the
catalog. [`AGENTS.md`](AGENTS.md) has the same recipe for a coding agent, with the mistakes that break it.

## Run it against a real model

```bash
ANTHROPIC_API_KEY=… npm run server              # POST /api/chat on port 4882
VITE_CHAT_API=/api/chat npm run dev             # the app; Vite proxies /api to the server
```

The key stays on the server. The browser only talks to `/api/chat`.

## How a spec reaches the client

The spec arrives as data parts. `catalog.prompt({ mode: 'inline' })` asks the model for its prose first and then the
spec as JSONL patch lines, all in one text stream. On the server, json-render's `pipeJsonRender` lifts each patch line
out of the text into a `data-spec` part. On the client, `buildSpecFromParts` applies the patches in order, so the
screen builds while the reply streams. json-render documents this path for the AI SDK. A tool would deliver the spec
in one piece once the call ends.

The mock writes the same mixed stream a model would, from the recorded specs in `../json-render/specs`, and runs it
through the same `pipeJsonRender`, so the client can't tell them apart.

## Files

| File | What it is |
| --- | --- |
| `src/transport.ts` | The switch: the mock, or `DefaultChatTransport` when `VITE_CHAT_API` is set. |
| `src/mock-transport.ts` | The scripted `ChatTransport`: a keyword picks a reply, which streams through `pipeJsonRender`. |
| `src/spec-view.tsx` | Draws a reply's `data-spec` parts with the Lede registry. |
| `src/App.tsx` | The chat page: the conversation, the composer, Stop, the status line and “You chose …” notes. |
| `src/chat-message.ts` | Maps AI SDK messages onto the message shape of Lede's planned Chat block. |
| `server/chat.ts` | The reference backend: `streamText` with Anthropic and the catalog prompt. |
| `tests/mock-transport.test.ts` | Sends each scripted prompt through the mock and checks the spec against the catalog. |

This entry imports the catalog, registry and recorded specs from `../json-render/src` through the `@json-render-lede`
alias, so both entries share one catalog. Their imports resolve from this app's `node_modules` (`dedupe` in
`vite.config.ts`, `paths` in `tsconfig.json`), so `../json-render` needs no install.

## The chat UI is a sketch

The page is a sketch on Lede primitives until Lede's Chat block lands, and that block will replace it.

- The conversation is a named `<section>` holding an ordered list, and each message has its author as a heading.
- The composer is a `<form>`: Enter sends, Shift+Enter starts a new line, and Stop shows while a reply streams.
- Focus stays in the composer after sending, and returns there when Stop or Try again goes away. A polite status line
  announces each reply's first sentence and any error. New content isn't focused.
- A screen's actions, such as opening a message, add a “You chose …” note under that reply. `setState` changes stay in
  the screen, so typing in a field adds no notes.
