#!/bin/bash
# Moves the pinned EcoLogits version to a new upstream tag: downloads the data files and rewrites
# every place that names the pinned version. Used by .github/workflows/ecologits-sync.yml, and safe
# to run by hand.
#
# Usage: ./scripts/bump-ecologits-version.sh <new-tag>
# Env:   SKIP_DOWNLOAD=1  only rewrite the version references (no network; for testing)
#
# The single source of truth for the current version is DataVersion in EcoLogitsDataRepository.cs.
# NOT touched on purpose (a human must re-port and re-verify them against the new tag):
#   - the headers of EcoLogitsProviderConfigs.cs and CarbonFactorCalculator.cs
#   - the "Reference values from EcoLogits x.y.z" comments in CarbonFactorCalculatorTests.cs
#   - docs/plans/** (history)
set -euo pipefail

NEW="${1:?Usage: $0 <new-tag> (for example 0.12.0)}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORE="src/Umbraco.Community.AI.Carbon.Core"
REPO_FILE="$ROOT/$CORE/EcoLogits/EcoLogitsDataRepository.cs"

[[ "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Tag must look like 1.2.3, got '$NEW'" >&2; exit 1; }

OLD="$(sed -n 's/.*DataVersion => "\([^"]*\)".*/\1/p' "$REPO_FILE")"
[[ -n "$OLD" ]] || { echo "Could not read DataVersion from $REPO_FILE" >&2; exit 1; }

if [[ "$OLD" == "$NEW" ]]; then
  echo "Already pinned to $NEW; nothing to rewrite."
else
  # Every file that names the pinned version as text. perl -pi behaves the same on macOS and Linux.
  FILES=(
    "$CORE/EcoLogits/EcoLogitsDataRepository.cs"
    "$CORE/Data/EcoLogits/NOTICE.md"
    "$CORE/Umbraco.Community.AI.Carbon.Core.csproj"
    "THIRD-PARTY-NOTICES.md"
    "README.md"
    "scripts/update-ecologits-data.sh"
    "scripts/update-ecologits-data.ps1"
    "tests/Umbraco.Test.AI.Carbon.Unit/EcoLogits/EcoLogitsDataRepositoryTests.cs"
    "tests/Umbraco.Test.AI.Carbon.Integration/EstimateEndpointTests.cs"
  )
  export OLD NEW
  for f in "${FILES[@]}"; do
    [[ -f "$ROOT/$f" ]] || { echo "Missing expected file: $f" >&2; exit 1; }
    # Match whole versions only: 0.1.2 must not match inside 10.1.2 or 0.1.23 (or 0.1.2.4).
    perl -pi -e 's/(?<![\d.])\Q$ENV{OLD}\E(?!\d|\.\d)/$ENV{NEW}/g' "$ROOT/$f"
  done
  echo "Rewrote version references $OLD -> $NEW in ${#FILES[@]} files."
fi

if [[ "${SKIP_DOWNLOAD:-}" != "1" ]]; then
  "$ROOT/scripts/update-ecologits-data.sh" "$NEW" > /dev/null
  echo "Downloaded EcoLogits $NEW data files."
fi

echo "Still to do by hand: re-port EcoLogitsProviderConfigs.cs / CarbonFactorCalculator.cs if upstream changed, and update their headers."
