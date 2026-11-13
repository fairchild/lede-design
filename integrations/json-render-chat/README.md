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
                # PW_PORT=4883 npm test starts its four servers from 4883 up, so they run beside
                # npm run dev on 4880 and npm run preview on 4881
```

Try “how’s my week”, “show my tasks”, “show my notification settings”, “what’s in my inbox”, “help me sign up”, “any
projects”, “turn off push”, “fail” or “offline”. The last two fail once, partway through or before a word arrives, and
Try again then answers.

The app opens on Try it, the chat, where each reply's “How this reply was made” shows what went to the model, what
streamed back, the spec it built and what its screen did. How it works and Build it draw this README's sections of
those names, so the pages and this file say the same thing.

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
   `node:url`), and, for step 6, `server: { proxy: { '/api': 'http://localhost:4882' } }`. In both `tsconfig.json` and
   `tsconfig.app.json`, add `"paths": { "@/*": ["./src/*"] }` inside `compilerOptions` (in `tsconfig.json`, add the
   `compilerOptions` object too). `tsconfig.app.json` has comments, so a JSON parser can't edit it; edit it by hand.
   TypeScript 7 rejects `baseUrl`, so leave it out.

   Replace create-vite's demo styles: its `src/index.css` centers every line in a bordered 1126px column and sets
   `:root` to 18px, which rescales Lede. `shadcn init` merges into whatever `:root` it finds, so clear the file first.

   ```bash
   printf '@import "tailwindcss";\n' > src/index.css
   ```

2. **shadcn and Lede.** `init` writes `components.json` and shadcn's variables in `src/index.css`. Keep them: Lede's
   styles come after them and set the same variables. `init` also picks a style and may add a font, `tw-animate-css`,
   `src/components/ui/button.tsx` and `src/lib/utils.ts`; the chat uses none of them. `@lede/json-render` brings the
   Lede components its screens use and the npm packages `@json-render/core`, `@json-render/react` and `zod`, and the
   chat page itself also needs `@lede/avatar`.

   ```bash
   npx shadcn@latest init --defaults --yes
   npx shadcn@latest registry add '@lede=https://lede.cloudcompute.com/r/v0.5.0/{name}.json'
   npx shadcn@latest add @lede/theme-provider @lede/avatar @lede/json-render --yes
   ```

   Then import Lede's styles at the end of `src/index.css`, as the main README's step 2 shows. `init` leaves the file
   without a final newline, so start with one:

   ```bash
   printf '\n@import "./styles/lede/index.css";\n' >> src/index.css
   ```

3. **The chat's packages.**

   ```bash
   npm install ai @ai-sdk/react @ai-sdk/anthropic
   npm install -D tsx
   ```

4. **Copy the chat.** Its files import Lede from `@/components/lede/…`, where step 2 put it, so they build with no
   edits. Who the assistant is lives in `src/chat/assistant.ts`: its name, Daybook, what it helps with and the prompts
   an empty chat offers. The page and the server's prompt both read it, so that file is the one to change. The
   scripted replies in `src/chat/replies/` and the patterns in `mock-transport.ts` that pick them are sample data.

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
   | `src/chat/assistant.ts` | Who the assistant is: its name, what it helps with and the suggested prompts |
   | `src/chat/system.ts` | The system prompt the server sends, written by the catalog's `prompt()` |
   | `src/chat/describe.ts` | Demo only: the note an action leaves, such as “You archived Grace Hopper.” In your app, a handler acts on its params instead, such as ``archive: ({ id }) => api.archive(id)`` |
   | `server/chat.ts` | The backend: `handleChat`, a fetch-style handler for any framework's route |
   | `tsconfig.server.json` | Typechecks the server, which `tsconfig.app.json` leaves out |

   Add `{ "path": "./tsconfig.server.json" }` to `references` in `tsconfig.json`, so `tsc -b` checks the server too.

5. **Render the chat.** In `src/main.tsx`, render `<Chat />` from `./chat/Chat` in place of `<App />`, and delete
   `src/App.tsx` and `src/App.css`. Chat brings its own ThemeProvider. Then `npm run build` and `npm run dev`. The replies come from the
   mock. To check it by eye, take viewport screenshots: a full-page one draws the sticky composer where the window
   ended, partway down the page.

6. **Use the real model.** Add a `server` script, then run the server and the app pointed at it:

   ```bash
   npm pkg set scripts.server="tsx --tsconfig tsconfig.server.json server/chat.ts"
   ANTHROPIC_API_KEY=… npm run server
   VITE_CHAT_API=/api/chat npm run dev
   ```

   The server listens on 4882. To use another port, set `PORT` for the server and change the proxy in step 1 to match.

To add a component or an action, see “Extend the catalog” in [`AGENTS.md`](AGENTS.md): the compiler names each file
that has to change.

The chat page is a starting point to change. [`AGENTS.md`](AGENTS.md) has the same recipe for a coding agent, with the
mistakes that break it.

## Hand this to your coding agent

A coding agent can build the chat from [`AGENTS.md`](AGENTS.md), which holds the same steps with the mistakes that
break them. Paste this into the agent in your app's folder:

```text
Add a chat to this React app whose replies can hold screens built from Lede components, using the AI SDK and json-render. Follow https://github.com/fairchild/lede-design/blob/main/integrations/json-render-chat/AGENTS.md step by step. Install Lede from the shadcn registry at https://lede.cloudcompute.com/r/v0.5.0/{name}.json (before v0.5.0 is tagged, use /r/next/ in place of /r/v0.5.0/). When it builds, check the page in a browser with a reply showing.
```

## Run it against a real model

```bash
ANTHROPIC_API_KEY=… npm run server              # POST /api/chat on port 4882, or PORT
VITE_CHAT_API=/api/chat npm run dev             # the app; Vite proxies /api to the server
```

The key stays on the server. The browser only talks to `/api/chat`.

## How it works

Each reply is words and a screen that builds while it streams. What the person does there goes back with their next
message.

### The loop

1. **You send a message.** Your words go to the server, along with what you entered on the earlier screens.

   In the code: `src/chat/Chat.tsx` sends them with `useChat`, through the transport that `src/chat/transport.ts`
   picks: the scripted mock, or the AI SDK's `DefaultChatTransport` when `VITE_CHAT_API` is set. Each screen's state
   goes as `screens`.
2. **The server asks the model.** The model gets a system prompt listing every component and action a screen may use,
   then the conversation, with each earlier screen as the person left it.

   In the code: `server/chat.ts` calls `streamText` with the system prompt from `src/chat/system.ts`, which the
   catalog's `prompt()` writes. `forModel` writes each earlier screen back as its patches with its state, since the AI
   SDK's `convertToModelMessages` drops data parts.
3. **The screen streams back.** The model writes its words, then the screen as a series of small changes, and the
   screen builds as each one arrives.

   In the code: json-render's `pipeJsonRender` lifts each JSONL patch line out of the text into a `data-spec` part,
   and `specFromParts` in `json-render/patches.ts` applies the patches in order.
4. **Lede draws it.** Each part of the screen is a Lede component, and the person can use it while the rest streams
   in.

   In the code: `json-render/spec-view.tsx` draws the spec so far, and `json-render/registry.tsx` maps each catalog
   type to its Lede component.
5. **What the person does goes back.** A press opens an item in place or runs an action, and what they type or switch
   goes with their next message, so the model's next reply starts from it.

   In the code: an action calls its handler in `Chat.tsx`, such as `archive` with an item's id. `SpecView`'s
   `onStateChange` gives the chat each screen's state, which the next message sends as `screens`.

### What Lede adds

json-render turns a model's spec into a React screen and keeps that screen's state. Lede draws each part with its own
components and adds five behaviors for a screen that streams:

- A person's changes survive streaming. A value they typed or switched keeps their change while the rest of the reply
  streams in, and a list keeps gaining rows around it.
- An action holds back on a failing field. It doesn't run while a field it reads fails its check, and the field shows
  why and takes focus.
- Focus stays on the page. When the stream or an action removes the focused control, focus moves to its neighbor or the
  screen's title.
- An item opens in place. Its title takes focus, and Back or Escape returns focus to the row that opened it. A row
  shows a chevron only when it opens something.
- Follow-ups see what was typed. Each screen's state goes with the next message, so the model reads the form as the
  person left it.

[`../json-render-chat-plain`](../json-render-chat-plain/README.md#side-by-side) builds the same chat on json-render's
own React components, and its “Side by side” table measures what each of these takes there.

### Details

json-render documents this inline path for the AI SDK, where the spec arrives in the same stream as the words. The
mock writes prose and then bare patch lines; a model under the inline prompt fences them in a ```` ```spec ```` block
and may send the state after the elements. `pipeJsonRender` reads both the same way, so the client can't tell them
apart. It sends each patch in pieces, down to a character at a time, which is how json-render streams them.

The rules ask for a whole screen in each reply; a reply whose screen can't draw, such as patches to an earlier one,
shows an error with Try again.

## Files

| File | What it is |
| --- | --- |
| `src/chat/` | The chat: the files step 4 copies. |
| `src/guide/` and `chat.html` | The guide around the chat, at `index.html`: Try it, How it works and Build it, which draw this README. `chat.html` is the chat alone, as step 5 renders it. Step 4 leaves both out. |
| `server/chat.ts` | The reference backend: `streamText` with Anthropic and the catalog's `prompt()`. |
| `templates/tsconfig.server.json` | The server's tsconfig for an app made with create-vite. |
| `tests/mock-transport.test.ts` | Sends each scripted prompt through the mock and checks the spec against the catalog. |
| `tests/describe.test.ts` | Checks each action's note, for literal params, params bound to state and rows drawn by repeat. |
| `tests/model-replies.test.tsx` | Streams 16 replies a model wrote for 8 requests through the server's transform: each parses, draws the titles, rows and buttons its spec holds, once, and gets exactly the issues `check` is expected to report: none, except the obsolete `open` action six of them bind. |
| `tests/server.test.ts` | Checks that the model sees earlier screens with the state the person left in them, then starts the server: what it refuses, the length cap and parts it passes the model, and one log line per failed model call. |
| `tests/chat.e2e.ts` | The chat alone (`chat.html`) in a browser: the order of a reply, an action's note, an item opened in place and Back, Escape in a detail and in the composer, Stop, Try again, focus, the composer's scroll padding, checked fields and their errors, a list that fills in as it streams, typing and presses while a reply streams, a checkbox label at 200% text, following a reply as it streams and axe. |
| `tests/guide.e2e.ts` | The guide: each screen's link and h1, Back to where the person was, a Try link pressed mid-reply, each step's example, each reply's account of how it was made, this README's sections shown block for block, Copy and axe on each screen in each theme at 390 and 1280 pixels and 200% text. |
| `tests/markdown.test.tsx` and `tests/install.test.ts` | The guide's renderer refuses Markdown it can't draw, and the documented install brings every Lede file the copied chat imports. |
| `tests/real.e2e.ts`, `fake-anthropic.ts` and `fake-replies/` | The chat on the AI SDK's own transport, against `server/chat.ts` and a fake Anthropic: a reply that draws, a connection that drops partway, a malformed body, a follow-up that carries a screen's state, a reply that only patches an earlier screen, focus when a control or row hides itself, a row switched on while its list streams in and a form with a pattern and a decimal. |

The catalog, the registry and `SpecView` are Lede's `json-render` item, in `registry/lede/json-render/`, which this
entry and [`../json-render`](../json-render) both import through the `@/components/lede` alias, the path an install
gives them. Their imports resolve from this app's `node_modules` (`dedupe` in `vite.config.ts`, `paths` in
`tsconfig.json`), so the repo root needs no install.

## The chat UI is a sketch

The page is a sketch on Lede primitives until Lede's Chat block lands, and that block will replace it.

- The conversation is a named `<section>` holding an ordered list of turns. Each has its author and time as a heading:
  your turns sit in a bubble on the right, and the assistant's beside its avatar, text first and then the screen.
- The composer is a `<form>`: Enter sends and Shift+Enter starts a new line. Escape, from the composer or a button
  beside it, backs out one layer: it cancels a question waiting on a reply, and otherwise ends the reply, as Stop does.
  The composer stays at the foot of the window when the window is tall enough; with large text on a short screen it
  scrolls with the page.
- Focus starts in the composer, since a chat's next act is to type, which departs from Lede's usual landing on the h1.
  It stays there after sending, Stop and Try again. A polite status line, visible only on an error, announces each
  reply's first sentence. New content isn't focused.
- The window follows a reply until your question reaches the top, so the question and the start of the answer stay in
  view together. Scrolling by hand stops the following.
- A row or a Button opens its item in place. The model writes each item's detail in the same reply, as a View the row's
  press shows, and the detail's back, or Escape while focus is in that screen, shows the list again. The detail's
  title takes focus as it opens, and Back returns focus to the row that opened it. A row shows a chevron only when its
  press opens a View, and `check` flags one that opens nothing.
- A screen's actions add a note under it, such as “You archived Grace Hopper.” They stay in the browser: nothing tells
  the model. A real app would run the action, and could also send it as a message. `setState` changes stay in the
  screen, so typing in a field adds no notes.
