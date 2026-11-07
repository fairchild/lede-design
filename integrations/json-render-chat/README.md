# Lede and json-render in an AI SDK chat

A chat where the assistant's replies mix text with screens built from Lede components. The model writes a json-render
spec as it replies, and the screen builds in the message while the reply streams. The chat runs on the AI SDK's
`useChat`. Its replies come from a scripted mock by default, so it runs with no network or key, and one environment
variable switches it to a real model.

```bash
npm install
npm run dev     # http://localhost:4880, with the scripted replies
npm run build   # tokens, typecheck (app, server and tests), then the site
npm test        # the mock and the server in Vitest, then the chat in a browser with Playwright and axe
```

Try “how’s my week”, “show my notification settings”, “what’s in my inbox”, “help me sign up”, “any projects” or
“fail”. The last one fails partway through once, and Try again then answers.

## Build this in your app

Lede's `json-render` registry item holds the part every chat needs: the catalog a model writes specs from, the
registry that draws them with Lede and `SpecView`, which draws a spec in a message. The chat page, its transports and
the server are this example's own files, which you copy. These steps were run as written on a fresh
`npm create vite@latest -- --template react-ts` app (create-vite 9, TypeScript 7, Vite 8), and its `npm run build`
passed. Commands run in your app's folder, and `LEDE` is the path to a clone of this repo.

1. **Tailwind and the `@` alias.** Lede's CSS needs Tailwind v4.

   ```bash
   npm install tailwindcss @tailwindcss/vite
   ```

   In `vite.config.ts`, add `tailwindcss()` to `plugins`, the alias
   `resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }` (`fileURLToPath` and `URL` come from
   `node:url`), and, for step 6, `server: { proxy: { '/api': 'http://localhost:4882' } }`. Put
   `@import "tailwindcss";` at the top of `src/index.css`. In both `tsconfig.json` and `tsconfig.app.json`, add
   `"compilerOptions": { "paths": { "@/*": ["./src/*"] } }`. TypeScript 7 rejects `baseUrl`, so leave it out.

2. **shadcn and Lede.** `init` writes `components.json` and shadcn's variables in `src/index.css`. Keep them: Lede's
   styles come after them and set the same variables. `init` may also add `src/components/ui/button.tsx`, which the
   chat doesn't use, so you can delete it. `@lede/json-render` brings the Lede components its screens use and the
   npm packages `@json-render/core`, `@json-render/react` and `zod`.

   ```bash
   npx shadcn@latest init --defaults --yes
   npx shadcn@latest registry add '@lede=https://lede.cloudcompute.com/r/v0.4.0/{name}.json'
   npx shadcn@latest add @lede/theme-provider @lede/avatar @lede/json-render --yes
   ```

   Then add `@import "./styles/lede/index.css";` on a new line at the end of `src/index.css`, as the main README's
   step 2 shows.

3. **The chat's packages.**

   ```bash
   npm install ai @ai-sdk/react @ai-sdk/anthropic
   npm install -D tsx
   ```

4. **Copy the chat.** Its files import Lede from `@/components/lede/…`, where step 2 put it, so they need no edits.

   ```bash
   cp -R $LEDE/integrations/json-render-chat/src/chat src/
   mkdir -p server && cp $LEDE/integrations/json-render-chat/server/chat.ts server/
   cp $LEDE/integrations/json-render-chat/templates/tsconfig.server.json .
   ```

   | Into your app | What it is |
   | --- | --- |
   | `src/chat/Chat.tsx` and `chat.css` | The chat page: the conversation, the composer, Stop, the status line and what each action did |
   | `src/chat/transport.ts` | The switch: the scripted mock, or `DefaultChatTransport` when `VITE_CHAT_API` is set |
   | `src/chat/mock-transport.ts` and `replies/*.json` | The scripted replies, which stream through `pipeJsonRender` like a model's |
   | `src/chat/app-message.ts` | `AppMessage`, a `UIMessage` whose data parts are json-render's spec patches |
   | `server/chat.ts` | The backend: `handleChat`, a fetch-style handler for any framework's route |
   | `tsconfig.server.json` | Typechecks the server, which `tsconfig.app.json` leaves out |

   Add `{ "path": "./tsconfig.server.json" }` to `references` in `tsconfig.json`, so `tsc -b` checks the server too.

5. **Render the chat.** In `src/main.tsx`, render `<Chat />` from `./chat/Chat` in place of `<App />`. Then
   `npm run build` and `npm run dev`. The replies come from the mock.

6. **Use the real model.** Run the server, then the app pointed at it:

   ```bash
   ANTHROPIC_API_KEY=… npx tsx --tsconfig tsconfig.server.json server/chat.ts
   VITE_CHAT_API=/api/chat npm run dev
   ```

The chat page is a starting point to change. [`AGENTS.md`](AGENTS.md) has the same recipe for a coding agent, with the
mistakes that break it.

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

The mock writes prose and then bare patch lines; a model under the inline prompt fences them in a ```` ```spec ````
block and may send the state after the elements. `pipeJsonRender` reads both the same way, so the client can't tell
them apart. It sends each patch in pieces, down to a character at a time, which is how json-render streams them.

On the next turn the server puts each earlier screen back into the conversation as the fenced patches, with `forModel`
in `server/chat.ts`. The AI SDK's `convertToModelMessages` drops data parts, so without it the model never sees the
screens it sent, and “turn off push” has nothing to refer to.

## Files

| File | What it is |
| --- | --- |
| `src/chat/` | The chat: the files step 4 copies. |
| `server/chat.ts` | The reference backend: `streamText` with Anthropic and the catalog prompt. |
| `templates/tsconfig.server.json` | The server's tsconfig for an app made with create-vite. |
| `tests/mock-transport.test.ts` | Sends each scripted prompt through the mock and checks the spec against the catalog. |
| `tests/server.test.ts` | Checks that the model sees earlier screens, and starts the server to check it answers. |
| `tests/chat.e2e.ts` | The chat in a browser: the order of a reply, an action's note, Stop, Escape, Try again, focus and axe. |

The catalog, the registry and `SpecView` are Lede's `json-render` item, in `registry/lede/json-render/`, which this
entry and [`../json-render`](../json-render) both import through the `@/components/lede` alias, the path an install
gives them. Their imports resolve from this app's `node_modules` (`dedupe` in `vite.config.ts`, `paths` in
`tsconfig.json`), so the repo root needs no install.

## The chat UI is a sketch

The page is a sketch on Lede primitives until Lede's Chat block lands, and that block will replace it.

- The conversation is a named `<section>` holding an ordered list of turns. Each has its author and time as a heading:
  your turns sit in a bubble on the right, and the assistant's beside its avatar, text first and then the screen.
- The composer is a `<form>`: Enter sends, Shift+Enter starts a new line, and Escape or Stop ends a streaming reply.
  It stays at the foot of the window when the window is tall enough; with large text on a short screen it scrolls with
  the page.
- Focus starts in the composer, since a chat's next act is to type, which departs from Lede's usual landing on the h1.
  It stays there after sending, Stop and Try again. A polite status line, visible only on an error, announces each
  reply's first sentence. New content isn't focused.
- The window follows a reply until your question reaches the top, so the question and the start of the answer stay in
  view together. Scrolling by hand stops the following.
- A screen's actions add a note under it, such as “You opened Venue review.” They stay in the browser: nothing tells
  the model. A real app would run the action, and could also send it as a message. `setState` changes stay in the
  screen, so typing in a field adds no notes.
