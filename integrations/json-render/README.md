# Lede and json-render

This app draws Lede components from JSON specs with [json-render](https://github.com/vercel-labs/json-render)
(Apache-2.0). A model writes a spec from a catalog of components, and json-render's `Renderer` turns each element into
the Lede component the registry maps it to. The specs here were recorded, so the page needs no network or API key.

```bash
npm install
npm run dev     # http://localhost:4890
npm run build   # tokens, typecheck, then the site
npm test        # renders each recorded spec and checks it
```

## What's in it

The catalog, the registry, `check` and `SpecView` are Lede's `json-render` registry item, in
`registry/lede/json-render/`. This app imports them from `@/components/lede/json-render/…`, the path an install of
`@lede/json-render` gives them.

- `catalog.ts` is the catalog: each Lede component with a Zod schema for its props and a description of when to
  use it. Props keep the component's own names and values. `prompt()` turns it into a model's instructions, with
  json-render's examples rewritten in this catalog's terms and Lede's `rules`, and the page shows that text under
  "The prompt".
- `registry.tsx` maps each type to its Lede component. Callback props become json-render events through `emit`,
  so a spec binds them to actions in its `on` field. TextField, Switch, Checkbox, SegmentedControl and a ListRow with
  `checked` bind their value with `$bindState`, and the inbox spec archives a row with the built-in `setState` action
  and a `visible` condition. A page that uses `JSONUIProvider` itself, as this one does, wraps `Renderer` in
  `FieldChecks`, so a field shows its error when a check holds an action back; `SpecView` does that for you.
- `specs/*.json` are the recorded specs: settings, an inbox, a sign-up form whose fields show their errors when Create account finds them failing, a recipe whose amounts
  follow its servings through `$computed`, an empty state and an invalid spec. "Replay as a stream" sends the selected spec through `createSpecStreamCompiler` as JSON Patch lines,
  each split across two chunks, so the screen builds up as a model would write it.
- `catalog-fit.ts` fails `tsc` when a catalog prop isn't one the Lede component takes, or allows a value the
  component's type doesn't. `tests/specs.test.tsx` renders each recorded spec and fails on a type the registry has no
  component for, or a prop its schema rejects.

## What json-render checks

As of 0.22.0, `catalog.validate(spec)` checks the spec's shape and that each element's `type` is in the catalog.
`validateSpec(spec)` checks its structure, such as a child that doesn't exist. Neither parses an element's props
against its schema, so `check.ts` adds that pass, strictly, with props bound to expressions made optional.

`Renderer` validates nothing as it draws. The invalid spec shows what happens to each kind of mistake:

- A type the registry doesn't have draws the `fallback` component if one is passed. Without one, json-render logs a
  warning and draws nothing there.
- A prop its schema rejects reaches the component as it is. Button gets `variant="huge"` and draws with no variant
  style.
- A component that throws, here SegmentedControl given a number for `options`, is caught by json-render's error
  boundary for that element. It logs the error and draws nothing there, and the rest of the screen renders.
- A child that doesn't exist logs a warning and draws nothing.

## How it uses Lede

The app imports Lede from this repo's `registry/lede` through the `@/components/lede` alias in `vite.config.ts` and
`tsconfig.json`, the same path a shadcn install uses, so it always matches main. Lede's own imports resolve from this
app's `node_modules`. `npm run tokens` writes the tokens CSS the styles import.

Outside this repo, install the item from the hosted registry and keep the imports as they are. It brings the Lede
components it draws and the npm packages it needs:

```bash
npx shadcn@latest registry add '@lede=https://lede.cloudcompute.com/r/v0.5.0/{name}.json'
npx shadcn@latest add @lede/theme-provider @lede/json-render
```

The item first ships in Lede 0.5.0. Until v0.5.0 is tagged, use `/r/next/{name}.json` on the same site, the unreleased
build of main.

Then import `./styles/lede/index.css` once in your global CSS, as the main README's step 2 shows. For a chat whose
replies hold these screens, see [`../json-render-chat`](../json-render-chat).
