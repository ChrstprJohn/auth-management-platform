# Project documentation

Start here for topic ownership. For GoTrue work, read [the status summary](gotrue-dashboard/status.md) first: it owns completed behavior, recorded verification, remaining work and the latest prepared goal. Then read the documents owning the topic you are changing. Build the GoTrue operator dashboard first, then the developer platform.

## Topic ownership

| Topic                                                                                                             | Authoritative document                                                                                |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Agent behavior, coding/delivery rules, frontend constraint, Windows process hygiene and manual database execution | [AGENTS.md](../AGENTS.md)                                                                             |
| GoTrue implementation/verification status, remaining work and latest prepared goal                                | [GoTrue status](gotrue-dashboard/status.md)                                                           |
| Shared layout, database boundaries, VM routing, deployment and GoTrue privacy                                     | [Shared architecture and deployment](architecture-and-deployment.md)                                  |
| Operator product scope                                                                                            | [Operator features](gotrue-dashboard/features.md)                                                     |
| Operator backend stack, layers, sessions, audit and provisioning                                                  | [Backend architecture](gotrue-dashboard/backend-architecture.md)                                      |
| Operator endpoint contracts, cookies/CSRF, usage examples and outcomes                                            | [API reference](gotrue-dashboard/api.md)                                                              |
| Operator frontend screens, interactions and complete endpoint usage                                               | [Frontend requirements](gotrue-dashboard/frontend-requirements.md)                                    |
| Operator frontend stack, hook/view boundaries, API/session/cache and UI states                                    | [Frontend architecture](gotrue-dashboard/frontend-architecture.md)                                    |
| Operator shadcn component choices, screen/state mapping and review commands                                       | [Frontend components](gotrue-dashboard/frontend-components.md)                                        |
| Backend/frontend setup                                                                                            | [API setup](../apps/gotrue-admin-api/README.md), [frontend setup](../apps/gotrue-admin-web/README.md) |
| Owned admin schema, migration ledger and user-operated execution                                                  | [Admin database](../packages/database/admin/README.md)                                                |
| Developer platform scope and delivery status                                                                      | [Platform features](platform/features.md), [platform checklist](platform/checklist.md)                |
| Local infrastructure commands, pinned images and email configuration                                              | [Local infrastructure](../infrastructure/local/README.md)                                             |
| Existing VM operations/history                                                                                    | [VM reference](../vm_infrastructure/vm-infrastructure-reference-updated.md)                           |

## Maintenance

- Keep GoTrue delivery status in `gotrue-dashboard/status.md`; update it alongside every relevant change with actual evidence and remaining work. Detailed requirements/contracts/design/setup belong in their topic owner.
- README files provide navigation. Link to changing status, configuration and policy instead of repeating them.
- Completed goals, plans and duplicate trackers are consolidated into the status summary and removed after their useful evidence is preserved. Keep unfinished goals; a prepared prompt is not completed implementation or authorization to start unrelated work.
- Endpoint changes update the API reference and affected integrations. Design changes update architecture; setup changes update setup guides. Planned requirements do not establish verified delivery.
- Agent rules belong in root `AGENTS.md`; no separate `.agent` rulebook is required. Follow its status-maintenance and manual database-execution rules.
- VM reference files describe existing infrastructure/history. New application deployment decisions belong in shared architecture; local setup belongs in the local infrastructure README.
