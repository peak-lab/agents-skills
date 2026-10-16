# Coolify REST — operations MCP does not cover

Base URL: `${COOLIFY_URL}` (for example `https://<host>/api/v1`). Auth: `Authorization: Bearer ${COOLIFY_TOKEN}`.
Token scopes: `read` (GET), `write` (POST/PATCH/DELETE), `deploy` (deployments).
Reads, logs, lifecycle and deployments go through MCP; the live OpenAPI spec lists anything else.

## Environment variables (values)

Same shape under `/applications/{uuid}` and `/services/{uuid}`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `…/envs` | List env vars with values (never print them) |
| POST | `…/envs` | Create env var |
| PATCH | `…/envs` | Update by key (`key`, `value`, `is_preview`) |
| PATCH | `…/envs/bulk` | Bulk update |
| DELETE | `…/envs/{env_uuid}` | Delete env var (confirm first) |

```json
{ "key": "string", "value": "string", "is_buildtime": false, "is_runtime": true, "is_preview": false, "is_multiline": false }
```

## Creation

| Method | Path | Required fields |
|--------|------|-----------------|
| POST | `/projects` | `name` |
| POST | `/projects/{uuid}/environments` | `name` |
| POST | `/applications/public` | `project_uuid`, `server_uuid`, `environment_name`, `git_repository`, `git_branch`, `build_pack`, `ports_exposes` |
| POST | `/applications/{private-github-app,private-deploy-key,dockerfile,dockerimage,dockercompose}` | as above, per source |
| POST | `/databases/{postgresql,mysql,mariadb,mongodb,redis,keydb,dragonfly,clickhouse}` | `project_uuid`, `server_uuid`, `environment_name` |
| POST | `/services` | `project_uuid`, `server_uuid`, `environment_name`; check the instance's API reference for the service source fields |

Validation: `build_pack` ∈ `nixpacks`, `static`, `dockerfile`, `dockercompose`, `dockerimage`;
`ports_exposes` is comma-separated digits (`3000,8080`); `limits_memory` is number + unit (`256m`, `1g`).

## Deletion (always confirm with the user)

`DELETE /projects/{uuid}`, `/applications/{uuid}`, `/databases/{uuid}`, `/services/{uuid}`.
