# Shared GlitchTip evidence and resolution contract

Used by isolated issue delivery, inline inbox fixes and GitHub-backed error tracking.
The calling adapter selects the work and owns GlitchTip writes; implementation and shipping
workers never resolve errors. Read this contract before API access, not just at closure.

## Configuration and transport

Use exported `GLITCHTIP_URL`, `GLITCHTIP_TOKEN`, `GLITCHTIP_ORG`; fill missing values from
the project's `.env`, then `~/.agents/.env`, without sourcing or printing files. Require real
values; example domains and organizations are never defaults. API base is `<URL>/api/0`.
Use Bearer authentication and verify access with read-only `GET /projects/`.

Verify the actual project/environment against the request. Multiple plausible projects require
a choice. Read issue details at `/issues/<id>/` and events at `/issues/<id>/events/latest/`;
list candidates through `/projects/<org>/<project>/issues/`. Inspect pagination and state any
candidate limit; an empty filtered page is not proof that the entire inbox is empty.

Use supported transport and inspect HTTP status/response shape. A documented Cloudflare
403/1010 rejection of Python may justify curl; a 403 alone does not prove that cause.
Build JSON through serialization, never interpolate event messages into shell payloads.
Temporary sensitive files need a unique private directory, restrictive permissions and prompt
cleanup. Never retain shared `/tmp/gt-*.json` dumps or print credentials.

## Evidence retained in task state

Keep only sanitized issue IDs/permalinks, exception type/normalized message, culprit/in-app
frames, root cause, project/environment/release and acceptance criteria. Exclude identities,
raw requests, headers and private breadcrumbs. Reuse current analysis; do not refetch events
merely because the next skill started.

Cluster only a demonstrated shared cause with a regression criterion covering each member.
Matching titles alone are insufficient. Keep environments/projects separate, name covered
and rejected IDs, and remove an ID from the PR's claim if its behavior is not verified.
Low severity, bot traffic or a sparse event stream does not by itself establish harmless noise.

## Resolution gate

| Evidence | GlitchTip outcome |
|---|---|
| `pr_created`, draft, failed checks, unknown cause or incomplete coverage | Keep unresolved |
| GitHub confirms `MERGED`, deployment unknown | Keep unresolved; report deployment verification pending |
| Covered fix deployed in the affected environment and regression verified | Resolve only when authorized |
| `already_done` / stale signal | Require deployed-release evidence proving the reported behavior is no longer active |
| Proven noise | Explain evidence and obtain agreement before resolving or suppressing |

`--no-resolve` or `--no-merge` forbids all GlitchTip writes, including comments. A return from
another skill is never merge or deployment evidence. Verify the explicit PR through `gh`
and record release/environment plus the regression evidence before closing a code-related error.
If runtime observation was used, record its time window and representative traffic; absence
of new events alone is not proof. Missing evidence leaves the error open.

Fix-and-deliver intent can authorize resolution after this gate. It does not authorize a new
deployment, recurring observation, suppression policy or future monitoring by itself.

For each covered authorized ID, send serialized `{"status":"resolved"}` to `/issues/<id>/`
and check the HTTP response plus returned state. Use the deployment's supported update method;
on a documented PUT 405, retry PATCH. Never use a project-scoped issue mutation URL.
Add a sanitized root-cause/PR/release comment when supported. A missing comment endpoint does
not undo a successful status update: report status and comment outcomes separately.

Return code status, deployment evidence, actual GlitchTip state and the next action for every
selected cluster. Report inbox totals only when supplied by the API or actually measured.
