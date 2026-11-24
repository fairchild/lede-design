#!/usr/bin/env bash
# What the smoke tests check a deployed site against, read from the build in dist/: the entry script dist/index.html
# names, and the sha256 of the registry index and llms.txt. Prints them as key=value lines for $GITHUB_OUTPUT.
set -euo pipefail
entry=$(grep -o 'src="/assets/[^"]*\.js"' dist/index.html | head -n1 | sed 's/^src="//; s/"$//') || true
if [ -z "$entry" ]; then
  echo "::error::dist/index.html names no entry script under /assets/." >&2
  exit 1
fi
echo "entry=$entry"
echo "registry=$(sha256sum dist/r/registry.json | cut -d' ' -f1)"
echo "llms=$(sha256sum dist/llms.txt | cut -d' ' -f1)"
