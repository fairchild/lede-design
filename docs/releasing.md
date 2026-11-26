# Releasing Lede

Work lands on `develop`, and `main` changes only at a release. Every pull request targets `develop`. A release
merges `develop` into `main` in one pull request, then a `vX.Y.Z` tag on `main`'s new head runs Deploy, which
publishes the release's registry and the site, and the mirror, which copies the registry to GitHub. Merging to either
branch alone doesn't change lede.cloudcompute.com.

With the release app and the `release` environment set up (see [Setting up](#setting-up)), a release takes one click
from Michael: *Approve and deploy* on the approval GitHub sends him when the release pull request passes CI and its
commit's preview passes the smoke tests. Claude or
anyone else starts it with *Prepare a release*. Without the setup, the same steps work by hand, and each workflow says
in its run that it stopped.

| Step | Who | What happens |
| --- | --- | --- |
| 1. Prepare the release | Anyone: *Prepare a release* in Actions (Claude can run it), or by hand | A commit on `develop` bumps the version and names the release in the CHANGELOG |
| 2. Release pull request | `release-pr.yml` | Opens `develop` → `main` |
| 3. Approve | Michael, one click | `release-approve.yml` asks once `check` is green and the preview's smoke test passed on the same commit, and merges with a merge commit when he approves |
| 4. Tag | `release-tag.yml` | Waits for `check` on `main`'s new head, then tags `vX.Y.Z` as the release app |
| 5. Deploy | `deploy.yml` | Waits for `check` on the tagged commit, publishes `r/vX.Y.Z` to R2, deploys the site, then smoke-tests it and compares its key pages with the preview's screenshots |
| 6. Mirror | `mirror-registry.yml` | Waits for `r/vX.Y.Z` on the site, copies it to the `registry` branch |

## 1. Prepare the release

Pick the version: a minor (`0.7.0`) for anything added or changed, a patch (`0.6.1`) for fixes only. Before
releasing, read the README and the docs pages a release changed against [Reviewing copy](../CONTRIBUTING.md#reviewing-copy).

Run *Prepare a release* from the [Actions tab](https://github.com/fairchild/lede-design/actions/workflows/prepare-release.yml)
with the version and a sentence or two on what the release is about. It commits `chore(release): prepare $NEW` to
`develop` as the release app; the release pull request into `main` runs CI on it and shows it before the approval. Or,
by hand, on a branch from `develop`:

```bash
node scripts/prepare-release.mjs 0.8.0 "What the release is about, in a sentence or two."
git diff --stat      # package.json, package-lock.json, CHANGELOG.md, the README, integrations' READMEs, the bug template
```

The script sets the version, moves every `v$OLD` URL in the README, `integrations/` and `.github/` to `v$NEW`, and
renames `## Unreleased` in `CHANGELOG.md` to `## $NEW` with the summary and the release's registry URL,
`https://lede.cloudcompute.com/r/v$NEW/{name}.json`. `llms.txt` takes the version from `package.json`.
`tests/readme.spec.ts` fails if a README URL still names the old version. By hand, open it into `develop` as
`chore(release): prepare $NEW` (see #126) and merge it when `check` is green.

Pull requests branched before it that add CHANGELOG lines will merge them into the release's section; move them to a
new `## Unreleased` before the release pull request, or in the next release.

## 2. Approve the release

When `develop`'s version moves ahead of `main`'s, *Open the release pull request* opens `release: $NEW` from `develop`
into `main`, with the release's CHANGELOG section as its body. Without the app, open it by hand with that title.

This is the human gate. When CI passes on the pull request and the preview of the same commit passes its smoke tests
(the *Smoke-test the preview* job in `deploy-preview.yml`, which reads the deployed site back), *Approve the release*
waits on the `release` environment. The two finish in either order, and whichever finishes last asks:
GitHub emails Michael, and the run's page (linked from the pull request's checks) shows *Review deployments*. Tick
`release` and press *Approve and deploy*, and the job merges the pull request with a merge commit as the release app.
*Reject* leaves it open. A push to `develop` while the request waits replaces it with a new one once CI and the smoke
test pass again, and the merge names the commit they passed on, so an approval never releases a commit they didn't see.

To merge by hand instead, use a merge commit, not a squash, so `develop` and `main` keep one history. If a squash
slips through, *Tag the release* warns, and `main` needs merging back into `develop`. A request still waiting on a commit
`main` already has is stale, and *Tag the release* cancels it on the next push to `main`.

## 3. The tag

*Tag the release* runs on every push to `main`. When `main`'s `package.json` names a version with no tag, it waits for
`check` on that commit (up to 45 minutes) and creates `v$NEW` there as the release app, which runs Deploy and the
mirror. A push whose version is already tagged does nothing. If `check` fails, nothing is tagged: fix it on `develop`,
and the fix's merge into `main` gets the tag. To retry after a timeout, run *Tag the release* from the Actions tab.

By hand, as an admin, from `main` once the release pull request has merged:

```bash
git checkout main && git pull
git tag "v$NEW" && git push origin "v$NEW"
```

Tag only after the merge: Deploy fails if the tag doesn't match `package.json`'s version. The push prints this, which
is a success:

```
remote: Bypassed rule violations for refs/tags/v0.7.0:
remote: - Cannot create ref due to creations being restricted.
```

An admin or the release app bypasses the tag ruleset. Anyone else's push is refused with `GH013: Repository rule
violations found`, and nothing is created.

## 4. Check it's live

Deploy can take up to 45 minutes, because it waits for `check` on the tagged commit. The mirror waits up to an hour
for Deploy. Watch both on the [Actions tab](https://github.com/fairchild/lede-design/actions), then:

```bash
curl -fsS https://lede.cloudcompute.com/r/v$NEW/registry.json | head -c 100     # the release's registry
curl -fsS https://lede.cloudcompute.com/llms.txt | grep -m1 "r/v$NEW"           # the site names the release
curl -fsS https://raw.githubusercontent.com/fairchild/lede-design/registry/r/v$NEW/registry.json | head -c 100   # the mirror
```

Then publish the design system for claude.ai, as [How the code is organized](../CONTRIBUTING.md#how-the-code-is-organized)
says (`npm run design-system`).

## Branches and CI

- Pushes to `develop` run no CI. Each one deploys `develop` to the preview site, `PREVIEW_HOST`, as CONTRIBUTING.md's
  [Preview develop](../CONTRIBUTING.md#preview-develop) says, and publishes nothing else. `r/next` and the Worker
  preview version that Deploy uploads follow `main`, so they change only at a release.
- A pull request into `develop` runs the whole suite, because `scripts/ci-tier.mjs` tiers only pull requests into
  `main`. The release pull request into `main` is tiered as usual.
- `develop` → `main` is the only pull request into `main`, apart from a hotfix: branch from `main`, merge into
  `main`, release a patch, then merge `main` into `develop`.

## When it goes wrong

- **The push printed "Bypassed rule violations".** It worked. Check Actions for the Deploy run.
- **Claude can't push the tag.** Expected: the ruleset allows only admins and the release app. *Tag the release*
  creates it, or Michael pushes it.
- **"Tag it by hand" or "Open it by hand" in a run's notices.** The release app's variable or secret isn't set. Set
  it up as below, then run the workflow again from the Actions tab, or do that step by hand.
- **No approval request came.** CI or the preview's smoke test hasn't passed on the release pull request's latest
  commit (the runs of *Approve the release* say which, in their notices), or a run of it failed: "no required reviewer"
  means the `release` environment isn't set up, and the merge was refused. "The preview wasn't deployed" means *Deploy
  develop to the preview site* skipped its deploy, so the smoke test never ran: give the `cloudflare` environment
  `CLOUDFLARE_API_TOKEN` and let it admit `develop`, then re-run that workflow. A smoke failure names the page or file
  in the run; once it's fixed on the site, *Re-run failed jobs* runs the smoke test alone, without deploying again.
- **`develop` disappeared after a release.** The *Protect release branches* ruleset isn't active. Recreate `develop`
  from `main` and import the ruleset, as in step 6 below.
- **Smoke-test production failed.** The site is deployed, but differs from what the preview showed or doesn't serve a
  page or file. The run names what failed, and its `smoke-results` artifact holds each screenshot diff. A screenshot
  difference after a Chromium or runner update, with no change to the site, clears on the next release; anything else
  is a fix on `develop` and a patch release (or `npx wrangler rollback` to go back first).
- **Approve the release failed at the merge.** `develop` moved after the request (a newer request follows when its CI
  passes), or a rule on `main` stops the app: add it to that ruleset's bypass list.
- **Tag the release failed with "Resource not accessible" or a rule violation.** The app isn't installed on the repo,
  lacks Contents: write, or isn't on the tag ruleset's bypass list.
- **Deploy failed with "Tag … doesn't match package.json version".** The tag is on the wrong commit. Delete it
  (`git push origin :refs/tags/v$NEW`, then `git tag -d v$NEW`) and tag the release commit.
- **Deploy failed with "CI's check … finished as failure" or "isn't there".** `check` didn't pass on the tagged
  commit within 45 minutes. Fix it on `develop`, release again, and tag a new version; once a release is published it can't be
  replaced. If nothing was published yet (`r/v$NEW/registry.json` is a 404), you can delete the tag and tag a
  passing commit instead.
- **The registry is there but the site didn't change.** Deploy deploys the site only from the highest final tag. A
  prerelease (`v0.7.0-rc.1`) or an older tag publishes its registry and leaves the site as it is.
- **The mirror timed out.** Once Deploy has published, run *Mirror the registry on GitHub* from the Actions tab with
  the tag, such as `v0.7.0`.
- **Deploy said "Deploy skipped".** The `cloudflare` environment has no `CLOUDFLARE_API_TOKEN`. Add it in the repo's
  Environments settings and re-run the job.
- **Deploy failed with "R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY isn't set", or publishing to R2 failed with HTTP 403.** The `cloudflare` environment is
  missing the R2 token's keys, or the token can't write the `lede-design` bucket. Set them up as in *Cloudflare
  credentials* below and re-run the job.

## Setting up

Once, by a repo admin. A GitHub App commits the release, opens and merges the release pull request and creates the
tag, because the workflows' own token can't: a pull request it opens or a push it makes runs no CI, a tag it creates
runs no Deploy, and the tag ruleset can't name it.

1. Create the app at [New GitHub App](https://github.com/settings/apps/new), signed in as the account that owns the
   repo. Name it (say `lede-release`), give the repo as its homepage, untick *Webhook → Active*, and give it
   *Repository permissions → Contents: Read and write* and *Pull requests: Read and write*. *Only on this account*.
2. On the app's page, note its *Client ID*, and under *Private keys* generate one, which downloads a `.pem`. Then
   *Install App* on `fairchild/lede-design` only.
3. Store both for Actions:

   ```bash
   gh variable set RELEASE_APP_CLIENT_ID --repo fairchild/lede-design --body "<client id>"
   gh secret set RELEASE_APP_PRIVATE_KEY --repo fairchild/lede-design < ~/Downloads/<app>.private-key.pem
   ```

   Then delete the `.pem`; a new one can be generated any time.
4. In the repo's *Settings → Rules → Rulesets*, open the ruleset that restricts tag creation, add the app under
   *Bypass list* with *Always allow*, and save. If a ruleset or branch protection covers `develop` (requires pull
   requests) or `main` (requires reviews), add the app to its bypass list too, so it can commit the release to
   `develop` and merge the release pull request.
5. In *Settings → Environments*, add an environment named `release`, tick *Required reviewers*, add `fairchild`,
   and save. That's the approval. It is the owner's, so the agents that prepare a release, Bertram included, can't
   approve it.
6. Keep `develop` and `main` from being deleted. The repo deletes a pull request's head branch when it merges, which
   is right for feature branches but would delete `develop` when the release pull request merges. In *Settings →
   Rules → Rulesets*, choose *New ruleset → Import a ruleset* and pick
   [`.github/rulesets/protect-release-branches.json`](../.github/rulesets/protect-release-branches.json). It's a
   branch ruleset whose only rule is *Restrict deletions* on `develop` and `main`, so pushes and merges work as
   before, and the automatic delete skips both branches.

The ruleset in `.github/rulesets/` is the record of that setting: change the file and import it again (or edit the
ruleset to match) so the two don't drift.

### Cloudflare credentials

`deploy.yml` reads four secrets from the `cloudflare` environment, and each credential can do only what its steps
need:

| Secret | What it is | Used for |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | An API token with *Account → Workers Scripts: Edit* (and *Zone → Workers Routes: Edit* on the preview host's zone, for `deploy-preview.yml`). No R2 permission. | Deploying the Worker and uploading preview versions, through wrangler |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | An R2 API token with *Object Read & Write* on the `lede-design` bucket only | Publishing `r/vX.Y.Z` and `r/next`, through R2's S3 API, in `scripts/publish-r2.mjs` |
| `CLOUDFLARE_ACCOUNT_ID` | The account's ID | Both; it also names the R2 endpoint |

To make the R2 token, in the Cloudflare dashboard open *R2 Object Storage → Manage API tokens → Create API token*,
choose *Object Read & Write*, apply it to *Specific buckets only* with `lede-design`, and create it. The page shows the
*Access Key ID* and *Secret Access Key* once. Store them:

```bash
gh secret set R2_ACCESS_KEY_ID --repo fairchild/lede-design --env cloudflare
gh secret set R2_SECRET_ACCESS_KEY --repo fairchild/lede-design --env cloudflare
```

Each command asks for the value, so it stays out of the shell's history.

Each push to `develop` checks the keys: `deploy-preview.yml` writes one small object, `ci/credentials-check`, with
them, so a missing or misscoped R2 token fails the preview, well before a release needs it.

Wrangler doesn't need R2 access to deploy a Worker that binds the bucket: it checks whether a bound bucket exists, and
when the token can't look it says so and deploys anyway. If a deploy ever fails on the `BUCKET` binding, add *Workers
R2 Storage: Read* to `CLOUDFLARE_API_TOKEN`, never Edit.
