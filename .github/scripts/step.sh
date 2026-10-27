#!/usr/bin/env bash
# Runs a CI step and, if it fails, publishes the tail of its output as an
# annotation so the failure is readable from the run summary.
#   step.sh "<title>" <command...>
set -o pipefail
title="$1"; shift
log="$(mktemp)"
"$@" 2>&1 | tee "$log"
status=${PIPESTATUS[0]}
body="$(tail -n "${STEP_TAIL:-60}" "$log" | sed -e 's/\x1b\[[0-9;]*m//g' | sed -e 's/%/%25/g' | awk 'BEGIN{ORS="%0A"} {print}')"
if [ "$status" -ne 0 ]; then
  echo "::error title=${title}::${body}"
elif [ -n "${STEP_NOTICE:-}" ]; then
  # Successful step whose result is worth reading from the run summary.
  echo "::notice title=${title}::${body}"
fi
exit "$status"
