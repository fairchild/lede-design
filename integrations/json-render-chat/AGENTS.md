# Building a json-render + Lede chat: a guide for coding agents

This is the recipe for adding a chat to a React app where the assistant's replies hold screens built from Lede
components, using the AI SDK and json-render. `README.md` explains the example. This file lists the steps in order
and the mistakes that break the build or the page. Every name below was checked against `ai@7.0.164`,
`@ai-sdk/react@4.0.168` and `@json-render/*@0.22.0`. Read those packages' `.d.ts` files before trusting a name from
memory.

## Which Vercel package

Use the AI SDK: `useChat` from `@ai-sdk/react`, with a `ChatTransport` from `ai`. Vercel's “Chat SDK” (npm `chat`) is
for bots on Slack, Teams and Discord, so it doesn't belong in a browser chat.

## Recipe

1. Follow “Build this in your app” in `README.md` step by step. It was run as written on a fresh create-vite
   `react-ts` app, and `npm run build` passed. `scripts/copy-into.mjs` copies every file to the path its imports
   expect (`src/json-render/`, `src/specs/`, `src/chat/`, `server/`), so imports need no rewriting: they use
   `@/components/lede/…`, where `shadcn add` puts Lede, and `@/json-render/…`.
2. To change what a model may build, edit `src/json-render/catalog.ts` and `registry.tsx` together.
   `catalog-fit.ts` fails `tsc` when a catalog prop isn't one the Lede component takes.
3. The server is `server/chat.ts`: `streamText({ model: anthropic('claude-sonnet-5-5'), system:
   catalog.prompt({ mode: 'inline' }), messages: await convertToModelMessages(messages) })`, then
   `createUIMessageStreamResponse({ stream: pipeJsonRender(result.toUIMessageStream({ onError })) })`. It exports
   `handleChat(request)`, a fetch-style handler for any framework's route, and runs on its own under
   `tsx --tsconfig tsconfig.server.json server/chat.ts`. The key is `ANTHROPIC_API_KEY` in the server's environment.
4. The client picks its transport in `src/chat/transport.ts`: the scripted mock by default, or
   `new DefaultChatTransport({ api })` when `VITE_CHAT_API` is set.
5. In each assistant message, render its text parts first, then pass `message.parts` to `SpecView` in
   `src/chat/spec-view.tsx`.
6. Check it: `npm run build`, the mock test in `tests/mock-transport.test.ts` adapted to your script, then axe on
   the page with a reply showing.

## Failure modes

Each one below broke this example while it was built, or was checked in the package source.

**Prompt and stream**

- `catalog.prompt()` with no options is `mode: 'standalone'`: the model writes only JSONL, with no prose. A chat needs
  `{ mode: 'inline' }`.
- Without `pipeJsonRender` on the server, the patch lines arrive as plain text and the screen never draws. The
  client reads only `data-spec` parts.
- `buildSpecFromParts` returns `null` until the first patch, and then a spec whose `root` is set before any element
  exists. Render only when `spec.elements[spec.root]` exists.
- `JSONUIProvider` reads `initialState` once, when it mounts. Mount it after the `/state` patch arrives, or emit
  `/state` before any element (as `toPatches` in `src/json-render/stream.ts` does). Otherwise bound fields start
  empty.
- `JSONUIProvider` keeps the `handlers` it mounted with. Pass handlers that don't close over changing state, such as
  ones that call a state setter with a function.
- A data part that a transport emits without an `id` is appended as a new part each time, so every patch is its own
  part. That's what `buildSpecFromParts` expects.

**Validation**

- `catalog.validate(spec)` checks the spec's shape and that each `type` is in the catalog. It doesn't parse props
  against their Zod schemas. `src/json-render/check.ts` adds that pass. Run it in tests and on any spec you store.
- `Renderer` validates nothing. An unknown type draws the `fallback` prop, or nothing. A bad prop reaches the Lede
  component as it is. A component that throws is caught by a per-element error boundary and draws nothing.
- Server rendering (`renderToString`, as in a test) has no error boundaries, so a throwing component fails the
  whole render there.
- A prop bound with `{ "$bindState": "/path" }` fails a strict schema parse, because the value is an object. Make
  bound props optional before parsing, as `check.ts` does.

**Lede inside a message**

- PageHeader is a screen's h1. In a spec it must set `focusOnMount={false}`, or it takes focus from the composer as
  each reply mounts. It takes `headingLevel` 1 or 2 only, so under a message's author heading the registry draws the
  title itself. Set the level with the registry's `SpecHeadingLevel` context.
- Lede's TextField takes no `ref`. To focus the composer, query the `textarea` inside its `<form>`.
- TextField's props are a union of input and textarea, so an inline `onChange` needs its event type written out:
  `(e: React.ChangeEvent<HTMLTextAreaElement>) => …`.
- ListRow uses `transform` for its swipe, which gives each row a stacking context. A `position: sticky` composer
  needs `z-index: var(--z-tabbar)`, or rows scroll over it. Let the document scroll: a scroll container of the
  conversation's own clips a tall screen inside a message.
- Scrolling to the bottom on every chunk pushes the question out of view while a long reply streams. Follow the
  reply until the question's turn reaches the top, and stop following when the person scrolls (`src/chat/Chat.tsx`).
- A control that unmounts while focused, such as Stop when the reply ends or a row that an action hides, drops focus to
  `<body>`. Move focus to the composer, or to the next row, when that happens.
- Announce a reply with a polite `role="status"` line, and don't move focus into new content.

**Build**

- When the catalog or Lede's source lives outside the Vite root, its bare imports resolve from where the file sits.
  List them in Vite's `resolve.dedupe`, and map them in `tsconfig.json` `paths` to an extensionless file in this app's
  `node_modules`, such as `@json-render/core/dist/index`, `@json-render/react/dist/schema` or `zod/index`. That form
  works for both `tsc` and `tsx`. `tsx` can't resolve a mapping to a package folder, a `.d.ts` mapping breaks it at
  runtime, and a `.mjs` mapping loses the types.
- With TypeScript's DOM lib, a `ReadableStream` isn't async-iterable. Read a transport's stream with `getReader()`.
- `messages.findLast` needs `"lib": ["ES2023"]`.
- create-vite's `tsconfig.app.json` sets `erasableSyntaxOnly`, which rules out constructor parameter properties
  (`constructor(private delay = 60)` is TS1294), enums and namespaces. Declare the field and assign it.
- It also sets `verbatimModuleSyntax`, so a type-only import needs `import type` or an inline `type`.
- TypeScript 7 rejects `baseUrl` (TS5102). Write `paths` with `./`-relative targets and no `baseUrl`, in both
  `tsconfig.json` and `tsconfig.app.json`; shadcn reads the first, `tsc -b` the second.
- `tsconfig.app.json` includes only `src`, so `server/` isn't typechecked unless it has a tsconfig of its own.
  `templates/tsconfig.server.json` is one; add it to `references` in `tsconfig.json`.
- `toUIMessageStream()` sends a generic “An error occurred.” to the client unless you pass `onError`. The example
  returns the error's message, which helps while you build; return something generic in production, since a
  provider's message can name your account or model.
