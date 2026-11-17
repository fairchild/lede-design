# Docs benchmark

This measures how well an agent builds with Lede when its docs are the only thing it has. For each task in
[`tasks/`](tasks/), a fresh Claude Code agent gets a new Vite app, the task's data and the task's prompt, which names
only `llms.txt`. The harness records what the agent read and did. It then builds the app itself, runs the scripted
checks, and asks a blind grader for a second opinion. Run it before and after a change to `scripts/llms/`, a reference
page or the docs, and compare the rows in [results.md](results.md).

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
| `--task` | `all` | One task's folder name, or every task |
| `--model` | `claude-haiku-5-5` | The model the agent runs on. See [Which model](#which-model) |
| `--effort` | Claude Code's default, `medium` in 2.1.326 | `low` to `max`. A Stop hook records the effort Claude Code applied, which the row shows |
| `--runs` | `3` | Runs of each task. One run shows that the harness works, not a result |
| `--budget` | `8` | US dollars each run may spend before Claude Code stops it |
| `--minutes` | `30` | Time each run may take before the harness stops it |
| `--docs` | `dist/` | The built site to serve, such as another checkout's `dist/` |
| `--label` | none | A name for the batch, shown in its rows |
| `--no-grade` | off | Skips the grader |
| `--no-record` | off | Leaves `results.md` alone |

It needs Node 22.12 or later, the `claude` command line tool, Playwright's Chromium (`npx playwright install
chromium`, or `PW_CHROMIUM=/path/to/chrome`) and access to the npm registry. Claude Code needs to sign in without your
own settings, so set `ANTHROPIC_API_KEY`, which also turns on `--bare`. In a Claude Code cloud session the session's own
credentials work. The install steps also reach `ui.shadcn.com`, for `shadcn init`. Where a sandbox blocks it, the agent
works around it, and the run's numbers include that.

The first run makes the starting app in `.cache/` with a pinned `create-vite`, and later runs copy it. Each run's
transcript, a copy of the app the agent wrote, its screenshots and `metrics.json` go to `runs/`, which git ignores.
Each task's medians go into `results.md` as one row, and the console lists the checks that failed, most often first.

## The tasks

| Task | What it asks for | What it exercises |
| --- | --- | --- |
| `inbox` | A list of messages that opens one beside it, or on its own on a phone | A hero flow, or MasterDetail and List |
| `preferences` | Name and email fields, three switches, a theme choice and Save | Form controls, labels, a confirmation |
| `servers` | A table of 40 servers with search and a sortable Name column | DataTable, or Table and SearchField |
| `status` | Counts by status, every service and the open incidents | **Held out**: see below |

Each task folder holds `task.md`, the prompt word for word, `data.json`, which the harness copies into the app's
`src/data/` so the checks know what the screen should show, and `check.mjs`, the task's own checks.

`status` is held out. Its score is reported like the others, but nobody reads its runs' details or changes the docs
because of how it did. A docs change counts when it raises the other tasks without lowering `status`. If it lifts the
three and drops the held-out one, it was probably tuned to them.

## How a run is scored

The score is the share of scripted checks that pass. Each check is pass or fail, read from the built app or its
source, so no judgment of taste goes into it. A row gives the median score across the task's clean runs, with the
lowest and highest.

| Checks | What they check |
| --- | --- |
| The task's own, on desktop and phone | That the screen does what the task asks, using the task's data: every message listed and one opening on a click, each field holding its value and Save saying Saved, search filtering and Name sorting, each service's status in words |
| Builds and renders | `npm run build` passes, the page has text and no errors |
| Axe | No WCAG 2.1 A or AA violations on the desktop's first screen, after the task's steps, on a phone and in dark mode |
| Page | One `h1`; text and controls at least 8px from the window's edges on desktop and phone, with text in a region that scrolls sideways measured at that region's edges; no sideways scroll on a phone |
| Source | The app's own code imports at least one Lede module, has no hard-coded or Tailwind palette colors, and puts no click handler on a `div`, `span`, `li`, `td` or `tr` |

The grader is a second opinion, logged beside the score and never part of it. Sonnet 5.5 reads the run's screenshots
three times against a fixed rubric: task fit, hierarchy, consistency, spacing and the phone screen, each from 1 to 5. It
sees the screenshots under neutral names in a folder of their own and isn't told which model built the app. The row
gives the median of the five criteria's medians. `grade.mjs` holds the rubric word for word.

The row's other columns come from Claude Code's own result and the docs server's log: tool calls, docs pages fetched,
their size, paths that don't exist, cost and minutes. `metrics.json` has the rest: every check with its detail, tool
calls by name, each page fetched, URLs fetched from anywhere else, the grader's three passes and the build's output.

## Which model

| Use | Model | About |
| --- | --- | --- |
| Trying a docs change | Haiku 5.5, 3 runs of each task | $0.02 and 1.5 minutes a run |
| Confirming a change before it merges | Sonnet 5.5 at `--effort high` | $0.26 a run |
| An occasional check of the ceiling | Opus 5.5 or Fable 5.2 | $0.66 to $1.12 a run |

The grader adds about $0.09 a run, more than a Haiku run itself; `--no-grade` skips it while trying things out.

## Changing the docs without overfitting

- Change the docs only for a failure that shows up on two or more tasks, or in a step every task takes, such as the
  install steps.
- Never put a task's words, such as "inbox" or "servers", into the docs because a task uses them.
- Compare whole batches, and look at the held-out task's score last.
- When a new kind of failure shows up, add a check for it to `checks.mjs` or to a task's `check.mjs` before changing the
  docs, and run the batch before and after.

## How it stays fair

- **The tasks, in the repository.** Each prompt is its `task.md`, word for word. It names `llms.txt` and nothing else.
- **The docs under test, and only those.** The harness serves the built site on a local port. The build's links name
  `https://lede.cloudcompute.com`, so text files are served with that origin replaced by the local one, and the release
  registry URL `/r/vX.Y.Z/{name}.json` is served from the build's `r/`. Nothing else in a file changes. Build first:
  the harness can't tell which commit `dist/` came from, so a stale build measures old docs.
- **A fresh agent.** Each run gets its own empty Claude Code config folder, no settings files, no MCP servers, no
  skills or slash commands, and no CLAUDE.md, memory or web tools. Its tools are Bash, Read, Write, Edit, Glob and
  Grep. `agent.mjs` sets this up, for the grader too.
- **A fresh app outside the repository.** Each run starts from the same `create-vite` react-ts app, in a temporary
  folder outside this checkout.
- **Contamination is checked, not assumed.** A run is marked contaminated and left out of the medians when its tool
  calls name this checkout's path, which Bash could read, or when Claude Code reports handing it any memory, skill or
  MCP server. The first trial run inside a Claude Code session did get the parent session's team memory, through
  environment variables the harness now removes; this check is what caught it.
- **The harness checks the result.** It runs `npm run build`, serves the app and runs every check itself, after the
  agent has stopped. The agent's own claims count for nothing.
- **Each row says what it ran on.** The date, docs commit, model, effort and Claude Code version go into the row.
  Models and Claude Code change, so compare rows from the same day and setup.

## Not measured yet

- An agent using a Lede screen, rather than building one, through browser tools.
- Keyboard use: that each task can be done without a mouse.
