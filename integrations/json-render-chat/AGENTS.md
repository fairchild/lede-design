# Building a json-render + Lede chat: a guide for coding agents

This is the recipe for adding a chat to a React app where the assistant's replies hold screens built from Lede
components, using the AI SDK and json-render. `README.md` explains the example. This file lists the steps in order
and the mistakes that break the build or the page. Every name below was checked against `ai@7.0.164`,
`@ai-sdk/react@4.0.168` and `@json-render/*@0.22.0`. Read those packages' `.d.ts` files before trusting a name from
memory.

This example opens on a guide, in `src/guide/`, that draws `README.md`'s sections beside the chat. It isn't part of
the recipe: copy `src/chat/` and `server/` only.

## Which Vercel package

Use the AI SDK: `useChat` from `@ai-sdk/react`, with a `ChatTransport` from `ai`. Vercel's “Chat SDK” (npm `chat`) is
for bots on Slack, Teams and Discord, so it doesn't belong in a browser chat.

## Recipe

1. Follow “Build this in your app” in `README.md` step by step. It was run on a fresh create-vite `react-ts` app,
   installing from this repo's registry served locally (`npm run registry`), and `npm run build` passed.
   `npx shadcn@latest add @lede/theme-provider @lede/avatar @lede/json-render --yes` installs the catalog, the registry,
   `prompt`, `catalog-fit`, `check`, `toPatches` and `SpecView` under `components/lede/json-render/`, with the Lede
   components and npm packages they need, and the Avatar the chat page draws. The chat's own files, copied from
   `src/chat/` and `server/`, import them from `@/components/lede/…`, so they need no edits. In a create-vite app, first
   replace `src/index.css` with `@import "tailwindcss";`: its demo styles center every line in a bordered 1126px column
   and set `:root` to 18px, which rescales Lede. Then end it with `@import "./styles/lede/index.css";`. Without that
   import the screens draw unstyled with no build error; `SpecView` warns in the console in development.
2. The registry URL is `https://lede.cloudcompute.com/r/v0.5.0/{name}.json`. Before v0.5.0 is tagged, use `/r/next/`
   in place of `/r/v0.5.0/`: the unreleased build of main. `shadcn init --defaults` also picks a style and may add a
   font, `tw-animate-css`, `src/components/ui/button.tsx` and `src/lib/utils.ts`; the chat uses none of them. From a clone,
   `npm run registry` writes the same files to `public/r/`, which any static server can serve.
3. To change what a model may build, follow “Extend the catalog” below.
4. The server is `server/chat.ts`. It refuses a body that isn't `application/json` (415), is over 1 MB (413) or
   fails `safeValidateUIMessages` (400), and keeps only the parts the model reads: what the person typed, and the
   replies' text and screens. Then `streamText({ model: anthropic('claude-sonnet-5-5'), system,
   messages: await convertToModelMessages(forModel(messages, screens)), maxOutputTokens })`, where `system` is the catalog's `prompt()` in `src/chat/system.ts`, merged into
   `createUIMessageStream`, so a connection that drops partway through becomes an error the client shows, and piped
   through `pipeJsonRender`. It exports `handleChat(request)`, a fetch-style handler for any framework's route, and
   runs on its own under `tsx --tsconfig tsconfig.server.json server/chat.ts`, where `pipeline` ends a response that
   fails without stopping the server. The key is `ANTHROPIC_API_KEY` in the server's environment.
   The `screens` the client sends are the person's input, written into each earlier screen in the assistant's turn,
   which a model trusts more than the user's; send them as a user part instead if the model should treat them as such.
   `tests/real.e2e.ts` drives this path with the AI SDK's `DefaultChatTransport` against a fake Anthropic.
5. The client picks its transport in `src/chat/transport.ts`: the scripted mock by default, or
   `new DefaultChatTransport({ api })` when `VITE_CHAT_API` is set. Type the chat as
   `useChat<AppMessage>`, where `AppMessage` is `UIMessage<unknown, { [SPEC_DATA_PART]: SpecDataPart }>`.
6. In each assistant message, render its text parts first, then
   `<SpecView spec={specFromParts(message.parts)} streaming={live} headingLevel={3} handlers={…} onStateChange={…} />`,
   with `specFromParts` from `components/lede/json-render/patches`, memoized on `message.parts`. Keep each screen's
   state from `onStateChange` by message id and send it as `screens` with the next message
   (`sendMessage({ text }, { body: { screens } })`), so the model sees what the person entered. `onActionHeld` reports
   an action that a failing field held back, with the action and each field's name and message.
7. Check it: `npm run build`, then the page in a browser with a reply showing: the question, the reply's text and then
   its screen, focus in the composer and axe clean. A screen's rows can arrive seconds after its text, so wait for the
   last row, such as “Book the caterer” in “show my tasks”, before you judge it. A fresh app has no browser runner:
   look by hand, or add Playwright and `@axe-core/playwright`, as this repo's `tests/chat.e2e.ts` does. That file
   isn't copied.

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
5. `src/chat/describe.ts`, optional: `flag: 'flagged'` in `DID`, so the note reads “You flagged Alan Turing.” The
   chat's handlers come from the catalog's action names, so `flag` already reaches it.

A spec then uses them: a ListRow with `"actions": [{ "label": "Flag", "event": "flag" }]` and
`"on": { "flag": { "action": "flag", "params": { "id": "m2" } } }`, or a Disclosure holding other elements.

A row action of your own, such as “Mark paid” on each bill, takes one more edit: its event goes in `rowEvent` in the
catalog, which lists the events a ListRow may emit (`z.enum(['archive', 'flag', 'delete', 'pay'])`). Add a `pay`
action as `flag` was added above, and `pay: 'paid'` in `DID` if you keep the notes. A row drawn by repeat then marks
its own item and tells your app which bill:

```json
"bill": {
  "type": "ListRow",
  "props": { "title": { "$item": "name" }, "value": { "$cond": { "$item": "paid" }, "$then": "Paid", "$else": "Due" }, "actions": [{ "label": "Mark paid", "event": "pay" }] },
  "on": { "pay": [
    { "action": "setState", "params": { "statePath": { "$item": "paid" }, "value": true } },
    { "action": "pay", "params": { "id": { "$template": "${id}" } } }
  ] },
  "children": []
}
```

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

## json-render features you'll use

json-render's own prompt teaches the model each of these, and `rules` adds what's specific to this catalog.

- **Show or hide an element:** `visible` sits on the element, beside `type`, not in its props.
  `"visible": { "$state": "/saved" }` shows a confirmation once a press sets `/saved`.
- **Open an item in place:** Screen's children are Views, a list View with `"visible": { "$state": "/open", "not": true }`
  and a detail View per item with `"visible": { "$state": "/open", "eq": "m1" }`. The row's press sets `/open` with
  `setState`, and the detail's PageHeader takes `"back": { "label": "Inbox" }` and binds `back` to set `/open` to `""`.
  `"not": true` keeps the list showing while the state is still on its way. For rows from a state array, one detail
  View with `repeat` on the array and `"visible": [{ "$state": "/open" }, { "$item": "id", "eq": { "$state": "/open" } }]`
  draws the open item, as `src/chat/replies/week.json` does. A row with nothing to open has no press, so no chevron.
- **Text that depends on state:** `$cond` picks between two values. Inside a repeat it reads the item:
  `"value": { "$cond": { "$item": "paid" }, "$then": "Paid", "$else": "Due" }`.
- **State in text:** `$template` reads a path anywhere, `"${/booked/start}"`, and an item's field in a repeat,
  `"${name}"`.
- **A whole list as an arg:** `{ "$state": "/bills" }` passes the array, so a function such as `sum` can read every
  item: `{ "$computed": "sum", "args": { "items": { "$state": "/bills" }, "field": "amount", "unless": "paid" } }`.
- **A date:** a TextField with `"type": "date"` draws the browser's date picker and keeps `YYYY-MM-DD` in state.
- **What the person entered, on the next turn:** the client sends each screen's state as `screens` in the request
  body (`sendMessage({ text }, { body: { screens } })`). `server/chat.ts` reads `body.screens` and `forModel` writes it
  into each earlier screen. A transport of your own, such as the mock, finds the same object as `body` in
  `sendMessages`' options.

## Compute and validate

A value worked out from others, such as an amount that follows the servings, comes from a function the spec calls
with `$computed`. A field is checked when an action reads it: the action doesn't run while the field fails, the field
shows its `error` and focus moves to it. All of it is in `rules`, so a model writes it too.

**Computed values.** `functions` in `components/lede/json-render/catalog.ts` holds the functions a spec may call, and
`SpecView` hands them to json-render. Each arg can be a literal, `$state` or `$item`, and a number inside text counts,
so a SegmentedControl's “6 people” is 6. Lede ships three:

- `scale`: `amount × to ÷ from`.
- `remaining`: `from − take`, never less than 0, so a refund larger than the balance leaves “0”.
- `sum`: `field` added up across `items`, a state array, keeping only the items whose `where` field is set and whose
  `unless` field isn't, never less than 0. Without `field` it adds the items themselves.

Each puts `unit` after the number, or `units` when the number takes a plural, so `"unit": "cup", "units": "cups"`
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
own check. That covers a `required` field that's empty, a number outside its `min` and `max` or off its `step`, a
value that misses its `pattern` or falls short of its `minLength`, an email or URL that isn't one, a required SegmentedControl with nothing chosen and a required Checkbox left unchecked. Each field that
action reads and that fails shows its `error`, and focus moves to the first. The error is plain text: it stays hidden
until a check holds an action back, and goes as soon as the person's input makes the field pass. A field with no
`error` shows the browser's own message. So a built-in action such as `pushState` holds back too, a Button needs no
`disabled` rule, and focus never falls to `<body>`. Your `submit` handler isn't called for a form that fails, so a
failed send isn't reported as sent. Keep `$cond` for text that depends on state, such as a row whose value reads “On”
or “Off”.

A number field (`"type": "number"`) keeps a number in state, so a condition's `gt` and `lt` compare it. It takes
any decimal, such as 7.5 hours, unless the spec sets `step`, such as 1 for whole numbers. An error names only what the
field checks: an error that asks for a 5-digit ZIP code needs `"pattern": "[0-9]{5}"` beside it, or “973” goes through. A
SegmentedControl takes `required` and `error`: start its value at `""` so nothing looks chosen. Its error shows under
it, linked to the group with `aria-describedby`.

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
    "error": "Enter minutes from 5 to 240."
  },
  "on": { "submit": "the same two actions as the Button" },
  "children": []
},
"save": {
  "type": "Button", "props": { "label": "Add task", "variant": "filled", "block": true },
  "on": { "press": [
    { "action": "pushState", "params": { "statePath": "/tasks", "value": { "id": "$id", "title": { "$state": "/draft/title" }, "minutes": { "$state": "/draft/minutes" }, "priority": { "$state": "/draft/priority" } } } },
    { "action": "setState", "params": { "statePath": "/draft", "value": { "title": "", "minutes": "", "priority": "" } } }
  ] },
  "children": []
}
```

`pushState` reads `/draft/title`, `/draft/minutes` and `/draft/priority`, so the press stops there while any of them
fails, and each of those that fails shows its error. The last action clears the form once a task is added; an emptied
field shows no error until the next press. A check the browser can't make, such as one date before another, belongs in
your handler, which receives the values.

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
- `JSONUIProvider` takes changes to `initialState` after it mounts, key by key, and an array counts as changed on
  every build, so a value the person typed or pressed while the reply streamed is overwritten by state that arrives
  after it. `SpecView` keeps a store of its own instead: state that streams in fills in the screen, and a value the
  person changes stays theirs. So a person can use a screen while the rest of it arrives.
- A change the person makes inside a list, such as switching a row on, is kept by its index, `/todo/0/done`. Rows
  that stream in after it still arrive, with the change written back on top. A stream that reorders rows or inserts
  one above it moves the change to whatever row then holds that index. Stream a list's rows by appending, in their
  final order, and never reorder or insert rows mid-stream.
- `JSONUIProvider` keeps the `handlers` it mounted with. Pass handlers that don't close over changing state, such as
  ones that call a state setter with a function, or read the latest values through a ref.
- The registry also defines `actions` that report on its `actions` event target. Handlers passed to `SpecView` (or
  `JSONUIProvider`) are the ones a screen runs; the event target serves the repo's json-render page.
- `convertToModelMessages` drops data parts, so the model never sees the screens it sent, and a follow-up can't refer
  to them. `forModel` in `server/chat.ts` turns each reply's patches back into a fenced spec in its text, with the
  state the person left in that screen, which the client sends as `screens`.
- A model asked to change an earlier screen can reply with patches to it alone. They draw nothing, since each reply
  builds its own spec. `rules` asks for a whole screen each time, carrying over what the person entered, and the chat
  shows “The reply’s screen couldn’t be drawn.” with Try again for a reply whose screen can't draw, or one with
  nothing in it.
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
  assistive tech. Options still need to read on their own, such as “4 people”.
- Lede's TextField takes no `ref`. To focus the composer, query the `textarea` inside its `<form>`.
- TextField's props are a union of input and textarea, so an inline `onChange` needs its event type written out:
  `(e: React.ChangeEvent<HTMLTextAreaElement>) => …`.
- ListRow uses `transform` for its swipe, which gives each row a stacking context. A `position: sticky` composer
  needs `z-index: var(--z-tabbar)`, or rows scroll over it. Let the document scroll: a scroll container of the
  conversation's own clips a tall screen inside a message.
- Scrolling to the bottom on every chunk pushes the question out of view while a long reply streams. Follow the
  reply until the question's turn reaches the top, and stop following when the person scrolls (`src/chat/Chat.tsx`).
- A control that unmounts while focused drops focus to `<body>`. Inside a screen, `SpecView` moves it on: to the
  control that took its place, such as Start over when Check answers hides, then to the control beside it, such as
  the next row when an action hides one, then to the screen's title. When an action hides a ListGroup's last row,
  ListRow moves focus to the group's heading itself. Outside a screen, such as Stop when the reply ends or Try again
  when the retry starts, move focus to the composer before the call that removes it.
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
  `shadcn init`, which merges into whatever `:root` it finds (recipe step 1).
- `shadcn init` leaves `src/index.css` without a final newline, so `echo '@import …' >>` glues the import onto the last
  rule. Start the appended text with a newline.
- The server listens on `PORT`, default 4882; the Vite proxy has to name the same port.
- A full-page screenshot draws the sticky composer where the window ended, over the middle of the page. Take
  viewport screenshots.
- A provider's error message can name your account or key, so the server sends the browser “The assistant
  couldn’t answer.” and logs the message in one line. Set `CHAT_DEBUG=1` to show the provider's message in the
  status line while you build. `streamText` logs each failure with its stack and response headers unless it has an
  `onError` of its own.
- An upstream connection that drops partway through a reply errors the response's body stream; the AI SDK doesn't
  turn it into an error part. Merging the reply into `createUIMessageStream` does, and `pipeline` in the Node wrapper
  ends the response when the body fails. With `.pipe()` and no error listener, Node exits on the first drop.
- `@json-render/core` and `@json-render/react` are pinned at exactly 0.22.0, here, in the root and in the registry
  item. `prompt()`'s rewrites and `specFromParts` depend on that version's text and behavior. To upgrade, bump all
  of them together and run `integrations/json-render`'s tests, whose prompt test fails on each rewrite that no longer
  finds its text.
