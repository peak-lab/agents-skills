---
paths:
  - "**/Dockerfile*"
  - "**/docker-compose*"
  - "**/compose*.yml"
  - "**/compose*.yaml"
  - "**/.dockerignore"
---

# Docker and Compose Rules

Scope: Dockerfiles, Compose files, and `.dockerignore`

## Match the repository's supported stack

Read runtime declarations, lockfiles, build scripts, and deployment constraints before choosing images or install commands. Do not hardcode a language version, package manager, port, or registry because it is current elsewhere.

Pin base images to an intentional version. Use digests when the project's update process can refresh them safely. Avoid floating `latest` references in reproducible production builds, including binaries copied from other images.

## Build a minimal runtime image

Use multi-stage builds when build-only tools or dependencies need not ship in the final image. Copy only runtime artifacts and production dependencies. Run the service as a non-root user unless the workload has a documented requirement for elevated privileges.

Order copy and install steps to preserve dependency caching. Use BuildKit cache mounts, linked copies, or heredocs only when the supported builder implements them; keep a compatible path when portability requires one.

Maintain a `.dockerignore` that excludes credentials, VCS data, local environments, dependency caches, and build output not needed in the context. Do not exclude all Markdown or configuration files without checking whether the build consumes them.

## Keep secrets out of layers and manifests

Never place secrets in `ARG`, image layers, committed Compose values, or copied environment files. Use the deployment platform's secret mechanism or supported build secrets. Remember that environment variables may be inspectable at runtime.

## Use the current Compose Specification

Prefer `compose.yaml` for new projects, but do not rename an existing Compose file without checking scripts and deployment references. The top-level `version` field is obsolete in current Compose implementations; compatibility with an older target must be verified before removal.

Use named volumes for intentionally persistent service data and read-only mounts where mutation is not required. Treat volume deletion as destructive: never recommend `docker compose down -v` as a routine way to apply an init-script change without explicit confirmation and a recovery plan.

Use healthchecks for dependencies whose readiness matters, and pair them with application-level retry behavior. `depends_on` ordering alone does not make a service resilient after startup.

Compose Watch and `develop` features are optional. Use them only after confirming the installed Compose implementation supports them; otherwise retain the project's bind-mount or rebuild workflow.

## Verify the artifact

Build from a clean context, inspect the resolved Compose configuration, run the container as configured, check signal-driven shutdown and health behavior, and scan the final image for embedded credentials and known vulnerabilities using the project's tooling.
