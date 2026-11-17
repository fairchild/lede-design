# Docs benchmark results

`run.mjs` appends a row for each task in a batch, to the table at the end. The score is the median share of scripted
checks that pass, with the lowest and highest in brackets, and the grader's column is its median from 1 to 5.
[README.md](README.md#how-a-run-is-scored) explains both. A row holds for its date, model and docs commit only.

## Version 1: the inbox alone, before scored checks

These rows come from the first version of the harness: one task, the inbox, written by the agent with its own sample
data, and no scored checks. Each number is the median of the clean runs.

| Date | Label | Docs | Model | Effort | Claude Code | Clean runs | Tool calls | Docs files | Docs KB | Docs 404s | Text read KB | Output tokens | Cost USD | Minutes | Builds | Lede imports | Axe violations |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-17 | baseline | f3ef3bb | claude-fable-5-2 | medium (default) | 2.1.326 | 1/1 | 16 | 6 | ~332 | 0 | 66 | 7883 | 1.12 | 8.3 | 1/1 | 3 | 0 |

The first row is one run, which shows the harness works and is not a result. Its Docs KB is the size of the six pages
it fetched, since that run counted registry files in the column too. The agent read `llms.txt`, Overview, Choose, the
Inbox and Page reference pages and the whole of `llms-full.txt` (284 KB), installed `@lede/inbox`, and built the screen
from `InboxFlow`. `shadcn init` couldn't reach ui.shadcn.com from the cloud sandbox, so it wrote `components.json` by
hand, as the docs allow.
| 2026-11-17 | haiku | bb04477 | claude-haiku-5-5 | medium (default) | 2.1.326 | 1/1 | 13 | 4 | 47 | 0 | 56 | 9925 | 0.02 | 1.4 | 1/1 | 4 | 0 |
| 2026-11-17 | sonnet | bb04477 | claude-sonnet-5-5 | medium (default) | 2.1.326 | 1/1 | 10 | 3 | 35 | 0 | 43 | 4295 | 0.17 | 2.8 | 1/1 | 2 | 0 |

The Haiku 5.5 and Sonnet 5.5 rows are one run each, on the same build as each other and the same docs as the
baseline. Haiku built the screen by hand from MasterDetail, List and PageHeader, after reading MasterDetail's and
List's reference pages. Its unread rows sit further in than its read ones, because only they have something in the
leading slot. Sonnet used `InboxFlow` as Fable did, but without `Page`, so its screen has no gutter. Sonnet's minutes and output tokens
were corrected by hand after `measure.mjs` learned that a background command finishing after the agent's reply
starts another turn with its own result.
| 2026-11-17 | haiku-x3 | 68cab10 | claude-haiku-5-5 | medium (asked default) | 2.1.326 | 3/3 | 16 | 8 | 113 | 0 | 73 | 11509 | 0.02 | 1.4 | 3/3 | 4 | 0 |
| 2026-11-17 | sonnet-high | 68cab10 | claude-sonnet-5-5 | high | 2.1.326 | 1/1 | 16 | 4 | 41 | 1 | 59 | 7394 | 0.26 | 1.4 | 1/1 | 3 | 0 |

Effort: Claude Code 2.1.326 applies `medium` to all three models when `--effort` isn't given. A one-line probe of each
model with the Stop hook confirmed it, so the first three rows say `medium (default)`. From `haiku-x3` on, the
Stop hook records the effort applied in each run.

In `haiku-x3`, one run used `InboxFlow` without `Page`, and two built the screen by hand from MasterDetail and List. In
one of those the list sat in the right half of the screen. `sonnet-high` used `InboxFlow` in `Page`. It also asked the
registry for `@lede/link` (a 404), because Overview's step 4 imports LinkProvider from `@/components/lede/link` and no
item has that name: the file comes with `lede-utils`.
| 2026-11-17 | opus-medium | ce5e8ba | claude-opus-5-5 | medium | 2.1.326 | 1/1 | 24 | 5 | 51 | 0 | 56 | 9270 | 0.66 | 4.0 | 1/1 | 4 | 0 |

## Scored runs

| Date | Label | Docs | Task | Model | Effort | Claude Code | Clean runs | Checks passed | Grader | Tool calls | Docs pages | Docs KB | Docs 404s | Cost USD | Minutes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
