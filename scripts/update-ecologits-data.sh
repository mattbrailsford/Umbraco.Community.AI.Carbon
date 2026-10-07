#!/bin/bash
# Downloads the EcoLogits reference data (models.json, electricity_mixes.json) for a given tag
# into the Core project's embedded Data/EcoLogits folder.
# Usage: ./scripts/update-ecologits-data.sh [tag]   (default: 0.11.2)
set -euo pipefail

TAG="${1:-0.11.2}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/src/Umbraco.Community.AI.Carbon.Core/Data/EcoLogits"
BASE="https://raw.githubusercontent.com/mlco2/ecologits/$TAG/ecologits/data"

mkdir -p "$DEST"
for file in models.json electricity_mixes.json; do
  echo "Downloading $file from EcoLogits $TAG"
  curl -fsSL "$BASE/$file" -o "$DEST/$file"
done

echo
echo "Done. Now:"
echo "  1. Update DataVersion in EcoLogitsDataRepository.cs to $TAG"
echo "  2. Update Data/EcoLogits/NOTICE.md and THIRD-PARTY-NOTICES.md to $TAG"
echo "  3. Recheck EcoLogitsProviderConfigs.cs against ecologits/tracers/utils.py at tag $TAG"
