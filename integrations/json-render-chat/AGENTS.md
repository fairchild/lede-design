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
   `react-ts` app, and `npm run build` passed. `npx shadcn@latest add @lede/json-render` installs the catalog, the
   registry, `prompt`, `catalog-fit`, `check`, `toPatches` and `SpecView` under `components/lede/json-render/`, with the Lede components and
   npm packages they need. The chat's own files, copied from `src/chat/` and `server/`, import them from
   `@/components/lede/…`, so they need no edits.
2. The registry URL, `https://lede.cloudcompute.com/r/v0.4.0/{name}.json`, serves once 0.4.0 is tagged. Before a tag
   exists, the deployed site's `/r/next/{name}.json` is the unreleased build of main. From a clone, `npm run registry`
   writes the same files to `public/r/`, which any static server can serve.
3. To change what a model may build, follow “Extend the catalog” below.
4. The server is `server/chat.ts`: `streamText({ model: anthropic('claude-sonnet-5-5'), system: prompt({ system }),
   messages: await convertToModelMessages(forModel(messages)) })`, then
   `createUIMessageStreamResponse({ stream: pipeJsonRender(result.toUIMessageStream({ onError })) })`. It exports
   `handleChat(request)`, a fetch-style handler for any framework's route, and runs on its own under
   `tsx --tsconfig tsconfig.server.json server/chat.ts`. The key is `ANTHROPIC_API_KEY` in the server's environment.
5. The client picks its transport in `src/chat/transport.ts`: the scripted mock by default, or
   `new DefaultChatTransport({ api })` when `VITE_CHAT_API` is set. Type the chat as
   `useChat<AppMessage>`, where `AppMessage` is `UIMessage<unknown, { [SPEC_DATA_PART]: SpecDataPart }>`.
6. In each assistant message, render its text parts first, then
   `<SpecView spec={specFromParts(message.parts)} streaming={live} headingLevel={3} handlers={…} />`, with
   `specFromParts` from `components/lede/json-render/patches`, memoized on `message.parts`.
7. Check it: `npm run build`, then the page in a browser with a reply showing: the question, the reply's text and then
   its screen, focus in the composer and axe clean. This repo's `tests/chat.e2e.ts` does that with Playwright.

## Extend the catalog

Adding a component or an action changes three files in `components/lede/json-render/`, and once the catalog has it,
`tsc -b` names the other two. A fourth edit, a verb for the chat's notes, is optional. This walk-through adds
Lede's Disclosure and a `flag` action, and was run on the app the recipe builds.

1. Install the component: `npx shadcn@latest add @lede/disclosure`.
2. `components/lede/json-render/catalog.ts`: the entry the model sees. Props keep the Lede component's own names.

   ```ts
   Disclosure: {
     props: z.object({ title: text, summary: text.optional() }),
     slots: ['default'],
     description: 'Detail that opens on request: a title, its takeaway as summary and the rest inside.',
   },
   ```

   and, under `actions`, `` flag: { params: z.object({ id: text }), description: `Flag an item by its id. ${inRepeat}` }, ``.
   `tsc -b` now fails in `registry.tsx`, with “Property 'Disclosure' is missing” and “Property 'flag' is missing”,
   and in `catalog-fit.ts`.
3. `components/lede/json-render/registry.tsx`: import the component and draw it, at the section's heading level, and
   add the action beside the others.

   ```tsx
   Disclosure: ({ props, children }) => (
     <Disclosure title={props.title} summary={props.summary} headingLevel={useLevels().section}>{children}</Disclosure>
   ),
   ```

   `flag: async (params) => report('flag', params),`
4. `components/lede/json-render/catalog-fit.ts`: add `Disclosure: typeof Disclosure;` to `interface Lede` (with its
   `import type`) and `Disclosure: true,` to `fit`. A prop that Disclosure doesn't take then fails here by name. A
   prop the registry renames, as Button's `label` becomes its children, goes in `interface Adapted`.
5. `src/chat/describe.ts`, optional: `flag: 'flagged'` in `DID`, so the note reads “You flagged Alan Turing.” rather
   than “You chose flag on Alan Turing.” The chat's handlers come from the catalog's action names, so `flag` already
   reaches it.

A spec then uses them: a ListRow with `"actions": [{ "label": "Flag", "event": "flag" }]` and
`"on": { "flag": { "action": "flag", "params": { "id": "m2" } } }`, or a Disclosure holding other elements. For a row
event other than archive, flag and delete, add it to `rowEvent` in the catalog too.

## Lists from state

json-render's own prompt tells a model to draw any list backed by a state array with `repeat`, and the model will. In
this catalog, `repeat` goes on a ListGroup, with one ListRow child, and `rules` in `catalog.ts`, which `prompt()` adds
to json-render's prompt, says so. `prompt()` also rewrites json-render's examples, which repeat Screen and use Card,
Select and `loadCities`, in this catalog's terms. The rules also say every control does something, since a model otherwise adds controls a spec can't act on, such as
“Sort by”. The week reply in `src/chat/replies/week.json` is one.

- Inside a repeat, `{ "$item": "title" }` in props reads the item's field, and `{ "$bindItem": "done" }` binds to it.
- In action params, `{ "$item": "id" }` is the item's state path, such as `/meetings/0/id`, which suits `setState`.
  To pass the value, write `{ "$template": "${id}" }`. The catalog's action descriptions tell the model this.
- A row drawn by repeat has its title in state, so `describe()` names it from the control that ran the action.
- `{ "$state": "/form" }` in params passes the value at that path when the action runs, after any change the same
  press made. The sign-up reply's `submit` sends its form that way.
- A list drawn with repeat fills in a row at a time as its state streams. `SpecView` draws once the root element
  arrives, and state that comes after it, as a model sends it, fills in what's drawn. `toPatches` streams in that
  order, so the tasks reply's rows arrive one by one.

## Compute and validate

A value worked out from others, such as an amount that follows the servings, comes from a function the spec calls
with `$computed`. A field is checked when an action reads it: the action doesn't run while the field fails, and focus
moves to the field. The error the person reads comes from `$cond` on the field's `error`. All of it is in `rules`, so a
model writes it too.

**Computed values.** `functions` in `components/lede/json-render/catalog.ts` holds the functions a spec may call, and
`SpecView` hands them to json-render. Each arg can be a literal, `$state` or `$item`, and a number inside text counts,
so a SegmentedControl's “6 people” is 6. Lede ships two:

- `scale`: `amount × to ÷ from`.
- `remaining`: `from − take`, never less than 0, so a refund larger than the balance reads “0”, not a negative.

Both put `unit` after the number, or `units` when the number takes a plural, so `"unit": "cup", "units": "cups"`
reads “1 cup” and “1.5 cups”. A noun added in a `$template`, as in `"${cups} cups"`, reads “1 cups”. The recipe in
`integrations/json-render/specs/recipe.json` draws its ingredients with `scale`:

```json
"servings": { "type": "SegmentedControl", "props": { "label": "Serves", "options": ["2 people", "4 people", "6 people"], "value": { "$bindState": "/servings" } }, "children": [] },
"list": { "type": "ListGroup", "props": { "title": "Ingredients" }, "repeat": { "statePath": "/ingredients", "key": "id" }, "children": ["ingredient"] },
"ingredient": {
  "type": "ListRow",
  "props": {
    "title": { "$item": "name" },
    "value": { "$computed": "scale", "args": { "amount": { "$item": "amount" }, "unit": { "$item": "unit" }, "from": { "$state": "/recipe/serves" }, "to": { "$state": "/servings" } } }
  },
  "children": []
}
```

At “6 people”, 400 g of a recipe that serves 4 reads “600 g”. To add a function, add it to `functions` and describe
its args in `rules`: json-render's prompt lists the names of the catalog's functions but not what they take. A name
that isn't in `functions` draws nothing, with one console warning.

**Checked fields.** Each field's `name` is the state path it binds. When a Button's press or a TextField's Enter runs
its actions, they run in order, and they stop at the first action whose params read a field that fails the browser's
own check. That covers a `required` field that's empty, a number outside its `min` and `max`, an email or URL that
isn't one, a required SegmentedControl with nothing chosen and a required Checkbox left unchecked. Focus moves to
that field. The actions before it still run, so the binding starts with a setState of `/tried`, and each field's
`error` shows once `/tried` is set. So a built-in action such as `pushState` holds back too, a Button needs no
`disabled` rule, and focus never falls to `<body>`. Your `submit` handler isn't called for a form that fails, so a
failed send isn't reported as sent.

A number field (`"type": "number"`) keeps a number in state, so a condition's `gt` and `lt` compare it. A
SegmentedControl takes `required` and `error`: start its value at `""` so nothing looks chosen, and its error shows
under it, linked to the group with `aria-describedby`.

The tasks reply, `src/chat/replies/tasks.json`, is the worked example. Its list fills in a row at a time as it
streams, and its form adds a task only with a name, minutes from 5 to 240 and a priority:

```json
"list": { "type": "ListGroup", "props": { "title": "To do" }, "repeat": { "statePath": "/tasks", "key": "id" }, "children": ["task"] },
"task": { "type": "ListRow", "props": { "title": { "$item": "title" }, "subtitle": { "$template": "${priority} priority" }, "value": { "$template": "${minutes} min" } }, "children": [] },
"minutes": {
  "type": "TextField",
  "props": {
    "label": "Minutes", "type": "number", "min": 5, "max": 240, "required": true, "hint": "From 5 to 240.",
    "value": { "$bindState": "/draft/minutes" },
    "error": { "$cond": { "$and": [{ "$state": "/tried" }, { "$or": [{ "$state": "/draft/minutes", "not": true }, { "$state": "/draft/minutes", "lt": 5 }, { "$state": "/draft/minutes", "gt": 240 }] }] }, "$then": "Enter minutes from 5 to 240.", "$else": "" }
  },
  "on": { "submit": "the same four actions as the Button" },
  "children": []
},
"save": {
  "type": "Button", "props": { "label": "Add task", "variant": "filled", "block": true },
  "on": { "press": [
    { "action": "setState", "params": { "statePath": "/tried", "value": true } },
    { "action": "pushState", "params": { "statePath": "/tasks", "value": { "id": "$id", "title": { "$state": "/draft/title" }, "minutes": { "$state": "/draft/minutes" }, "priority": { "$state": "/draft/priority" } } } },
    { "action": "setState", "params": { "statePath": "/draft", "value": { "title": "", "minutes": "", "priority": "" } } },
    { "action": "setState", "params": { "statePath": "/tried", "value": false } }
  ] },
  "children": []
}
```

`pushState` reads `/draft/title`, `/draft/minutes` and `/draft/priority`, so the press stops there while any of them
fails. The last two actions clear the form and hide its errors once a task is added. A check the browser can't make,
such as one date before another, belongs in your handler, which receives the values.

## Failure modes

Each one below broke this example while it was built, or was checked in the package source.

**Prompt and stream**

- `catalog.prompt()` with no options is `mode: 'standalone'`: the model writes only JSONL, with no prose. A chat needs
  `{ mode: 'inline' }`, which is `prompt()`'s default.
- json-render's prompt has no option to leave out its own examples, which use components from other catalogs.
  `prompt()` rewrites each one it knows, and `integrations/json-render/tests/specs.test.tsx` fails when a json-render
  update changes one, so the rewrite stays in step.
- Without `pipeJsonRender` on the server, the patch lines arrive as plain text and the screen never draws. The
  client reads only `data-spec` parts.
- `buildSpecFromParts` applies each patch's value in place, so a later patch such as `/state/items/0` writes into the
  array an earlier patch carried, and the next build adds the items again: a list grows on every render. json-render's
  prompt asks the model to stream arrays an item at a time, so every list a model sends hits this. Build with
  `specFromParts`, which works on copies. `tests/model-replies.test.tsx` streams 16 replies a model wrote and checks
  each list's rows appear once, render after render.
- `buildSpecFromParts` returns `null` until the first patch, and then a spec whose `root` is set before any element
  exists. Render only when `spec.elements[spec.root]` exists.
- `JSONUIProvider` takes changes to `initialState` after it mounts, key by key, so state that streams after the
  elements fills them in. A change to a key the person has since edited replaces their edit.
- `JSONUIProvider` keeps the `handlers` it mounted with. Pass handlers that don't close over changing state, such as
  ones that call a state setter with a function, or read the latest values through a ref.
- The registry also defines `actions` that report on its `actions` event target. Handlers passed to `SpecView` (or
  `JSONUIProvider`) are the ones a screen runs; the event target serves the repo's json-render page.
- `convertToModelMessages` drops data parts, so the model never sees the screens it sent, and a follow-up can't refer
  to them. `forModel` in `server/chat.ts` turns each reply's patches back into a fenced spec in its text.
- `pipeJsonRender` sends a patch line in many small pieces, down to one character per event. That's json-render's
  behavior, and the client reassembles them.
- A data part that a transport emits without an `id` is appended as a new part each time, so every patch is its own
  part. That's what `buildSpecFromParts` expects.

**Validation**

- `catalog.validate(spec)` checks the spec's shape and that each `type` is in the catalog. It doesn't parse props
  against their Zod schemas. `components/lede/json-render/check.ts` adds that pass. Run it in tests and on any spec you store.
- `Renderer` validates nothing. An unknown type draws the `fallback` prop, or nothing. A bad prop reaches the Lede
  component as it is. A component that throws is caught by a per-element error boundary and draws nothing.
- Server rendering (`renderToString`, as in a test) has no error boundaries, so a throwing component fails the
  whole render there.
- A prop bound with `{ "$bindState": "/path" }` fails a strict schema parse, because the value is an object. Make
  bound props optional before parsing, as `check.ts` does.

**Lede inside a message**

- PageHeader is a screen's h1. In a spec the registry sets `focusOnMount={false}`, or it would take focus from the
  composer as each reply mounts. Under a message's author heading, pass `headingLevel={3}` to `SpecView`: the title
  becomes an h3 and its sections h4.
- Lede's SegmentedControl names its group with a visually hidden legend, for screens where a heading beside it says
  what it picks. A model's screen often has none, so the registry also shows the label above it, hidden from
  assistive tech. Options still need to read on their own (“4 people”, not “4”).
- Lede's TextField takes no `ref`. To focus the composer, query the `textarea` inside its `<form>`.
- TextField's props are a union of input and textarea, so an inline `onChange` needs its event type written out:
  `(e: React.ChangeEvent<HTMLTextAreaElement>) => …`.
- ListRow uses `transform` for its swipe, which gives each row a stacking context. A `position: sticky` composer
  needs `z-index: var(--z-tabbar)`, or rows scroll over it. Let the document scroll: a scroll container of the
  conversation's own clips a tall screen inside a message.
- Scrolling to the bottom on every chunk pushes the question out of view while a long reply streams. Follow the
  reply until the question's turn reaches the top, and stop following when the person scrolls (`src/chat/Chat.tsx`).
- A control that unmounts while focused, such as Stop when the reply ends, Try again when the retry starts or a row
  that an action hides, drops focus to `<body>`. Move focus to the composer before the call that removes it, or to the
  next row.
- Every grid track that holds a screen needs `minmax(0, 1fr)`. An implicit `auto` track grows to the screen's
  min-content, and at 200% text on a phone the page then scrolls sideways.
- A `position: sticky` composer with large text on a short screen can leave the conversation a few pixels tall. Make
  it sticky only in a height query in `em`, which follows the text size.
- A sticky composer covers the controls under it. Set the page's `scroll-padding-bottom` to its height, so a control
  reached with Tab scrolls into view above it. `Chat.tsx` measures it with a ResizeObserver.
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
- create-vite's `src/index.css` centers every line in a bordered 1126px `#root` and sets `:root` to 18px, which
  rescales every rem in Lede. The build and axe pass with it; only a screenshot shows it. Replace the file before
  `shadcn init`, which merges into whatever `:root` it finds.
- `shadcn init` leaves `src/index.css` without a final newline, so `echo '@import …' >>` glues the import onto the last
  rule. Start the appended text with a newline.
- The server listens on `PORT`, default 4882; the Vite proxy has to name the same port.
- A full-page screenshot draws the sticky composer where the window ended, over the middle of the page. Take
  viewport screenshots.
- `toUIMessageStream()` sends a generic “An error occurred.” to the client unless you pass `onError`. The example
  returns the error's message, which helps while you build; return something generic in production, since a
  provider's message can name your account or model. `streamText` logs each failure with its stack and response
  headers unless it has an `onError` of its own; the example logs one line.
