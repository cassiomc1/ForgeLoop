#!/usr/bin/env sh
set -eu

: "${FORGELOOP_REVISION_PROVIDER:=git}"
: "${FORGELOOP_BASE_REVISION:?FORGELOOP_BASE_REVISION is required}"
: "${FORGELOOP_HEAD_REVISION:?FORGELOOP_HEAD_REVISION is required}"

exec forgeloop attestation-verify-range \
  --revision-provider "$FORGELOOP_REVISION_PROVIDER" \
  --base "$FORGELOOP_BASE_REVISION" \
  --head "$FORGELOOP_HEAD_REVISION" \
  --require-complete-coverage \
  --json \
  "$@"
