# Docs benchmark

This measures how well an agent builds with Lede when its docs are the only thing it has. A fresh Claude Code agent gets
a new Vite app and one task, [task.md](task.md): build an inbox screen with Lede, starting from `llms.txt`. The harness
records what the agent read and did, then builds the app and checks it itself. Run it before and after a change to
`scripts/llms/`, a reference page or the docs, and compare the two rows in [results.md](results.md).

It costs money each time it runs, so it isn't part of `npm test` or CI.

## Run it

```bash
npm run build                                   # the benchmark serves this build's dist/ to the agent
node benchmarks/docs-agent/run.mjs --label "before"
# change the docs, then
npm run build
node benchmarks/docs-agent/run.mjs --label "after"
```

| Option | Default | What it does |
| --- | --- | --- |
| `--model` | `claude-fable-5-2` | The model the agent runs on |
| `--effort` | Claude Code's default, `medium` in 2.1.326 | `low` to `max`. A Stop hook records the effort Claude Code applied, which the row shows |
| `--runs` | `1` | Runs in the batch. Use 3 or more for a number you'll quote: one run shows that the harness works, not a result |
| `--budget` | `8` | US dollars each run may spend before Claude Code stops it |
| `--minutes` | `30` | Time each run may take before the harness stops it |
| `--label` | none | A name for the batch, shown in its row |
| `--no-record` | off | Leaves `results.md` alone |

It needs Node 22.12 or later, the `claude` command line tool, Playwright's Chromium (`npx playwright install
chromium`, or `PW_CHROMIUM=/path/to/chrome`) and access to the npm registry. Claude Code needs to sign in without your
own settings, so set `ANTHROPIC_API_KEY`, which also turns on `--bare`. In a Claude Code cloud session the session's own
credentials work. The install steps also reach `ui.shadcn.com`, for `shadcn init`; where a sandbox blocks it, the agent
works around it, and the run's numbers include that.

The first run makes the starting app in `.cache/` with a pinned `create-vite`, and later runs copy it. Each run's
transcript, a copy of the app the agent wrote, a screenshot and `metrics.json` go to `runs/`, which git ignores. The
batch's medians go into `results.md` as one row.

## What it measures

Each number in a row is the median of the batch's clean runs.

| Column | What it counts |
| --- | --- |
| Tool calls | Every tool call the agent made |
| Docs files, Docs KB | The distinct docs pages fetched from the docs server, and the bytes sent, counting a page fetched twice twice. Registry files under `/r/`, which shadcn fetches to install items, are listed in `metrics.json` but not counted here |
| Docs 404s | Distinct paths the agent asked the docs server for that don't exist, which usually means a guessed URL |
| Text read KB | Every tool result the agent read: docs, files, command output |
| Output tokens, Cost USD, Minutes | From Claude Code's own result |
| Builds | Runs whose `npm run build` passed when the harness ran it after the agent stopped |
| Lede imports | Distinct `@/components/lede/…` modules the app's own code imports |
| Axe violations | WCAG 2.1 A and AA rules that fail on the built app's first screen, at 1280 by 800 |

`metrics.json` has more: tool calls by name, each docs file fetched, the 404s, URLs the agent fetched from anywhere else,
how many lines of its own code the app has, the build's output and each axe rule that failed.

## How it stays fair

- **One task, in the repository.** The prompt is `task.md`, word for word. It names `llms.txt` and nothing else.
- **The docs under test, and only those.** The harness serves this checkout's `dist/` on a local port. The build's
  links name `https://lede.cloudcompute.com`, so text files are served with that origin replaced by the local one,
  and the release registry URL `/r/vX.Y.Z/{name}.json` is served from the build's `r/`. Nothing else in a file
  changes. Build first: the harness can't tell which commit `dist/` came from, so a stale build measures old docs.
- **A fresh agent.** Each run gets its own empty Claude Code config folder, no settings files, no MCP servers, no
  skills or slash commands, and no CLAUDE.md, memory or web tools. Its tools are Bash, Read, Write, Edit, Glob and
  Grep.
- **A fresh app outside the repository.** Each run starts from the same `create-vite` react-ts app, in a temporary
  folder outside this checkout.
- **Contamination is checked, not assumed.** A run is marked contaminated and left out of the medians when its tool
  calls name this checkout's path, which Bash could read, or when Claude Code reports handing it any memory, skill or
  MCP server. The first trial run inside a Claude Code session did get the parent session's team memory, through
  environment variables the harness now removes; this check is what caught it. URLs the agent fetches from anywhere other than the docs
  server and npm are listed in its `metrics.json`. The docs link to a few files on GitHub, so those can show up there.
- **The harness checks the result.** It runs `npm run build`, serves the app and runs axe itself, after the agent has
  stopped. The agent's own claims count for nothing.
- **Each row says what it ran on.** The date, docs commit, model, effort and Claude Code version go into the row.
  Models and Claude Code change, so compare rows from the same day and setup.

## Not measured yet

- Whether the screen does what the task asks: that choosing a message shows it beside the list. The screenshot is
  there to look at; a scripted check of the behaviour is the next step.
- An agent using a Lede screen, rather than building one, through browser tools.
- Models other than Fable. `--model` takes any model Claude Code can run.
