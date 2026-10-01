# Project Documentation

Start here. Build the GoTrue operator dashboard first, then the developer auth platform. The operator backend, including recovery, is implemented with isolated tests and a separate pinned GoTrue/Mailpit recovery probe; the local PostgreSQL recovery gateway flow is verified; the controlled local management walkthrough also passed, including persistence and two-instance last-operator protection. Documented design decisions are not delivery completion.

## Where to make changes

Each topic has one authoritative home. Edit that file when the topic changes; other documents should link to it instead of copying its details.

| Topic                                                                                                                                                                        | Edit here                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Agent behavior, readable code, DRY, verification, documentation workflow, Windows process rules, frontend constraint, full-schema/migration maintenance and manual execution | [AGENTS.md](../AGENTS.md)                                                   |
| Shared repository layout, database boundaries, VM routing, deployment, GoTrue privacy                                                                                        | [Shared architecture and deployment](architecture-and-deployment.md)        |
| Operator backend stack, layers, sessions, encryption, audit policy, provisioning                                                                                             | [Operator backend architecture](gotrue-dashboard/backend-architecture.md)   |
| Operator endpoint methods, payloads, status codes, cookies/CSRF, usage examples                                                                                              | [Operator API reference](gotrue-dashboard/api.md)                           |
| Operator product scope and user-facing behavior                                                                                                                              | [Operator features](gotrue-dashboard/features.md)                           |
| Operator verified delivery status                                                                                                                                            | [Operator checklist](gotrue-dashboard/checklist.md)                         |
| Developer platform product scope                                                                                                                                             | [Platform features](platform/features.md)                                   |
| Developer platform verified delivery status                                                                                                                                  | [Platform checklist](platform/checklist.md)                                 |
| Local infrastructure commands, pinned images, setup and email verification notes                                                                                             | [Local infrastructure](../infrastructure/local/README.md)                   |
| Existing VM operational references                                                                                                                                           | [VM reference](../vm_infrastructure/vm-infrastructure-reference-updated.md) |

## Maintenance rules

- An endpoint change normally updates code and the API reference. Update the checklist only when verification status changes.
- An internal backend design change belongs in backend architecture; update the API reference only if clients see changed behavior.
- Coding rules belong in `AGENTS.md`; do not repeat architecture, package lists, or endpoint contracts there.
- Feature documents describe product requirements. Checklists track evidence of completion rather than providing another implementation specification.
- README files are navigation. Avoid repeating changing configuration, contracts, or policy in them.
- VM reference files describe existing infrastructure/history. New application deployment decisions belong in shared architecture; local setup belongs in the local infrastructure README.

The operator stack and V1 decisions are consolidated in backend architecture. Endpoint contracts and examples live together in the API reference. No separate `.agent` rulebook is required; agents follow the root `AGENTS.md`.
