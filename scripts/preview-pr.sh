#!/usr/bin/env bash
# Puts a pull request's docs site and example apps on a public Preview URL of the lede-design Worker.
# Usage: scripts/preview-pr.sh <pr-number> [--comment] [--dry-run] [--delete]
#   --comment  posts the URL on the pull request, or edits the comment an earlier run of yours posted
#   --dry-run  builds everything, then prints the upload command in place of running it
#   --delete   deletes the pull request's Preview
set -euo pipefail

repo=fairchild/lede-design
worker=lede-design
account_name='irons in the fire'
apps=(json-render json-render-chat json-render-chat-plain)
marker='<!-- preview -->'

usage() { sed -n '3,6s/^# \{0,1\}//p' "$0"; exit "${1:-0}"; }
die() { echo "preview-pr: $*" >&2; exit 1; }

n='' comment=false dry_run=false delete=false
for arg in "$@"; do
  case $arg in
    --comment) comment=true ;;
    --dry-run) dry_run=true ;;
    --delete) delete=true ;;
    -h | --help) usage ;;
    [1-9] | [1-9]*[0-9]) [[ -z $n && $arg != *[!0-9]* ]] || usage 1 >&2; n=$arg ;;
    *) usage 1 >&2 ;;
  esac
done
[[ -n $n ]] || usage 1 >&2

root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
name=pr-$n
bin=$root/node_modules/.bin/wrangler
[[ -x $bin ]] || die "no wrangler in $root/node_modules. Run npm ci there first."

# Credentials are read once, here. Every Cloudflare and Wrangler variable is then cleared: the build runs the pull
# request's code with none of them, and wrangler gets back only the token and the checked account.
[[ -z ${CLOUDFLARE_API_KEY:-}${CF_API_KEY:-} ]] ||
  die 'a global API key is set (CLOUDFLARE_API_KEY or CF_API_KEY), and wrangler prefers it to a token. Unset it.'
token=${CLOUDFLARE_API_TOKEN:-${CF_API_TOKEN:-}}
if [[ -n ${CLOUDFLARE_API_TOKEN:-} ]]; then cred=CLOUDFLARE_API_TOKEN
elif [[ -n ${CF_API_TOKEN:-} ]]; then cred=CF_API_TOKEN
else cred='wrangler login'; fi
preset=("${CLOUDFLARE_ACCOUNT_ID:-}" "${CF_ACCOUNT_ID:-}")
clear=(-u NODE_ENV -u VITE_CHAT_API)
while IFS= read -r var; do clear+=(-u "$var"); done < <(compgen -e | grep -E '^(CLOUDFLARE|CF|WRANGLER)_' || true)
build_env() { env "${clear[@]}" "$@" </dev/null; }

# Wrangler runs from a directory of the script's own, with the config named outright, so nothing the pull request
# carries (wrangler.json, a config redirect, .env) reaches it.
cfg_dir=$(mktemp -d "${TMPDIR:-/tmp}/lede-preview-config.XXXXXX")
cfg=$cfg_dir/wrangler.jsonc
wt=''
cleanup() {
  cd "$root"
  [[ -z $wt ]] || git -C "$root" worktree remove --force "$wt" 2>/dev/null || rm -rf "$wt"
  rm -rf "$cfg_dir"
}
trap cleanup EXIT
account=''
wrangler() {
  local vars=()
  [[ -z $token ]] || vars+=("CLOUDFLARE_API_TOKEN=$token")
  [[ -z $account ]] || vars+=("CLOUDFLARE_ACCOUNT_ID=$account")
  (cd "$cfg_dir" && env "${clear[@]}" ${vars[@]+"${vars[@]}"} "$bin" "$@" --config "$cfg" </dev/null)
}

check_account() {
  echo "Credentials: $cred"
  ! grep -q '"account_id"' "$cfg" || die "the config names an account_id. The script uses \"$account_name\" alone."
  local id
  id=$(wrangler whoami --json | jq -r --arg a "$account_name" '[.accounts[]? | select(.name == $a) | .id][0] // empty') ||
    die 'wrangler whoami failed. Run npx wrangler login, or set CLOUDFLARE_API_TOKEN.'
  [[ -n $id ]] || die "these credentials can't see the account \"$account_name\". A token also needs Account Settings: Read to list it."
  for p in "${preset[@]}"; do
    [[ -z $p || $p == "$id" ]] || die "CLOUDFLARE_ACCOUNT_ID or CF_ACCOUNT_ID names another account. Unset it."
  done
  account=$id
  echo "Account: $account_name"
}

# Posts the body under the marker, or edits the comment of yours that already carries it.
post_comment() {
  local body="$marker"$'\n'"$1" me id
  me=$(gh api user --jq .login)
  id=$(gh api "repos/$repo/issues/$n/comments" --paginate \
    --jq "[.[] | select(.user.login == \"$me\" and (.body | startswith(\"$marker\"))) | .id][0] // empty" | head -n 1)
  if [[ -n $id ]]; then gh api -X PATCH "repos/$repo/issues/comments/$id" -f body="$body" --jq .html_url
  else gh api "repos/$repo/issues/$n/comments" -f body="$body" --jq .html_url; fi
}

pr=$(gh pr view "$n" -R "$repo" --json state,isCrossRepository,headRepository,headRepositoryOwner,headRefOid) ||
  die "can't read pull request #$n"
head_repo=$(jq -r '"\(.headRepositoryOwner.login)/\(.headRepository.name)"' <<<"$pr")
[[ $(jq -r .isCrossRepository <<<"$pr") == false && $head_repo == "$repo" ]] ||
  die "#$n comes from $head_repo. Previews build branches of $repo only."

if $delete; then
  printf '{ "name": "%s", "compatibility_date": "2026-11-01" }\n' "$worker" >"$cfg"
  check_account
  if $dry_run; then echo "Would run: wrangler preview delete --name $name --skip-confirmation --config $cfg"; exit; fi
  wrangler preview delete --name "$name" --skip-confirmation
  ! $comment || post_comment "The preview of this pull request was deleted."
  exit
fi

[[ $(jq -r .state <<<"$pr") == OPEN ]] || die "#$n isn't open"
sha=$(jq -r .headRefOid <<<"$pr")
git -C "$root" fetch --quiet origin main "refs/pull/$n/head"
git -C "$root" cat-file -e "$sha^{commit}" 2>/dev/null || die "origin has no commit ${sha::7} for #$n; try again"

# A fresh worktree for each run, removed on exit, so runs never share or reset a directory.
mkdir -p "$HOME/.worktrees/lede"
wt=$(mktemp -d "$HOME/.worktrees/lede/preview-pr-$n.XXXXXX")
git -C "$root" worktree add --quiet --detach "$wt" "$sha"

# Settings and bindings come from main's wrangler.jsonc; the Worker code and the site are the pull request's.
git -C "$root" show origin/main:wrangler.jsonc |
  sed -e "s|\"main\": \"worker/index.ts\"|\"main\": \"$wt/worker/index.ts\"|" \
      -e "s|\"directory\": \"./dist\"|\"directory\": \"$wt/dist\"|" >"$cfg"
if ! grep -qF "\"main\": \"$wt/" "$cfg" || ! grep -qF "\"directory\": \"$wt/dist\"" "$cfg"; then
  die "main's wrangler.jsonc no longer has the main and assets paths this script rewrites"
fi
grep -q '"previews"' "$cfg" || echo "Note: main's wrangler.jsonc has no previews block, so the preview has no R2 binding."
check_account

echo "Building #$n at ${sha::7} in $wt"
cd "$wt"
build_env npm ci
build_env npm run build
for app in "${apps[@]}"; do
  (cd "integrations/$app" && build_env npm ci && build_env npm run build -- --base="/examples/$app/")
  mkdir -p "dist/examples/$app"
  cp -R "integrations/$app/dist/." "dist/examples/$app/"
done

upload=(preview --name "$name" --message "PR #$n at ${sha::7}" --ignore-base-config --json)
if $dry_run; then
  echo "Would run in $cfg_dir: wrangler$(printf ' %q' "${upload[@]}") --config $cfg"
  ! $comment || echo "Would post or edit your comment marked $marker on #$n"
  exit
fi

out=$(wrangler "${upload[@]}")
url=$(jq -r '[.. | strings | select(test("^https://[^ ]+workers\\.dev"))][0] // empty' <<<"$out")
[[ -n $url ]] || die "wrangler reported no URL. Its output: $out"
url=${url%/}
echo "Preview: $url"

if $comment; then
  examples=$(for app in "${apps[@]}"; do echo "- $url/examples/$app/"; done)
  post_comment "Preview of ${sha::7}: $url

Example apps:
$examples

Registry: \`npx shadcn@latest registry add '@lede=$url/r/{name}.json'\`"
fi
