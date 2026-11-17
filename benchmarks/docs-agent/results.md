# Docs benchmark results

`run.mjs` appends a row for each batch of runs. Each number is the median of the clean runs, and the columns are
explained in [README.md](README.md#what-it-measures). A row holds for its date, model and docs commit only.

| Date | Label | Docs | Model | Effort | Claude Code | Clean runs | Tool calls | Docs files | Docs KB | Docs 404s | Text read KB | Output tokens | Cost USD | Minutes | Builds | Lede imports | Axe violations |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-17 | baseline | f3ef3bb | claude-fable-5-2 | default | 2.1.326 | 1/1 | 16 | 6 | ~332 | 0 | 66 | 7883 | 1.12 | 8.3 | 1/1 | 3 | 0 |

The first row is one run, which shows the harness works and is not a result. Its Docs KB is the size of the six pages
it fetched, since that run counted registry files in the column too. The agent read `llms.txt`, Overview, Choose, the
Inbox and Page reference pages and the whole of `llms-full.txt` (284 KB), installed `@lede/inbox`, and built the screen
from `InboxFlow`. `shadcn init` couldn't reach ui.shadcn.com from the cloud sandbox, so it wrote `components.json` by
hand, as the docs allow.
| 2026-11-17 | haiku | bb04477 | claude-haiku-5-5 | default | 2.1.326 | 1/1 | 13 | 4 | 47 | 0 | 56 | 9925 | 0.02 | 1.4 | 1/1 | 4 | 0 |
| 2026-11-17 | sonnet | bb04477 | claude-sonnet-5-5 | default | 2.1.326 | 1/1 | 10 | 3 | 35 | 0 | 43 | 4295 | 0.17 | 2.8 | 1/1 | 2 | 0 |

The Haiku 5.5 and Sonnet 5.5 rows are one run each, on the same build as each other and the same docs as the
baseline. Haiku built the screen by hand from MasterDetail, List and PageHeader, after reading MasterDetail's and
List's reference pages. Its unread rows sit further in than its read ones, because only they have something in the
leading slot. Sonnet used `InboxFlow` as Fable did, but without `Page`, so its screen has no gutter. Sonnet's minutes and output tokens
were corrected by hand after `measure.mjs` learned that a background command finishing after the agent's reply
starts another turn with its own result.
