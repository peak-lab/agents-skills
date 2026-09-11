# Multi-tenant isolation

Scope: applications that serve resources belonging to more than one tenant.

- Derive tenant identity from authenticated server-side context or a verified domain mapping, never from a client-controlled identifier alone.
- Scope every tenant-owned read, write, update, delete, cache key, background job, file path, and event subscription to the authorized tenant.
- Authorize membership and role for the requested resource, not merely the existence of a valid session.
- Make cross-tenant administration explicit, narrowly permissioned, auditable, and separately tested.
- Enforce isolation in the data-access layer as well as the transport layer. Test negative cases that attempt to access another tenant's resource.
