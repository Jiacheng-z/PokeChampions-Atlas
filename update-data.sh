#!/bin/zsh
set -euo pipefail
ROOT="${0:A:h}"
export POKEMONCH_ROOT="$ROOT"
export POKEMONCH_ARGS="$*"
if [[ " $* " == *" --validate-only "* ]]; then
  exec node "$ROOT/scripts/validate-dataset.mjs" "$ROOT"
fi
ROOT_JSON="$(printf '%s' "$ROOT" | node -e 'process.stdin.on("data",d=>process.stdout.write(JSON.stringify(d.toString())))')"
ARGS_JSON="$(printf '%s' "$*" | node -e 'process.stdin.on("data",d=>process.stdout.write(JSON.stringify(d.toString())))')"
{
  printf 'globalThis.POKEMONCH_ROOT=%s;\n' "$ROOT_JSON"
  printf 'globalThis.POKEMONCH_ARGS=%s;\n' "$ARGS_JSON"
  cat "$ROOT/scripts/update-opgg.mjs"
} | ego-browser nodejs
