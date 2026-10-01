# Authentication Project Documentation

Agreed design, October 1, 2026. These documents describe planned work; application code and VM deployment have not been created by this documentation task.

| Document | Contents |
|---|---|
| [Deployment layout](deployment-layout.md) | Repository folders, VM folders, containers, routing, deployment sequence |
| [Architecture and development](architecture-and-development.md) | Shared GoTrue, database ownership, permissions, local setup, sessions |
| [V1 scope](auth-platform-spec.md) | Dashboard-first build order and basic developer-platform features |
| [Implementation checklist](initial-feature-checklist.md) | Completion checks for both phases |

Start with deployment layout, then architecture. The final design uses **two separate Express APIs, two frontends on Vercel, and one shared GoTrue instance**. Build the GoTrue management dashboard first, then the developer platform.

Existing deployment references remain in [vm_infrastructure](../vm_infrastructure/vm-infrastructure-reference-updated.md). They describe the current setup, including the public GoTrue route, rather than the target design.
