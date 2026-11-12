# json-render and shadcn in an AI SDK chat, without Lede

The chat from [`../json-render-chat`](../json-render-chat/) with Lede taken out, so the two can be compared side by
side. It has the same conversation layout, transports, hardened server, scripted replies and follow-ups that carry
each screen's state. json-render draws the screens from
[`@json-render/shadcn`](https://www.npmjs.com/package/@json-render/shadcn), the shadcn/ui components json-render
publishes for its own renderer. Nothing here imports from `registry/` or reads Lede's tokens.

```bash
npm install
npm run dev     # http://localhost:4870, with the scripted replies
npm run build   # typecheck (app, server and tests), then the site
npm test        # the mock and the server in Vitest, then the chat in a browser with Playwright and axe
```

Try “how’s my week”, “show my tasks”, “show my notification settings”, “what’s in my inbox”, “help me sign up”,
“any projects”, “fail” or “offline”, the same prompts the Lede entry answers.

## Side by side

Measured on Nov 7, 2026, with json-render 0.22.0 in both. The Lede column is the `@lede/json-render` registry item and
the Lede chat; the plain column is this entry.

| | Lede | Plain |
| --- | --- | --- |
| Catalog | 12 components, 52 props | 13 components, 53 props (36 and 119 with the whole package) |
| The server's system prompt | 24,680 characters, 6,215 tokens | 20,930 characters, 5,308 tokens (24,494 and 6,224 with the whole package) |
| Code between json-render and the screens | 787 lines: catalog, registry, `SpecView`, patches, check and `catalog-fit` | 133 lines: catalog, registry, patches and check. The chat page carries the screen-state glue `SpecView` holds in Lede: `Chat.tsx` is 302 lines here and 268 there |
| Theme CSS in the app | none: it imports Lede's generated tokens | 79 lines: shadcn's neutral theme as `npx shadcn init` writes it, trimmed to the variables these components read |
| JS and CSS, `gzip -9` of `dist/assets` | 194 kB and 16 kB | 219 kB and 11 kB |
| axe violations, each of six replies and all six in one conversation, light and dark | 0 | 0 |
| Checked by hand, all six replies in one conversation | no duplicate `id`s, 7 of 7 groups named, 7 section headings, 4 lists, an error tied to its field | `id="email"` twice, 0 of 4 groups named, no section headings, no lists, errors tied to nothing |
| Dark mode | light and dark, each with a high-contrast theme under `prefers-contrast: more` | light and dark |
| Lede item fixes the plain variant rebuilds by hand | | 1 of 11, below |

Tokens are counted with `o200k_base` from `gpt-tokenizer`, OpenAI's tokenizer, as a stand-in: Claude's own count needs
an API key. Most of each prompt is json-render's own instructions. The Lede prompt is the longer one because it adds
twelve rules for the model and rewrites json-render's examples in its own components.

`@json-render/shadcn` ships all 36 components in one module, so the bundle carries the ones this catalog leaves out,
with Radix, Vaul, Embla and Lucide behind them.

## What the Lede item fixes, and what this entry does instead

The `@lede/json-render` item holds eleven fixes between json-render and a chat's screens. This entry rebuilds the one it
can't work without and goes without the other ten, each checked in the browser here.

| Fix in the Lede item | Here |
| --- | --- |
| A list streamed an item at a time draws each item once. `buildSpecFromParts` writes each patch into the value an earlier patch carried, so a second build from the same parts adds the items again. | Rebuilt in `src/screens/patches.ts`: `specFromParts` builds from copies. With json-render's own function the tasks list doubles on screen, and `tests/mock-transport.test.ts` and `tests/chat.e2e.ts` both fail. |
| What the person changes in a screen survives the rest of the stream. | Text typed in the task field while the reply streams is gone when the draft's state arrives. |
| Focus moves to a neighbor when the control that held it leaves, such as a row an action hides. | Archive hides its row, and focus falls to `<body>`. |
| An item opens in place: its title takes focus, Back or Escape returns focus to the row that opened it, and a row shows a chevron only when it opens something. | The specs open items in place the same way, with a Back button in each detail. Opening one and going back each leave focus on `<body>`, Escape does nothing, and a row that opens an item looks like any other button. |
| An action doesn't run while a field it reads fails its check, and focus moves to that field. | json-render's `validateForm` sets the errors and lets the next action run: Create account adds its note with both fields empty, and Add task adds an empty task. A spec can hold one button back by hand, with `$cond` on its `disabled` reading a field's value, but not on a field's check; the Lede item holds back every action that reads a failing field. |
| A field's error is tied to it with `aria-describedby` and `aria-invalid`, and goes when the field passes. | The error shows under the field with nothing tying the two, so a screen reader moving through the form doesn't hear it. |
| The host sets the spec's heading level, and sections sit one below. | The model picks each Heading's level. A Card's title is a `<div>`, so the 7 section headings Lede draws across the six replies, such as Delivery, To do and No projects yet, are absent from the outline. |
| A number field takes decimals and keeps a number in state. | The Input keeps text, and json-render's `min` and `max` checks compare numbers, so they fail for every value. The tasks reply uses `numeric` in their place. |
| A required checkbox fails until it's checked, and its long label wraps beside the box. | json-render's `required` check passes `false`, so “I agree to the terms” never holds anything back. |
| A choice of options shows its label and names its group. | ToggleGroup takes no label, and Radio's label doesn't name its group: 4 unnamed groups. |
| The prompt shows json-render's examples in the catalog's own components, with rules for the model. | The prompt is json-render's own, with examples drawn from other catalogs, such as Select and `loadCities`. |

The fields here take their `id` from `name`, so two fields that share a `name` share an `id`. Ask for settings and then
for sign-up, and both the Email alerts switch and the Email field get `id="email"`: the field's label then names the switch, and the field is announced by its
placeholder. axe lists this among the results it leaves for a person to review, so the axe row reads 0 for both.

## What each catalog can express

The Lede catalog names what a screen is made of: a `PageHeader` with its takeaway, a `ListGroup` of `ListRow`s with a
subtitle, a value, a switch and row actions that also work by swipe, a `FormSection` whose legend names its fields, a
`SegmentedControl` with a label, an `EmptyState` and a `SummaryCard` with a figure and a status.

The shadcn catalog names how a screen is laid out: `Stack`, `Card`, `Heading` and `Text`, with form fields, a `Badge`,
a `ToggleGroup` and a `Radio`. A model can build the same six screens from them, and it can reach any Tailwind class
through `className`, though only classes the build already holds take effect. Against these screens the whole package
can't express a switch with a subtitle or row actions under a swipe. This entry's 13 leave out `DropdownMenu`, for row
actions in a menu, and `Table`, for a list a screen reader counts.

## Why `@json-render/shadcn`

json-render publishes it beside its React renderer, with a ready catalog definition for each component, and its README
shows the path this entry takes: pick the components you need from both halves and pass them to `defineCatalog` and
`defineRegistry`. A developer starting from json-render's docs lands here before writing components of their own, and
shadcn/ui is the default component kit for a React and Tailwind app. The chat page around the screens is semantic
HTML on shadcn's theme variables, and keeps the Lede chat's behavior: headings, the live status line, focus, Enter,
Escape and Stop, following a reply as it streams and room above the sticky composer.

## Run it against a real model

```bash
ANTHROPIC_API_KEY=… npm run server              # POST /api/chat on port 4872, or PORT
VITE_CHAT_API=/api/chat npm run dev             # the app; Vite proxies /api to the server
```

`server/chat.ts` is the Lede entry's with this catalog's prompt: the same refusals, length caps, one log line per
failed call and earlier screens sent back to the model with what the person left in them.

## Files

| File | What it is |
| --- | --- |
| `src/chat/` | The chat page, transports, scripted replies and action notes, matched to the Lede entry's. |
| `src/screens/` | The catalog and registry from `@json-render/shadcn`, `specFromParts` and `toPatches`, and the prop check the tests use. |
| `server/chat.ts` | The reference backend. |
| `tests/mock-transport.test.ts`, `describe.test.ts`, `server.test.ts` | The Lede entry's tests of the mock, the action notes and the server, on this catalog. |
| `tests/specs.test.tsx` | Each scripted screen draws with this registry and passes this catalog, and the check rejects a prop the catalog lacks and a value outside its schema. |
| `tests/chat.e2e.ts` | The chat-level tests from the Lede entry: order, notes, Stop, Escape, Try again, focus, the composer's room, a list that streams in once, following a reply and axe. |
| `tests/real.e2e.ts`, `fake-anthropic.ts` and `fake-replies/` | The AI SDK's own transport against the server and a fake Anthropic: a reply that draws, a dropped connection, a malformed body, a follow-up that carries a screen's state and a reply that only patches an earlier screen. |

The Lede entry's tests of what its screens do, and its 16 replies a real model wrote, have no match here. The fixes
above say what each would find.
