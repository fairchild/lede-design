# Integrations

Each folder here shows Lede working beside another project, such as a generative-UI renderer. An entry is a small app
of its own, with its own `package.json` and lockfile, and it reads Lede's source from `registry/` so it tracks main.

`json-render-chat-plain/` is the exception: it reads nothing from Lede, so the chat can be compared with and without
it.

Nothing in `registry/` or `src/` imports from here, and the published registry doesn't include it. CI builds and tests
each entry on every pull request.

- [`json-render/`](json-render/): Lede drawn by [json-render](https://github.com/vercel-labs/json-render) from
  recorded JSON specs.
- [`json-render-chat/`](json-render-chat/): the same catalog in a chat built on the AI SDK's `useChat`, with a
  scripted mock transport and a reference server.
- [`json-render-chat-plain/`](json-render-chat-plain/): the same chat with json-render's shadcn components in place of
  Lede, and a measured comparison of the two.
