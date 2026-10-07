# CLAUDE.md

Umbraco.Community.AI.Carbon: an unofficial community package that adds an estimated CO2 dashboard to the Umbraco.AI Analytics section, based on Umbraco.AI's recorded usage.

## Stack

- Umbraco CMS: 17.x on this line (`Umbraco.Cms*` range `[17.4.0,17.999.999)` in `Directory.Packages.props`; 17.4.0 is the floor Umbraco.AI 17.0.0 itself requires), .NET 10 (`net10.0`). The v18 line is `v18/dev`; lines are maintained independently (no forward-merge).
- OpenAPI: CMS 17 uses Swashbuckle (a `SwaggerGenOptions` document, served at `/umbraco/swagger/<name>/swagger.json`); CMS 18 uses `Microsoft.AspNetCore.OpenApi`. Do not copy the OpenAPI registration across lines.
- Umbraco.AI: `Umbraco.AI.Core` as a NuGet package reference on the same major range. Never a project reference across repos.
- Database: TODO (no persistence yet; decide during `umb-design` whether the package needs any)
- Frontend: Lit + UUI + Vite, in `src/Umbraco.Community.AI.Carbon.Web.StaticAssets/Client/` → `wwwroot/` (served at `App_Plugins/AICarbon`)

## Project layout

Mirrors `Umbraco.Community.ContentChecks` (same author, same conventions):

| Project | Purpose |
|---------|---------|
| `src/Umbraco.Community.AI.Carbon` | Meta-package (what sites install); no code |
| `src/Umbraco.Community.AI.Carbon.Core` | Domain services, composer (`AICarbonComposer`) |
| `src/Umbraco.Community.AI.Carbon.Web` | Management API |
| `src/Umbraco.Community.AI.Carbon.Web.StaticAssets` | Backoffice UI |
| `tests/Umbraco.Test.AI.Carbon.Unit` | NUnit + Moq unit tests |
| `tests/Umbraco.Test.AI.Carbon.Integration` | NUnit + `Umbraco.Cms.Tests.Integration` |

Test projects override `RootNamespace` to `Umbraco.Community.AI.Carbon.Tests.*` to avoid the `Umbraco.Test` vs NUnit `[Test]` clash (CS0616).

## Build & test

```bash
dotnet build Umbraco.Community.AI.Carbon.slnx
dotnet test Umbraco.Community.AI.Carbon.slnx
npm install          # from the repo root (npm workspaces), never inside Client/
npm run build        # frontend → wwwroot/
npm run watch
npm run generate-client   # needs the demo site running (port per worktree: `git wdp-port`)
```

Demo site (gitignored, under `demos/vN/`): `scripts/install-demo-site.sh` / `.ps1`. It installs Umbraco.AI from NuGet and project-references the local meta-package. Login: admin@example.com / password1234. A provider package plus an API key is needed to generate real usage data.

## Feature workflow

This project uses the Umbraco Claude Playbook. Feature plan folders live at:
`docs/plans/<feature-slug>/`

Pipeline: `/umb-explore` → `/umb-design` → `/umb-plan` → `/umb-build-loop`.
Each phase owns its own file in the feature's plan folder (`BRIEF.md`, `ARCHITECTURE.md` +
`SPEC.md`, `STORIES.md` + `PLAN.md`, `BUILD-LOG.md`) — see the playbook's README for the
file-ownership table.

**Branch/worktree per feature:** new features on this line start from `v17/dev` (branch-per-major model:
`vN/dev`, `vN/main`, `vN/feature/<name>`, matching ContentChecks and Umbraco.AI). Plan-folder
files stay uncommitted through `umb-explore`/`umb-design`/`umb-plan`. `umb-build-loop` commits
the plan folder to trunk and cuts the feature's branch/worktree — named after the plan folder —
the moment building actually starts, not before (see `git-workflow`'s "Branch/worktree per
feature" section). No `WorktreeCreate` hook is configured for this project, so `umb-build-loop`
falls back to a plain `git checkout -b v17/feature/<feature-slug>` off trunk.

**Finding the current feature's plan folder:** once a branch/worktree exists for a feature,
its name already carries the feature slug — strip a leading `vN/` and/or `<type>/` prefix (see
`git-workflow`'s branch-naming table) and check whether the plan-folder path above has a
matching `<remainder>/` folder. If it does, that's the current feature — no need to ask which
one. Only fall back to asking when nothing matches (still on trunk, or the branch/worktree name
doesn't correspond to any plan folder).

## Conventions

- Versioning: Nerdbank.GitVersioning (`version.json`); release refs are `(vN/)?main`, `hotfix/`, `release/` and `vN.x.y` tags. Package versions track the Umbraco CMS major (v18 line ships `18.x`, v17 line `17.x`, same package ids). Dotted prerelease identifiers only (`-beta.1`).
- Releasing: bump `version.json` on `vN/dev`, merge to `vN/main`, publish a GitHub Release tagged `vN.x.y` on `vN/main` with hand-written notes. `.github/workflows/release.yml` tests, packs and pushes via NuGet trusted publishing, and fails if the tag does not match the package version or the branch's CMS major, or if the tagged commit is not on `vN/main`. See the README "Releasing" section.
- Central Package Management: versions only in `Directory.Packages.props`; ranges for Umbraco and Umbraco.AI.
- Public wording: figures are always "estimated". Any CO2 claim must say how it is calculated. The README must keep the "unofficial, not Umbraco HQ" notice.
- TODO — more filled in as umb-explore/umb-design surface real decisions.

## Project memory

Two places a decision lives, by scope:
- **Scoped to one directory/module** → a nested `CLAUDE.md` in that directory. Claude reads
  the nearest one walking up from whatever it's editing (`reviewer` does this on every task).
- **Project-wide, but not worth permanently bloating this file** → `.claude/memory/` — one
  file per entry, indexed in `.claude/memory/MEMORY.md`. See `.claude/memory/README.md` for
  the format.
