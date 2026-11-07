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

These steps were run as written on a fresh `npm create vite@latest -- --template react-ts` app (create-vite 9,
TypeScript 7, Vite 8), and its `npm run build` passed with the chat, the server and the catalog check. Commands run in
your app's folder. `LEDE` is the path to a clone of this repo.

1. **Tailwind and the `@` alias.** Lede's CSS needs Tailwind v4.

   ```bash
   npm install tailwindcss @tailwindcss/vite
   ```

   In `vite.config.ts`, add `tailwindcss()` to `plugins`, the alias
   `resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }` (`fileURLToPath` and `URL` come from
   `node:url`), and, for step 7, `server: { proxy: { '/api': 'http://localhost:4882' } }`. Put
   `@import "tailwindcss";` at the top of `src/index.css`. In both `tsconfig.json` and `tsconfig.app.json`, add
   `"compilerOptions": { "paths": { "@/*": ["./src/*"] } }`. TypeScript 7 rejects `baseUrl`, so leave it out.

2. **shadcn and Lede.** `init` writes `components.json` and shadcn's variables in `src/index.css`. Keep them: Lede's
   styles come after them and set the same variables. `init` may also add `src/components/ui/button.tsx`, which the
   chat doesn't use, so you can delete it.

   ```bash
   npx shadcn@latest init --defaults --yes
   npx shadcn@latest registry add '@lede=https://lede.cloudcompute.com/r/v0.4.0/{name}.json'
   npx shadcn@latest add @lede/theme-provider @lede/button @lede/checkbox @lede/disclosure @lede/list @lede/segmented-control \
     @lede/switch @lede/text-field @lede/empty-state @lede/form-section @lede/page-header @lede/summary-card --yes
   ```

   The registry URL serves once Lede 0.4.0 is released. Before then, run `npm run registry` in a clone of this repo,
   serve `public/r` (`python3 -m http.server 4887 -d public/r`) and use `'@lede=http://localhost:4887/{name}.json'`,
   which is how these steps were tested. Then add `@import "./styles/lede/index.css";` at the end of `src/index.css`.

3. **Packages.**

   ```bash
   npm install ai @ai-sdk/react @json-render/core @json-render/react zod @ai-sdk/anthropic
   npm install -D tsx
   ```

4. **Copy the files.** The script copies them to the paths their imports expect, so you rewrite nothing.

   ```bash
   node $LEDE/integrations/json-render-chat/scripts/copy-into.mjs .
   ```

   | Into your app | From this repo | What it is |
   | --- | --- | --- |
   | `src/json-render/catalog.ts` | `integrations/json-render/src/` | The components a model may use, with schemas and descriptions |
   | `src/json-render/registry.tsx` | same | Draws each catalog type with Lede |
   | `src/json-render/check.ts` | same | Checks a spec's props, which json-render doesn't |
   | `src/json-render/catalog-fit.ts` | same | Fails `tsc` on a catalog prop a Lede component doesn't take |
   | `src/json-render/stream.ts`, `specs.ts` and `src/specs/*.json` | `integrations/json-render/` | The recorded replies the mock streams |
   | `src/chat/*` | `integrations/json-render-chat/src/chat/` | The chat page, transports, spec view and its CSS |
   | `server/chat.ts` | `integrations/json-render-chat/server/` | The backend |
   | `tsconfig.server.json` | `integrations/json-render-chat/templates/` | Typechecks the server; copied only if you have none |

5. **Typecheck the server too.** Add `{ "path": "./tsconfig.server.json" }` to `references` in `tsconfig.json`, so
   `tsc -b` checks it.

6. **Render the chat.** In `src/main.tsx`, render `<Chat />` from `./chat/Chat` in place of `<App />`. Then
   `npm run build` and `npm run dev`. The replies come from the mock.

7. **Use the real model.** Run the server, then the app pointed at it:

   ```bash
   ANTHROPIC_API_KEY=… npx tsx --tsconfig tsconfig.server.json server/chat.ts
   VITE_CHAT_API=/api/chat npm run dev
   ```

The chat page in `src/chat/Chat.tsx` is a starting point to change. To reuse only the parts, take
`src/chat/transport.ts` (the mock or the real route), `src/chat/spec-view.tsx` (a reply's screen) and
`server/chat.ts` (`handleChat`, a fetch-style handler for any framework's route). [`AGENTS.md`](AGENTS.md) has the
same recipe for a coding agent, with the mistakes that break it.

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
| `src/chat/Chat.tsx` and `chat.css` | The chat page: the conversation, the composer, Stop, the status line and “You chose …” notes. |
| `src/chat/transport.ts` | The switch: the mock, or `DefaultChatTransport` when `VITE_CHAT_API` is set. |
| `src/chat/mock-transport.ts` | The scripted `ChatTransport`: a keyword picks a reply, which streams through `pipeJsonRender`. |
| `src/chat/spec-view.tsx` | Draws a reply's `data-spec` parts with the Lede registry. |
| `src/chat/chat-message.ts` | Maps AI SDK messages onto the message shape of Lede's planned Chat block. |
| `scripts/copy-into.mjs` | Copies the chat and its catalog into another app, at the paths their imports expect. |
| `server/chat.ts` | The reference backend: `streamText` with Anthropic and the catalog prompt. |
| `tests/mock-transport.test.ts` | Sends each scripted prompt through the mock and checks the spec against the catalog. |

This entry imports the catalog, registry and recorded specs from `../json-render/src` through the `@/json-render`
alias, the path a copy into your app's `src/json-render/` gives them, so both entries share one catalog. Their imports resolve from this app's `node_modules` (`dedupe` in
`vite.config.ts`, `paths` in `tsconfig.json`), so `../json-render` needs no install.

## The chat UI is a sketch

The page is a sketch on Lede primitives until Lede's Chat block lands, and that block will replace it.

- The conversation is a named `<section>` holding an ordered list, and each message has its author as a heading.
- The composer is a `<form>`: Enter sends, Shift+Enter starts a new line, and Stop shows while a reply streams.
- Focus stays in the composer after sending, and returns there when Stop or Try again goes away. A polite status line
  announces each reply's first sentence and any error. New content isn't focused.
- A screen's actions, such as opening a message, add a “You chose …” note under that reply. `setState` changes stay in
  the screen, so typing in a field adds no notes.
