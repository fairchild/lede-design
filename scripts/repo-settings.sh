#!/usr/bin/env bash
# Applies the settings docs/repo-settings.md describes, with gh signed in as a repo admin. Each step can run again.
#
#   scripts/repo-settings.sh before   rulesets, merge buttons, environments, their secrets, Actions and code security
#   scripts/repo-settings.sh after    once the workflows that read the environments are on develop and main: drops the
#                                     repository copy of the release app's key and develop's access to `cloudflare`
#   scripts/repo-settings.sh check    prints what's set
#
# `before` asks for two secrets, the release app's private key (a .pem path) and a Cloudflare API token for the preview,
# and reads each with gh, so neither reaches the shell's history. Set REPO to work on another repo.
set -euo pipefail
REPO=${REPO:-fairchild/lede-design}
R=repos/$REPO
RAW='Accept: application/vnd.github.raw'

say() { printf '\n== %s\n' "$*"; }

# Gives an environment exactly these deployment branches (`v*` is a tag), keeping its reviewers and wait timer.
environment() {
  local name=$1; shift
  local current
  current=$(gh api "$R/environments/$name" 2>/dev/null || echo '{}')
  jq '{
    wait_timer: ([.protection_rules[]? | select(.type == "wait_timer") | .wait_timer][0] // 0),
    prevent_self_review: ([.protection_rules[]? | select(.type == "required_reviewers") | .prevent_self_review][0] // false),
    reviewers: ([.protection_rules[]? | select(.type == "required_reviewers") | .reviewers[] | {type, id: .reviewer.id}] | if length == 0 then null else . end),
    deployment_branch_policy: {protected_branches: false, custom_branch_policies: true}
  }' <<< "$current" | gh api -X PUT "$R/environments/$name" --input - > /dev/null
  local want=" $* " policy id ref type
  # Remove what isn't wanted, then add what's missing.
  while read -r id ref type; do
    [ -n "$id" ] || continue
    if [[ "$want" != *" $ref "* ]]; then gh api -X DELETE "$R/environments/$name/deployment-branch-policies/$id"; fi
  done < <(gh api "$R/environments/$name/deployment-branch-policies" --jq '.branch_policies[] | "\(.id) \(.name) \(.type)"')
  for policy in "$@"; do
    type=branch; [[ "$policy" == v* ]] && type=tag
    gh api "$R/environments/$name/deployment-branch-policies" --jq '.branch_policies[].name' | grep -qxF "$policy" ||
      gh api -X POST "$R/environments/$name/deployment-branch-policies" -f name="$policy" -f type="$type" > /dev/null
  done
  echo "$name admits: $*"
}

before() {
  say 'Ruleset main: merge commits only, check from GitHub Actions (bypass list kept)'
  local id
  id=$(gh api "$R/rulesets" --jq '.[] | select(.name == "main") | .id')
  gh api "$R/contents/.github/rulesets/main.json?ref=develop" -H "$RAW" |
    jq --argjson b "$(gh api "$R/rulesets/$id" --jq '.bypass_actors // []')" '.bypass_actors = $b' |
    gh api -X PUT "$R/rulesets/$id" --input - --jq '.name'

  say 'Ruleset develop: the release app on its bypass list'
  id=$(gh api "$R/rulesets" --jq '.[] | select(.name == "develop") | .id')
  if [ -z "$id" ]; then echo "No ruleset named develop. Import .github/rulesets/develop.json first."; exit 1; fi
  local app
  app=$(gh api "$R/rulesets" --jq '.[].id' | while read -r r; do
    gh api "$R/rulesets/$r" --jq '.bypass_actors[]? | select(.actor_type == "Integration") | .actor_id'
  done | sort -u)
  if [ "$(wc -w <<< "$app")" -ne 1 ]; then
    echo "Expected one app on the other rulesets' bypass lists, found: ${app:-none}. Add lede-release to the develop"
    echo "ruleset by hand (Bypass list → Add bypass → Apps), then run this again."
    exit 1
  fi
  gh api "$R/rulesets/$id" |
    jq --argjson app "$app" '{name, target, enforcement, conditions, rules,
      bypass_actors: ([.bypass_actors[]? | select(.actor_type != "Integration")] + [{actor_id: $app, actor_type: "Integration", bypass_mode: "always"}])}' |
    gh api -X PUT "$R/rulesets/$id" --input - --jq '"bypass: \(.bypass_actors | map(.actor_type) | join(", "))"'

  say 'Merge buttons: no rebase, auto-merge on, suggest updating branches'
  gh api -X PATCH "$R" -F allow_rebase_merge=false -F allow_auto_merge=true -F allow_update_branch=true \
    --jq '{allow_merge_commit, allow_squash_merge, allow_rebase_merge, allow_auto_merge, allow_update_branch}'

  say 'Environments'
  environment release main
  environment release-app main develop
  environment preview develop

  say "Secrets: the release app's key, in release-app and release"
  echo "Make a new key on the app's page (Settings → Developer settings → GitHub Apps → lede-release → Generate a"
  echo "private key); the old one keeps working until you delete it there."
  local pem
  read -r -p 'Path to the .pem: ' pem
  gh secret set RELEASE_APP_PRIVATE_KEY --repo "$REPO" --env release-app < "$pem"
  gh secret set RELEASE_APP_PRIVATE_KEY --repo "$REPO" --env release < "$pem"
  echo "Set. Delete $pem once the next release has gone through."

  say 'Secrets: the preview'
  echo "Make a Cloudflare API token for the preview alone (My Profile → API Tokens → Create token): Account → Workers"
  echo "Scripts: Edit, and Zone → Workers Routes: Edit on the preview host's zone. No R2."
  gh secret set CLOUDFLARE_API_TOKEN --repo "$REPO" --env preview
  echo "The account ID is on the Cloudflare dashboard's Overview, or in \`npx wrangler whoami\`."
  gh secret set CLOUDFLARE_ACCOUNT_ID --repo "$REPO" --env preview

  say 'Actions: read-only token, no pull requests from it, approval for outside contributors'
  gh api -X PUT "$R/actions/permissions/workflow" -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
  gh api -X PUT "$R/actions/permissions/fork-pr-contributor-approval" -f approval_policy=all_external_contributors

  say 'Code security: secret scanning, push protection, Dependabot alerts, private vulnerability reporting'
  jq -n '{security_and_analysis: {secret_scanning: {status: "enabled"}, secret_scanning_push_protection: {status: "enabled"}}}' |
    gh api -X PATCH "$R" --input - > /dev/null
  gh api -X PUT "$R/vulnerability-alerts"
  gh api -X PUT "$R/private-vulnerability-reporting"

  say 'Done. Tell the thread, and run `after` once the workflow change is on develop.'
}

after() {
  say 'Drop the repository copy of the release app key'
  gh secret delete RELEASE_APP_PRIVATE_KEY --repo "$REPO" || echo 'Already gone.'
  say 'cloudflare admits main and v* tags only'
  environment cloudflare main 'v*'
}

check() {
  say 'Merge buttons'
  gh api "$R" --jq '{allow_merge_commit, allow_squash_merge, allow_rebase_merge, allow_auto_merge, allow_update_branch, delete_branch_on_merge}'
  say 'Rulesets'
  gh api "$R/rulesets" --jq '.[].id' | while read -r r; do
    gh api "$R/rulesets/$r" --jq '"\(.name): \([.rules[].type] | join(", ")); bypass \([.bypass_actors[]? | .actor_type] | join(", "))"'
  done
  say 'Environments'
  for e in release release-app preview cloudflare; do
    printf '%s: ' "$e"
    gh api "$R/environments/$e/deployment-branch-policies" --jq '[.branch_policies[].name] | join(", ")' 2>/dev/null || echo 'missing'
    gh api "$R/environments/$e/secrets" --jq '"  secrets: \([.secrets[].name] | join(", "))"' 2>/dev/null || true
  done
  say 'Repository secrets'
  gh secret list --repo "$REPO"
  say 'Actions'
  gh api "$R/actions/permissions/workflow"
}

case ${1:-} in
  before | after | check) "$1" ;;
  *) sed -n '2,10p' "$0"; exit 1 ;;
esac
