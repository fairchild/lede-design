# Repository settings

What the repo's settings are meant to be, and why. Routine work, by people or by agent threads, should reach `develop`
only through a pull request whose `check` passed, never touch `main` or a tag, and never hold a credential that can
publish. Only a repo admin can change these settings, so each section ends with the steps.

The files in `.github/rulesets/` are the record of the rulesets. Change a file and import it again (or edit the
ruleset to match it), so the two don't drift. A ruleset's bypass list names the release app by its ID, which differs
per install, so every file leaves `bypass_actors` empty and the steps below add the app by hand.

## Audit, 2026-11-26

What the API showed to a thread with write access. Branch protection, environments, secrets and Actions settings
aren't readable without admin, so those rows are what the workflows expect, not what was seen.

| Setting | Now | Target |
| --- | --- | --- |
| `develop` | *Protect release branches*: restrict deletions only. Anyone with write access can push to it, force-push it, or merge a pull request whose `check` failed. | Also require a pull request, require `check`, block force pushes (`develop.json`). The release app bypasses, because *Prepare a release* commits to `develop`. |
| `main` | Ruleset *main*: restrict deletions, block force pushes, require a pull request and `check`. Merge, squash and rebase are all allowed. | The same, merge commits only (`main.json`), so a release pull request can't be squashed again (0.7.0, 0.7.2). |
| `v*` tags | Ruleset *release tags*: restrict creation, update and deletion. | Unchanged (`release-tags.json`). Admins and the release app bypass. |
| `check` | Required by context name only. | Pinned to GitHub Actions (`integration_id` 15368), so no other app's status named `check` can satisfy it. |
| Merge buttons | Merge, squash and rebase allowed. Auto-merge off. *Update branch* off. Head branches deleted after merge. | Rebase off. Auto-merge on, so a thread can enable it and the pull request merges when `check` passes, without the thread polling. *Always suggest updating pull request branches* on. Keep deleting head branches; the rulesets keep `develop` and `main`. |
| `RELEASE_APP_PRIVATE_KEY` | A repository secret (the workflows read it as `secrets.`, with no environment). Every workflow on every branch can read it, including one a feature branch adds. | In `release-app`, which admits only `main` and `develop`, and in `release`. The jobs that read it name `release-app`; see *Release app key* below. |
| `cloudflare` environment | Admits `main`, `v*` tags and `develop` (`deploy-preview.yml` needs it). Holds the production Worker token and the R2 keys that write `r/v*`. | Admits only `main` and `v*` tags. The preview deploys from `preview`, see *Preview credentials* below. |
| `release` environment | Required reviewer `fairchild`. | Deployment branches limited to `main` (*Approve the release* runs from `main`'s copy, as a `workflow_run`). |
| Stale branches | `docs/fork-approval`, `integration/test`, `integrations`, `integrations-chat`, `integrations-chat-plain`: none merged into `develop`, none with an open pull request, last commits 2026-11-09 to 2026-11-16. | Deleted, once Bertram confirms nothing on them is wanted. |

## Steps for an admin

`scripts/repo-settings.sh` makes every change below with `gh`, signed in as an admin, and each step can run again:

1. Import `.github/rulesets/develop.json` (*Settings → Rules → Rulesets → New ruleset → Import a ruleset*), or
   `gh api -X POST repos/fairchild/lede-design/rulesets --input .github/rulesets/develop.json`.
2. `scripts/repo-settings.sh before`. It updates the `main` ruleset from `main.json` and keeps its bypass list, puts the
   release app on the `develop` ruleset's bypass list, sets the merge buttons, creates or updates the `release`,
   `release-app` and `preview` environments with their deployment branches, asks for the two secrets, and sets the
   Actions and code security settings below.
3. Once the workflows that name `release-app` and `preview` are on `develop` (and, for the release workflows that run
   from `main`, on `main` after the next release), `scripts/repo-settings.sh after`. It deletes the repository copy of
   the release app's key and limits `cloudflare` to `main` and `v*` tags.
4. `scripts/repo-settings.sh check` prints what's set.

What each setting is, for doing it by hand:

- **Rulesets.** `develop` as `develop.json`, with the release app (*Add bypass → Apps*, `lede-release`, *Always
  allow*) on its bypass list, because *Prepare a release* commits to `develop`. `main` as `main.json`: *Allowed merge
  methods* only *Merge*, and `check`'s source *GitHub Actions*. *Protect release branches* and *release tags* stay as
  they are.
- **Merge buttons** (*Settings → General → Pull Requests*): rebase off; auto-merge and *Always suggest updating pull
  request branches* on; merge commits, squash and *Automatically delete head branches* on.
- **Environments** (*Settings → Environments*, *Deployment branches and tags → Selected branches and tags*):
  `release` admits `main` and keeps its reviewer; `release-app` admits `main` and `develop`, with no reviewer;
  `preview` admits `develop`; `cloudflare` admits `main` and the tag rule `v*`.
- **Actions** (*Settings → Actions → General*): approval for all external contributors' fork pull requests; *Workflow
  permissions* read-only, and *Allow GitHub Actions to create and approve pull requests* off. The release app opens and
  merges the release pull request, so the workflows' own token never needs to.
- **Code security** (*Settings → Code security*): *Secret scanning* with *Push protection*, *Dependabot alerts* and
  *Private vulnerability reporting* (`SECURITY.md` asks for reports). All are free on a public repository.

To check the rulesets: a push straight to `develop` from a clone is refused with `GH013`, and a pull request into
`develop` whose `check` failed shows *Merging is blocked*.

## Secrets and environments

### Release app key

`RELEASE_APP_PRIVATE_KEY` can tag releases and merge into `main`, past both rulesets. As a repository secret, any
workflow can read it, so a branch that adds a workflow file would get it on its first push. So it lives in two
environments instead:

- `release-app`, which admits only `main` and `develop`. *Prepare a release*, *Open the release pull request* (on
  `develop`) and *Tag the release* (on `main`) name it.
- `release`, which admits only `main` and holds the approval. *Approve the release*'s merge job runs in it, as a
  `workflow_run` from `main`'s copy of the file.

A workflow on any other branch reads an empty value, and says the release app isn't set up. Until `after` deletes the
repository secret, a job in either environment still falls back to it, so the move breaks nothing while it's under
way.

### Preview credentials

`deploy-preview.yml` deploys from `preview`, which admits only `develop` and holds a Cloudflare token of its own
(*Workers Scripts: Edit*, *Workers Routes: Edit* on the preview host's zone) and the account ID, and no R2 keys. A
Cloudflare token can't be limited to one Worker, so the preview's has the same Worker rights as production's; what
develop no longer holds is anything that can overwrite a published registry in `r/`. A broken R2 key now shows at the
next push to `main`, when Deploy publishes `r/next` with it.
