# Self-hosted CI

When GitHub-hosted runners are unavailable, a pull request's CI can run on a machine you control. One sentence starts
it, for a person or an agent:

> Run Lede's self-hosted CI for pull request 26, following docs/self-hosted-ci.md.

You need `gh`, authenticated as someone with admin access to the repo, because registering a runner takes admin. You
also need an isolated machine that runs the job and is thrown away afterward: a VM or a container. The pull request's
code runs there with the runner's access.

While a runner is registered, any workflow that asks for `runs-on: self-hosted` can claim it, including one edited in
a pull request from a fork. The repo requires approval before a workflow runs for any outside contributor (Settings →
Actions → General → "Require approval for all external contributors"), so a fork's edited workflow waits for a
maintainer and never reaches the runner unseen. Approve a fork's run only after reading its workflow changes.

## Steps

1. Read the pull request at its head and note the 40-character SHA. The run tests that commit only.

   ```sh
   gh pr view 26 --json headRefOid --jq .headRefOid
   ```

2. Register a single-use runner labelled `self-hosted` and `pr-26`, and start it on the isolated machine. A
   just-in-time config takes one job and then removes itself.

   ```sh
   gh api -X POST repos/fairchild/lede-design/actions/runners/generate-jitconfig \
     -f name=pr-26-$(date +%s) -F runner_group_id=1 -f 'labels[]=self-hosted' -f 'labels[]=pr-26' \
     -f work_folder=_work --jq .encoded_jit_config > jit
   ./run.sh --jitconfig "$(cat jit)"   # on the isolated machine, from actions/runner
   ```

   The machine needs Node 22, git and Chromium's system libraries. A Linux arm64 or x64 host works.

3. Dispatch the run on the default branch. `suites` defaults to `full`, one job that runs everything, so one
   runner covers the pull request.

   ```sh
   gh workflow run self-hosted-ci.yml -R fairchild/lede-design --ref main \
     -f pull_request=26 -f head_sha=<sha>
   ```

   To rerun one part, name it instead, such as `-f suites=test-3`. One runner takes one job, so each named suite
   needs a runner of its own.

4. Watch the run and report its URL with the result.

   ```sh
   gh run list -R fairchild/lede-design -w self-hosted-ci.yml -L 1
   gh run watch <run-id> -R fairchild/lede-design --exit-status
   ```

The run attaches no checks to the pull request. A merge on self-hosted CI names the run URLs in its commit body.

## Suites

`full` is the default. It runs, on one runner, one `npm ci`, the build, the Playwright suite, perf and each entry in
`integrations/`, in that order. Once `npm ci` passes, each later step runs whether or not the steps before it failed,
and every integration runs whether or not another fails. It has a 55-minute timeout.

For reruns: `build`, `test-1` to `test-5`, `perf`, `integration-json-render` and `integration-json-render-chat`, as
listed in `.github/workflows/self-hosted-ci.yml`. Each sets up from scratch. perf compares timings, so read a failure
there against the machine's load.
