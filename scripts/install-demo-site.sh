#!/bin/bash
# Demo Site Setup Script
# Generates a disposable Umbraco demo site (in the gitignored demos/ folder) that
# installs Umbraco.AI from NuGet and project-references the local Umbraco.Community.AI.Carbon
# meta-package, so the CO2 dashboard can read real Umbraco.AI usage data. Mirrors the
# Umbraco.AI demo-site approach.

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &>/dev/null && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/.." &>/dev/null && pwd )"
cd "$REPO_ROOT" || exit 1

SKIP_TEMPLATE_INSTALL=false
FORCE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-template-install|-s) SKIP_TEMPLATE_INSTALL=true; shift ;;
        --force|-f) FORCE=true; shift ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo "  -s, --skip-template-install  Skip reinstalling Umbraco.Templates"
            echo "  -f, --force                  Recreate the demo if it already exists"
            echo "  -h, --help                   Show this help"
            exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo "========================================="
echo "Umbraco.Community.AI.Carbon Demo Site Setup"
echo "========================================="

# Detect target CMS major from the lower bound of the Umbraco.Cms range in Directory.Packages.props
PACKAGES_PROPS_PATH="$REPO_ROOT/Directory.Packages.props"
TEMPLATE_VERSION=$(grep -oE 'Include="Umbraco\.Cms" Version="\[[^,]+,' "$PACKAGES_PROPS_PATH" | grep -oE '\[[^,]+,' | tr -d '[,')
if [ -z "$TEMPLATE_VERSION" ]; then
    echo "ERROR: Could not find Umbraco.Cms version range in $PACKAGES_PROPS_PATH" >&2
    exit 1
fi
VERSION_MAJOR=$(echo "$TEMPLATE_VERSION" | cut -d. -f1)
echo "Target Umbraco.Cms template version: $TEMPLATE_VERSION (v$VERSION_MAJOR)"

DEMO_DIR="demos/v${VERSION_MAJOR}"
DEMO_SITE_DIR="${DEMO_DIR}/Umbraco.Community.AI.Carbon.DemoSite"
LOCAL_SLN="Umbraco.Community.AI.Carbon.local.slnx"

if [ -d "$DEMO_DIR" ] && [ "$FORCE" = false ]; then
    echo "Demo folder '$DEMO_DIR' already exists. Use --force to recreate."
    exit 0
fi
if [ "$FORCE" = true ]; then
    rm -rf "$DEMO_DIR"
    rm -f "$LOCAL_SLN"
fi

# Clean starter kit major does not track the CMS major — map explicitly.
case "$VERSION_MAJOR" in
    17) CLEAN_VERSION="7.*" ;;
    18) CLEAN_VERSION="8.*" ;;
    *)  CLEAN_VERSION="" ;;
esac

# Step 1: Umbraco templates
if [ "$SKIP_TEMPLATE_INSTALL" = false ]; then
    echo "Installing Umbraco.Templates ($TEMPLATE_VERSION)..."
    dotnet new uninstall Umbraco.Templates >/dev/null 2>&1 || true
    dotnet new install "Umbraco.Templates::${TEMPLATE_VERSION}" --force
fi

# Step 2: Demo folder + overrides (disable CPM / package validation for the generated site)
echo "Creating demo folder '$DEMO_DIR'..."
mkdir -p "$DEMO_DIR"
cp "$SCRIPT_DIR/templates/Directory.Build.props" "$DEMO_DIR/Directory.Build.props"
cp "$SCRIPT_DIR/templates/Directory.Packages.props" "$DEMO_DIR/Directory.Packages.props"

# Step 3: Scaffold the Umbraco site
echo "Creating Umbraco demo site..."
pushd "$DEMO_DIR" > /dev/null
dotnet new umbraco --force -n "Umbraco.Community.AI.Carbon.DemoSite" \
    --friendly-name "Administrator" --email "admin@example.com" --password "password1234" \
    --development-database-type SQLite
popd > /dev/null

# Step 3.1: Launch profile (port comes from Umbraco.Community.WorktreeDevPort)
mkdir -p "$DEMO_SITE_DIR/Properties"
cp "$SCRIPT_DIR/templates/launchSettings.json" "$DEMO_SITE_DIR/Properties/launchSettings.json"

# Step 3.1.1: Stable per-worktree dev port (no fixed port in launchSettings.json)
echo "Adding Umbraco.Community.WorktreeDevPort for a stable per-worktree dev port..."
pushd "$DEMO_SITE_DIR" > /dev/null
dotnet add package Umbraco.Community.WorktreeDevPort
popd > /dev/null

# Step 3.2: Clean starter kit
pushd "$DEMO_SITE_DIR" > /dev/null
if [ -n "$CLEAN_VERSION" ]; then
    echo "Installing Clean starter kit ($CLEAN_VERSION)..."
    dotnet add package Clean --version "$CLEAN_VERSION"
else
    echo "Warning: no Clean version mapping for v$VERSION_MAJOR; installing latest stable."
    dotnet add package Clean
fi
popd > /dev/null

# Step 4: Umbraco.AI from NuGet (same CMS major), then the local package meta-project
echo "Adding Umbraco.AI (v$VERSION_MAJOR.*)..."
dotnet add "$DEMO_SITE_DIR/Umbraco.Community.AI.Carbon.DemoSite.csproj" package Umbraco.AI --version "$VERSION_MAJOR.*"
echo "Adding project reference to Umbraco.Community.AI.Carbon..."
dotnet add "$DEMO_SITE_DIR/Umbraco.Community.AI.Carbon.DemoSite.csproj" reference \
    "src/Umbraco.Community.AI.Carbon/Umbraco.Community.AI.Carbon.csproj"

# Step 5: Local dev solution (gitignored) tying the package + demo site together
echo "Creating local solution '$LOCAL_SLN'..."
dotnet new sln -n "Umbraco.Community.AI.Carbon.local" --format slnx --force > /dev/null
dotnet sln "$LOCAL_SLN" add \
    "src/Umbraco.Community.AI.Carbon.Core/Umbraco.Community.AI.Carbon.Core.csproj" \
    "src/Umbraco.Community.AI.Carbon.Web/Umbraco.Community.AI.Carbon.Web.csproj" \
    "src/Umbraco.Community.AI.Carbon.Web.StaticAssets/Umbraco.Community.AI.Carbon.Web.StaticAssets.csproj" \
    "src/Umbraco.Community.AI.Carbon/Umbraco.Community.AI.Carbon.csproj" \
    "tests/Umbraco.Test.AI.Carbon.Unit/Umbraco.Test.AI.Carbon.Unit.csproj" \
    "tests/Umbraco.Test.AI.Carbon.Integration/Umbraco.Test.AI.Carbon.Integration.csproj" \
    "$DEMO_SITE_DIR/Umbraco.Community.AI.Carbon.DemoSite.csproj" > /dev/null
dotnet sln "$LOCAL_SLN" add \
    "src/Umbraco.Community.AI.Carbon.Core/Umbraco.Community.AI.Carbon.Core.csproj" \
    "tests/Umbraco.Test.AI.Carbon.Unit/Umbraco.Test.AI.Carbon.Unit.csproj" \
    "tests/Umbraco.Test.AI.Carbon.Integration/Umbraco.Test.AI.Carbon.Integration.csproj" \
    "$DEMO_SITE_DIR/Umbraco.Community.AI.Carbon.DemoSite.csproj" > /dev/null

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo "Solution:  $LOCAL_SLN"
echo "Demo site: $DEMO_SITE_DIR"
echo "Login:     admin@example.com / password1234"
echo ""
echo "Next: open $LOCAL_SLN, build, and run Umbraco.Community.AI.Carbon.DemoSite"
