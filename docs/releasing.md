# Releasing Lede

Merging to `main` doesn't change lede.cloudcompute.com. A push to `main` publishes `r/next` and uploads a preview
version only. A release is two steps: a pull request that names the version, then a `vX.Y.Z` tag on the commit it
merged as. The tag runs Deploy, which publishes the release's registry and the site, and the mirror, which copies the
registry to GitHub.

| Step | Who | What happens |
| --- | --- | --- |
| 1. Release pull request | Anyone, Claude included | Bumps the version and names the release in the CHANGELOG |
| 2. Merge it | Bertram, once `check` is green | `main` holds the release commit |
| 3. Push the tag | Bertram only | A ruleset restricts tag creation, so a Claude sandbox can't push one |
| 4. Deploy | `deploy.yml` | Waits for `check` on the tagged commit, publishes `r/vX.Y.Z` to R2, deploys the site |
| 5. Mirror | `mirror-registry.yml` | Waits for `r/vX.Y.Z` on the site, copies it to the `registry` branch |

## 1. Prepare the release

Pick the version: a minor (`0.7.0`) for anything added or changed, a patch (`0.6.1`) for fixes only. Before
releasing, read the README and the docs pages a release changed against [Reviewing copy](../CONTRIBUTING.md#reviewing-copy).

On a branch from `main`, with `OLD=0.6.0 NEW=0.7.0`:

```bash
npm version "$NEW" --no-git-tag-version      # package.json and package-lock.json
grep -rlF "v$OLD" README.md integrations .github | xargs perl -pi -e "s/v\Q$OLD\E/v$NEW/g"
git diff --stat                              # README, integrations' READMEs and AGENTS.md, the bug template
```

Then in `CHANGELOG.md`, rename `## Unreleased` to `## $NEW` and add a short paragraph under it: what the release is
about in a sentence or two, and its registry URL, `https://lede.cloudcompute.com/r/v$NEW/{name}.json`. `llms.txt`
takes the version from `package.json`, so it needs no edit. `tests/readme.spec.ts` fails if a README URL still names
the old version.

Open the pull request as `chore(release): prepare $NEW` (see #107) and merge it when `check` is green. Pull requests
branched before it that add CHANGELOG lines will merge them into the release's section; move them to a new
`## Unreleased` before the tag, or in the next release.

## 2. Push the tag

Bertram, from an up-to-date `main`:

```bash
git checkout main && git pull
git tag "v$NEW" && git push origin "v$NEW"
```

The tag has to be on the release commit: Deploy fails if the tag doesn't match `package.json`'s version. The push
prints this, which is a success:

```
remote: Bypassed rule violations for refs/tags/v0.7.0:
remote: - Cannot create ref due to creations being restricted.
```

An admin bypasses the tag ruleset, and GitHub reports the bypass. Anyone else's push is refused with `GH013:
Repository rule violations found`, and nothing is created.

## 3. Check it's live

Deploy can take up to 45 minutes, because it waits for `check` on the tagged commit. The mirror waits up to an hour
for Deploy. Watch both on the [Actions tab](https://github.com/fairchild/lede-design/actions), then:

```bash
curl -fsS https://lede.cloudcompute.com/r/v$NEW/registry.json | head -c 100     # the release's registry
curl -fsS https://lede.cloudcompute.com/llms.txt | grep -m1 "r/v$NEW"           # the site names the release
curl -fsS https://raw.githubusercontent.com/fairchild/lede-design/registry/r/v$NEW/registry.json | head -c 100   # the mirror
```

Then publish the design system for claude.ai, as [How the code is organized](../CONTRIBUTING.md#how-the-code-is-organized)
says (`npm run design-system`).

## When it goes wrong

- **The push printed "Bypassed rule violations".** It worked. Check Actions for the Deploy run.
- **Claude can't push the tag.** Expected: the ruleset allows only admins. Bertram pushes it.
- **Deploy failed with "Tag … doesn't match package.json version".** The tag is on the wrong commit. Delete it
  (`git push origin :refs/tags/v$NEW`, then `git tag -d v$NEW`) and tag the release commit.
- **Deploy failed with "CI's check … finished as failure" or "isn't there".** `check` didn't pass on the tagged
  commit within 45 minutes. Fix `main`, merge, and tag a new version; once a release is published it can't be
  replaced. If nothing was published yet (`r/v$NEW/registry.json` is a 404), you can delete the tag and tag a
  passing commit instead.
- **The registry is there but the site didn't change.** Deploy deploys the site only from the highest final tag. A
  prerelease (`v0.7.0-rc.1`) or an older tag publishes its registry and leaves the site as it is.
- **The mirror timed out.** Once Deploy has published, run *Mirror the registry on GitHub* from the Actions tab with
  the tag, such as `v0.7.0`.
- **Deploy said "Deploy skipped".** The `cloudflare` environment has no `CLOUDFLARE_API_TOKEN`. Add it in the repo's
  Environments settings and re-run the job.
