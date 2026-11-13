#!/usr/bin/env bash
# Puts a pull request's docs site and example apps on a public Preview URL of the lede-design Worker.
# Usage: scripts/preview-pr.sh <pr-number> [--comment] [--dry-run] [--delete]
#   --comment  posts the URL on the pull request, or edits the comment an earlier run posted
#   --dry-run  builds everything, then prints the upload command in place of running it
#   --delete   deletes the Preview and this script's worktree for the pull request
set -euo pipefail

repo=fairchild/lede-design
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
    *[!0-9]* | '') usage 1 >&2 ;;
    *) n=$arg ;;
  esac
done
[[ -n $n ]] || usage 1 >&2

root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
wt=$HOME/.worktrees/lede/preview-pr-$n
name=pr-$n
version=$(jq -r .devDependencies.wrangler "$root/package.json")
wrangler() { npx --yes "wrangler@$version" "$@" </dev/null; }

# The build runs the pull request's code, so it gets no Cloudflare credentials from the environment.
build_env() { env -u NODE_ENV -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID -u VITE_CHAT_API "$@" </dev/null; }

check_account() {
  if [[ -n ${CLOUDFLARE_API_TOKEN:-} ]]; then echo 'Credentials: CLOUDFLARE_API_TOKEN'
  else echo 'Credentials: wrangler login'; fi
  local id
  id=$(cd "$root" && wrangler whoami --json | jq -r --arg a "$account_name" '[.accounts[]? | select(.name == $a) | .id][0] // empty') ||
    die 'wrangler whoami failed. Run npx wrangler login, or set CLOUDFLARE_API_TOKEN.'
  [[ -n $id ]] || die "these credentials can't see the account \"$account_name\". A token also needs Account Settings: Read to list it."
  [[ -z ${CLOUDFLARE_ACCOUNT_ID:-} || $CLOUDFLARE_ACCOUNT_ID == "$id" ]] ||
    die "CLOUDFLARE_ACCOUNT_ID names another account. Unset it; the script uses \"$account_name\"."
  export CLOUDFLARE_ACCOUNT_ID=$id
  echo "Account: $account_name"
}

# Posts the body under the marker, or edits the comment that already carries it.
post_comment() {
  local body="$marker"$'\n'"$1" id
  id=$(gh api "repos/$repo/issues/$n/comments" --paginate \
    --jq "[.[] | select(.body | startswith(\"$marker\")) | .id][0] // empty" | head -n 1)
  if [[ -n $id ]]; then gh api -X PATCH "repos/$repo/issues/comments/$id" -f body="$body" --jq .html_url
  else gh api "repos/$repo/issues/$n/comments" -f body="$body" --jq .html_url; fi
}

pr=$(gh pr view "$n" -R "$repo" --json state,isCrossRepository,headRepository,headRepositoryOwner,headRefOid) ||
  die "can't read pull request #$n"
head_repo=$(jq -r '"\(.headRepositoryOwner.login)/\(.headRepository.name)"' <<<"$pr")
[[ $(jq -r .isCrossRepository <<<"$pr") == false && $head_repo == "$repo" ]] ||
  die "#$n comes from $head_repo. Previews build branches of $repo only."

if $delete; then
  check_account
  if $dry_run; then echo "Would run: wrangler preview delete --name $name --skip-confirmation"; exit; fi
  (cd "$root" && wrangler preview delete --name "$name" --skip-confirmation)
  ! git -C "$root" worktree list --porcelain | grep -qxF "worktree $wt" || git -C "$root" worktree remove --force "$wt"
  ! $comment || post_comment "The preview of this pull request was deleted."
  exit
fi

[[ $(jq -r .state <<<"$pr") == OPEN ]] || die "#$n isn't open"
sha=$(jq -r .headRefOid <<<"$pr")
check_account

git -C "$root" fetch --quiet origin "refs/pull/$n/head"
[[ $(git -C "$root" rev-parse FETCH_HEAD) == "$sha" ]] || die "origin's head for #$n isn't ${sha::7}; try again"
if git -C "$root" worktree list --porcelain | grep -qxF "worktree $wt"; then
  git -C "$wt" checkout --quiet --force --detach "$sha"
  git -C "$wt" clean --quiet -fdx
else
  git -C "$root" worktree add --quiet --detach "$wt" "$sha"
fi
echo "Building #$n at ${sha::7} in $wt"

cd "$wt"
build_env npm ci
build_env npm run build
for app in "${apps[@]}"; do
  (cd "integrations/$app" && build_env npm ci && build_env npm run build -- --base="/examples/$app/")
  mkdir -p "dist/examples/$app"
  cp -R "integrations/$app/dist/." "dist/examples/$app/"
done

# The Worker code is the pull request's; its settings and bindings come from this checkout's wrangler.jsonc.
if ! cmp -s "$root/wrangler.jsonc" wrangler.jsonc; then
  echo "Note: #$n's wrangler.jsonc differs from $root/wrangler.jsonc. The preview uses the second."
  cp "$root/wrangler.jsonc" wrangler.jsonc
fi

upload=(preview --name "$name" --message "PR #$n at ${sha::7}" --ignore-base-config --json)
if $dry_run; then
  echo "Would run in $wt: wrangler$(printf ' %q' "${upload[@]}")"
  ! $comment || echo "Would post or edit the comment marked $marker on #$n"
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
