# Downloads the EcoLogits reference data (models.json, electricity_mixes.json) for a given tag
# into the Core project's embedded Data/EcoLogits folder.
# Usage: ./scripts/update-ecologits-data.ps1 [-Tag 0.11.2]
param(
    [string]$Tag = "0.11.2"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root "src/Umbraco.Community.AI.Carbon.Core/Data/EcoLogits"
$base = "https://raw.githubusercontent.com/mlco2/ecologits/$Tag/ecologits/data"

New-Item -ItemType Directory -Force -Path $dest | Out-Null
foreach ($file in "models.json", "electricity_mixes.json") {
    Write-Host "Downloading $file from EcoLogits $Tag"
    Invoke-WebRequest -UseBasicParsing -Uri "$base/$file" -OutFile (Join-Path $dest $file)
}

Write-Host ""
Write-Host "Done. Now:"
Write-Host "  1. Update DataVersion in EcoLogitsDataRepository.cs to $Tag"
Write-Host "  2. Update Data/EcoLogits/NOTICE.md and THIRD-PARTY-NOTICES.md to $Tag"
Write-Host "  3. Recheck EcoLogitsProviderConfigs.cs against ecologits/tracers/utils.py at tag $Tag"
