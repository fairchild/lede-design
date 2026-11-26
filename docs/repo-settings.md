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
| `RELEASE_APP_PRIVATE_KEY` | A repository secret (the workflows read it as `secrets.`, with no environment). Every workflow on every branch can read it, including one a feature branch adds. | In an environment that admits only `main` and `develop`. Needs a workflow change, see *Release app key* below. |
| `cloudflare` environment | Admits `main`, `v*` tags and `develop` (`deploy-preview.yml` needs it). Holds the production Worker token and the R2 keys that write `r/v*`. | Production keys admit only `main` and `v*` tags. The preview gets an environment of its own, see *Preview credentials* below. |
| `release` environment | Required reviewer `fairchild`. | Deployment branches limited to `main` (*Approve the release* runs from `main`'s copy, as a `workflow_run`). |
| Stale branches | `docs/fork-approval`, `integration/test`, `integrations`, `integrations-chat`, `integrations-chat-plain`: none merged into `develop`, none with an open pull request, last commits 2026-11-09 to 2026-11-16. | Deleted, once Bertram confirms nothing on them is wanted. |

## Steps for an admin

### 1. Rulesets

In *Settings → Rules → Rulesets*:

1. *New ruleset → Import a ruleset*, pick `.github/rulesets/develop.json`. Before saving, under *Bypass list* add the
   release app (*Add bypass → Apps*, `lede-release`) with *Always allow*. Save. Leave *Protect release branches* as it
   is; it still keeps `develop` and `main` from being deleted.
2. Open the ruleset *main*. Under *Require a pull request before merging → Allowed merge methods*, untick *Squash* and
   *Rebase*, leaving *Merge*. Under *Require status checks to pass*, open `check` and set its source to *GitHub
   Actions*. Keep the bypass list as it is. Save.
3. Nothing changes on *release tags*.

To check: a push straight to `develop` from a clone is refused with `GH013`, and a pull request into `develop` whose
`check` failed shows *Merging is blocked*.

### 2. Merge buttons

In *Settings → General → Pull Requests*: untick *Allow rebase merging*, tick *Allow auto-merge* and *Always suggest
updating pull request branches*. Keep *Allow merge commits*, *Allow squash merging* and *Automatically delete head
branches* on. Or, with `gh` signed in as an admin:

```bash
gh api -X PATCH repos/fairchild/lede-design \
  -F allow_rebase_merge=false -F allow_auto_merge=true -F allow_update_branch=true
```

### 3. Environments

In *Settings → Environments*:

- `release`: under *Deployment branches and tags*, choose *Selected branches and tags* and add `main`.
- `cloudflare`: under *Deployment branches and tags*, check the list is exactly `main`, `develop` and the tag rule
  `v*`. Remove anything else. (Removing `develop` waits for *Preview credentials* below.)

### 4. Actions

In *Settings → Actions → General*:

- *Fork pull request workflows from outside collaborators*: *Require approval for all external contributors*.
- *Workflow permissions*: *Read repository contents and packages permissions*, and untick *Allow GitHub Actions to
  create and approve pull requests*. The release app opens and merges the release pull request, so the workflows'
  own token never needs to.

### 5. Code security

In *Settings → Code security*: turn on *Secret scanning* with *Push protection*, *Dependabot alerts* and *Private
vulnerability reporting* (`SECURITY.md` asks for reports). All are free on a public repository.

## Changes that need a workflow change too

These wait for the release thread, which owns the release workflows, so the two don't edit the same files at once.

### Release app key

`RELEASE_APP_PRIVATE_KEY` can tag releases and merge into `main`, past both rulesets. As a repository secret, any
workflow can read it, so a branch that adds a workflow file gets it on its first push. The fix:

1. Create an environment `release-app` with *Deployment branches and tags* set to `main` and `develop`, and no
   reviewer.
2. Move the secret: `gh secret set RELEASE_APP_PRIVATE_KEY --repo fairchild/lede-design --env release-app`, then
   delete the repository secret.
3. Give each job that reads it `environment: release-app`: `release-pr.yml` (runs on `develop`), `release-tag.yml` and
   `prepare-release.yml` (`main`). *Approve the release*'s merge job already runs in `release`; give that environment
   the secret too, or split the merge into a second job.

A workflow on any other branch then reads an empty value, and says the release app isn't set up.

### Preview credentials

`deploy-preview.yml` runs on every push to `develop` with the production Worker token and R2 keys that can overwrite
any published release in `r/`. It uses the R2 keys for one write, `ci/credentials-check`, to catch a broken key before
a release. A main push already publishes `r/next` with the same keys, so the check can move there.

1. Create an environment `preview` that admits only `develop`, with its own `CLOUDFLARE_API_TOKEN` and
   `CLOUDFLARE_ACCOUNT_ID`. A Cloudflare token can't be limited to one Worker, so this one has the same Worker rights;
   what it lacks is the R2 keys.
2. Point `deploy-preview.yml` at `preview` and drop its R2 step.
3. Take `develop` off the `cloudflare` environment's deployment branches.
