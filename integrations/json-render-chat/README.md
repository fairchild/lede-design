# Lede and json-render in a chat

A chat whose replies can mix text with screens that json-render builds from Lede. It uses the AI SDK's `useChat`, and
its replies come from a scripted mock transport by default, so it needs no network or API key. One environment
variable points it at a real backend.

This chat UI is a sketch on Lede primitives. Lede's planned Chat block will replace it, and `src/chat-message.ts`
already maps AI SDK messages onto that block's message shape.

```bash
npm install
npm run dev     # http://localhost:4880, with the scripted replies
npm run build   # tokens, typecheck (app and server), then the site
npm test        # sends each scripted prompt through the mock and checks its spec
```

Try “show my notification settings”, “what’s in my inbox”, “help me sign up”, “any projects” or “fail”. The last one
fails partway through once, and Try again then answers.

## A real backend

`server/chat.ts` is a small Node server: `streamText` with `@ai-sdk/anthropic` and `claude-sonnet-5-5`, with
json-render's `catalog.prompt({ mode: 'inline' })` as the system prompt. The key stays on the server.

```bash
ANTHROPIC_API_KEY=… npm run server              # POST /api/chat on port 4882
VITE_CHAT_API=/api/chat npm run dev             # the app, with Vite proxying /api to the server
```

With `VITE_CHAT_API` set, the app uses `DefaultChatTransport({ api })` in place of the mock.

## How a spec reaches the client

The spec arrives as data parts. In inline mode the model writes its prose and then the spec as JSONL patch lines in
one text stream. On the server, json-render's `pipeJsonRender` lifts each patch line out of the text into a
`data-spec` part, and on the client `buildSpecFromParts` applies them in order, so the screen builds while the reply
streams. json-render documents this path for the AI SDK, and it needs no tool round trip: a tool's output arrives in
one piece once the call ends.

The mock writes the same mixed stream a model would, from the recorded specs in `../json-render/specs`, and runs it
through the same `pipeJsonRender`. The client can't tell them apart.

## What it shares

The catalog, registry, spec check and recorded specs come from `../json-render/src` through the `@json-render-lede`
alias, so both entries draw from one catalog. Its imports resolve from this app's `node_modules` (`dedupe` in
`vite.config.ts`, `paths` in `tsconfig.json`), so `../json-render` needs no install of its own. A spec renders under its
message's author heading, so its title is an h3, through the registry's `SpecHeadingLevel`.

## In the page

- The conversation is a named `<section>` holding an ordered list, and each message has its author as a heading.
- The composer is a `<form>`: Enter sends, Shift+Enter starts a new line, and Stop shows while a reply streams.
- Focus stays in the composer after sending, and returns there when Stop or Try again leaves. A polite status line
  announces each reply's first sentence and any error. The new content isn't focused.
- Actions from a screen, such as opening a message, add a “You chose …” note under that reply. `setState` changes
  stay in the screen, so typing in a field adds no notes.
