# Local skill intake

This is the intake boundary between a personal `~/.agents/skills` installation and the reusable
catalogue. A local skill is not distributable merely because it works on one workstation.

## Current local-only skills

| Skill | Disposition | Reason and next step |
|---|---|---|
| `ci-experts` | Keep private pending review | Its Vercel deployment API procedure needs ownership and provider-scope review. |
| `ci-fixer` | Keep private pending provenance | It is useful, but its paired workflow has no recorded source or license. |
| `claude-memory` | Do not import as PeakLab-owned | It is locked to `Melvynx/aiblueprint`; retain it as a pinned third-party package. |
| `coolify-create-project` | Keep in private add-on | It reads personal/global environment locations and an untracked service registry. |
| `coolify-deploy` | Keep in private add-on | It depends on populated app UUIDs, domains and registry aliases. |
| `coolify-server-update` | Keep in private add-on | It contains organization server/SSH-key recovery procedures. |
| `create-agent-skills` | Candidate after provenance review | General purpose, but its ownership/license is not recorded. |
| `debug-ccli` | Keep personal | It hard-codes local validator log paths under `~/.agents`. |
| `explore` | Candidate after provenance review | General codebase exploration workflow with no recorded source/license. |
| `glitchtip-api` | Keep in private add-on | It names the PeakLab GlitchTip instance and local shell configuration. |
| `optimize-prisma-query` | Accepted into `development` | PeakLab-authored local Git history establishes ownership; its generic workflow was made portable. |
| `peaklab.dns-add` | Keep private or extract configuration first | It is tied to an organization DNS zone and performs mutations. |
| `security-review` | Candidate after provenance review | Its client-facing report workflow needs ownership/license and security-policy review. |

The remaining four candidates may be imported one at a time only after confirming authorship or
upstream license, removing machine assumptions and adding appropriate tests or provenance. The
other eight have a concrete local configuration or service boundary and should remain outside the
public catalogue until refactored into a generic package plus an untracked configuration layer.

## Organization adapters

Do not put populated settings or service identifiers in this catalogue. A shareable replacement for
an organization adapter needs a generic configuration interface, placeholders and a separate private
configuration layer.

## Archived skills

The archived set remains a personal reserve. It is not an inactive backlog to bulk-import. Restore
one only when requested and review provenance first. `grilling` already has an MIT notice in this
catalogue; the other archived packages need their own ownership/provenance decision. `chrome-osascript`
and `peaklab.todo` are excluded from sharing in their current forms because they reference a named
workstation/service or a personal workspace.

## Third-party and system surfaces

System Codex skills and marketplace/plugin caches are installed by their host and are never copied
into this repository. Third-party packages already represented here retain their bundled license and
pinned provenance: `shadcn`, `computer-use`, `orca-cli`, `orchestration` and `frontend-design`.
