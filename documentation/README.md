# Project Documentation

Planned basic scope. All checklist items start unchecked; documentation does not imply completed implementation.

Build **GoTrue dashboard first**, then **developer auth platform**. Each project has its own API on the VM and frontend on Vercel. Both use one shared GoTrue.

| Project | Features | Checklist |
|---|---|---|
| GoTrue operator dashboard | [Basic V1](gotrue-dashboard/features.md) | [Delivery checks](gotrue-dashboard/checklist.md) |
| Developer auth platform | [Basic V1](platform/features.md) | [Delivery checks](platform/checklist.md) |

[Shared architecture and deployment](architecture-and-deployment.md) contains the repository/VM structure, database ownership, permissions, local setup, and private GoTrue migration. Keep cross-project infrastructure decisions there instead of duplicating them in each spec.

Environment goal: local APIs use local GoTrue and the existing local PostgreSQL. On the VM, pull the whole repository and deploy only the APIs using the existing GoTrue/PostgreSQL; do not run local infrastructure there. Frontends deploy separately to Vercel. See the guide's [local-versus-VM table](architecture-and-deployment.md#local-versus-vm-what-runs).

Existing operational documents stay in [vm_infrastructure](../vm_infrastructure/vm-infrastructure-reference-updated.md).
