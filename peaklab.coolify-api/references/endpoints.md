# Coolify API - Full Endpoint Reference

Base URL: `https://coolify.example.com/api/v1`
Auth: `Authorization: Bearer ${COOLIFY_TOKEN}`

## System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/version` | API version |
| GET | `/health` | Health check |
| GET | `/enable` | Enable API |
| GET | `/disable` | Disable API |

## Applications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/applications` | List all (filter: `?tag=name`) |
| GET | `/applications/{uuid}` | Get application |
| PATCH | `/applications/{uuid}` | Update application |
| DELETE | `/applications/{uuid}` | Delete application |
| POST | `/applications/public` | Create from public git repo |
| POST | `/applications/private-github-app` | Create from private repo (GH App) |
| POST | `/applications/private-deploy-key` | Create from private repo (deploy key) |
| POST | `/applications/dockerfile` | Create from Dockerfile |
| POST | `/applications/dockerimage` | Create from Docker image |
| POST | `/applications/dockercompose` | Create from Docker Compose |

### Application Lifecycle

| Method | Path | Description |
|--------|------|-------------|
| GET | `/applications/{uuid}/start` | Start |
| GET | `/applications/{uuid}/stop` | Stop |
| GET | `/applications/{uuid}/restart` | Restart |
| GET | `/applications/{uuid}/logs` | Logs (`?lines=100`) |

### Application Environment Variables

| Method | Path | Description |
|--------|------|-------------|
| GET | `/applications/{uuid}/envs` | List env vars |
| POST | `/applications/{uuid}/envs` | Create env var |
| PATCH | `/applications/{uuid}/envs` | Update env var by key (`key`, `value`, `is_preview`) |
| PATCH | `/applications/{uuid}/envs/bulk` | Bulk update env vars |
| DELETE | `/applications/{uuid}/envs/{env_uuid}` | Delete env var |

### Create Application - Required Fields

```json
{
  "project_uuid": "string",
  "server_uuid": "string",
  "environment_name": "string",
  "git_repository": "string",
  "git_branch": "string",
  "build_pack": "string",
  "ports_exposes": "string"
}
```

## Databases

| Method | Path | Description |
|--------|------|-------------|
| GET | `/databases` | List all databases |
| GET | `/databases/{uuid}` | Get database |
| PATCH | `/databases/{uuid}` | Update database |
| DELETE | `/databases/{uuid}` | Delete database |
| POST | `/databases/postgresql` | Create PostgreSQL |
| POST | `/databases/mysql` | Create MySQL |
| POST | `/databases/mariadb` | Create MariaDB |
| POST | `/databases/mongodb` | Create MongoDB |
| POST | `/databases/redis` | Create Redis |
| POST | `/databases/keydb` | Create KeyDB |
| POST | `/databases/dragonfly` | Create DragonFly |
| POST | `/databases/clickhouse` | Create Clickhouse |

### Database Lifecycle

| Method | Path | Description |
|--------|------|-------------|
| GET | `/databases/{uuid}/start` | Start |
| GET | `/databases/{uuid}/stop` | Stop |
| GET | `/databases/{uuid}/restart` | Restart |

### Database Backups

| Method | Path | Description |
|--------|------|-------------|
| GET | `/databases/{uuid}/backups` | List backup configs |
| POST | `/databases/{uuid}/backups` | Create backup config |
| PATCH | `/databases/{uuid}/backups/{backup_uuid}` | Update backup config |
| DELETE | `/databases/{uuid}/backups/{backup_uuid}` | Delete backup config |
| GET | `/databases/{uuid}/backups/{backup_uuid}/executions` | List backup executions |
| DELETE | `/databases/{uuid}/backups/{backup_uuid}/executions/{execution_uuid}` | Delete backup execution |

### Create Database - Required Fields

```json
{
  "project_uuid": "string",
  "server_uuid": "string",
  "environment_name": "string"
}
```

## Servers

| Method | Path | Description |
|--------|------|-------------|
| GET | `/servers` | List all servers |
| POST | `/servers` | Create server |
| GET | `/servers/{uuid}` | Get server |
| PATCH | `/servers/{uuid}` | Update server |
| DELETE | `/servers/{uuid}` | Delete server |
| GET | `/servers/{uuid}/resources` | List server resources |
| GET | `/servers/{uuid}/domains` | List server domains |
| GET | `/servers/{uuid}/validate` | Validate server (SSH + Docker) |

### Hetzner Cloud

| Method | Path | Description |
|--------|------|-------------|
| POST | `/servers/hetzner` | Create Hetzner server |
| GET | `/hetzner/locations` | List locations |
| GET | `/hetzner/server-types` | List server types |
| GET | `/hetzner/images` | List images |
| GET | `/hetzner/ssh-keys` | List SSH keys |

## Services

| Method | Path | Description |
|--------|------|-------------|
| GET | `/services` | List all services |
| POST | `/services` | Create service |
| GET | `/services/{uuid}` | Get service |
| PATCH | `/services/{uuid}` | Update service |
| DELETE | `/services/{uuid}` | Delete service |
| GET | `/services/{uuid}/start` | Start |
| GET | `/services/{uuid}/stop` | Stop |
| GET | `/services/{uuid}/restart` | Restart |

### Service Environment Variables

| Method | Path | Description |
|--------|------|-------------|
| GET | `/services/{uuid}/envs` | List env vars |
| POST | `/services/{uuid}/envs` | Create env var |
| PATCH | `/services/{uuid}/envs` | Update env var by key (`key`, `value`, `is_preview`) |
| PATCH | `/services/{uuid}/envs/bulk` | Bulk update env vars |
| DELETE | `/services/{uuid}/envs/{env_uuid}` | Delete env var |

## Deployments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/deployments` | List all deployments |
| GET | `/deployments/{uuid}` | Get deployment |
| POST | `/deployments/{uuid}/cancel` | Cancel deployment |
| GET | `/deploy` | Deploy (`?uuid=X` or `?tag=Y`, optional `&force=true`) |
| GET | `/deploy/app/{uuid}` | List app deployments |

## Projects

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects` | List all projects |
| POST | `/projects` | Create project |
| GET | `/projects/{uuid}` | Get project |
| PATCH | `/projects/{uuid}` | Update project |
| DELETE | `/projects/{uuid}` | Delete project |
| GET | `/projects/{uuid}/environments` | List environments |
| POST | `/projects/{uuid}/environments` | Create environment |
| GET | `/projects/{uuid}/environments/{env_name}` | Get environment |
| DELETE | `/projects/{uuid}/environments/{env_name}` | Delete environment |

## Security Keys

| Method | Path | Description |
|--------|------|-------------|
| GET | `/security/keys` | List private keys |
| POST | `/security/keys` | Create private key |
| GET | `/security/keys/{uuid}` | Get private key |
| PATCH | `/security/keys/{uuid}` | Update private key |
| DELETE | `/security/keys/{uuid}` | Delete private key |

## Resources

| Method | Path | Description |
|--------|------|-------------|
| GET | `/resources` | List all resources |

## Teams

| Method | Path | Description |
|--------|------|-------------|
| GET | `/teams` | List all teams |
| GET | `/teams/{id}` | Get team |
| GET | `/teams/{id}/members` | List team members |
| GET | `/teams/current` | Get authenticated team |
| GET | `/teams/current/members` | Get authenticated team members |

## Cloud Tokens

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cloud-tokens` | List cloud provider tokens |
| POST | `/cloud-tokens` | Create cloud provider token |
| GET | `/cloud-tokens/{uuid}` | Get cloud provider token |
| PATCH | `/cloud-tokens/{uuid}` | Update cloud provider token |
| DELETE | `/cloud-tokens/{uuid}` | Delete cloud provider token |
| POST | `/cloud-tokens/{uuid}/validate` | Validate cloud provider token |

## GitHub Apps

| Method | Path | Description |
|--------|------|-------------|
| GET | `/github-apps` | List GitHub apps |
| POST | `/github-apps` | Create GitHub app |
| GET | `/github-apps/{uuid}/repositories` | Load repositories |
| GET | `/github-apps/{uuid}/repositories/{repo}/branches` | Load branches |
| PATCH | `/github-apps/{uuid}` | Update GitHub app |
| DELETE | `/github-apps/{uuid}` | Delete GitHub app |

## Token Permission Scopes

| Scope | Allows |
|-------|--------|
| `read` | GET requests |
| `write` | POST, PATCH, DELETE requests |
| `deploy` | Deployment operations |

## Create Server - Required Fields

```json
{
  "name": "string",
  "ip": "string",
  "user": "string",
  "port": 22,
  "private_key_uuid": "string"
}
```

## Environment Variable Properties

```json
{
  "key": "string",
  "value": "string",
  "is_buildtime": false,
  "is_runtime": true,
  "is_preview": false,
  "is_multiline": false
}
```

## Validation Rules

| Field | Rule |
|-------|------|
| `build_pack` | `nixpacks`, `static`, `dockerfile`, `dockercompose`, `dockerimage` |
| `ports_exposes` | Comma-separated digits: `3000` or `3000,8080` |
| `limits_memory` | Number + unit: `256m`, `1g` |
