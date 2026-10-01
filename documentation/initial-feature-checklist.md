# Implementation Checklist

All items are planned and unchecked. Check only after implementation and verification. See [scope](auth-platform-spec.md) for details.

## Phase 1 — GoTrue operator dashboard

- [ ] Local GoTrue/PostgreSQL/email capture run with development secrets.
- [ ] Admin API validates GoTrue identity and explicit server-controlled operator eligibility.
- [ ] Operator login/current account/logout work; customer/developer credentials alone cannot authorize admin routes.
- [ ] UI shows minimal health status, paginated users, and safe user details.
- [ ] Supported create/ban/unban/delete actions work with audit records and destructive-action confirmation.
- [ ] Global-action effects are explained; passwords, tokens, and upstream admin credentials never reach browser/log output.
- [ ] Admin API deploys independently to the VM; its frontend deploys to Vercel using the correct public API.

## Phase 2 — Platform V1

- [ ] Verified developer signup/login/current account/logout/recovery work through shared GoTrue.
- [ ] Profile and personal workspace creation reconcile safely on retries.
- [ ] Developers create/list/configure only their own projects.
- [ ] Keys are scoped, secrets shown once, and revocation/replacement work.
- [ ] Project suspension blocks project access.
- [ ] Project members can be listed/inspected and suspended/restored/removed without global account mutation.
- [ ] New users sign up; existing users authenticate and explicitly join permitted projects without password overwrite.
- [ ] Project login/current user/refresh/logout work with active membership checks.
- [ ] Opaque sessions are project-bound; credential hashes and encrypted upstream tokens are protected.
- [ ] Online server-key validation rejects wrong-project, expired, revoked, or suspended access.
- [ ] Refresh rotation handles replay/concurrency without changing project scope.
- [ ] Real verification/recovery delivery and authenticated flow context complete safely.
- [ ] TypeScript quickstart demonstrates signup/login and a protected application backend route.
- [ ] Platform API deploys separately to the VM; developer frontend deploys to Vercel.

## Integration and launch checks

- [ ] Both APIs use the one private GoTrue; no containers/databases are created per project.
- [ ] Admin, developer-console, and customer-session authority cannot be substituted across APIs/purposes.
- [ ] Project-A keys/sessions fail in B even when the user belongs to both.
- [ ] Removing membership A leaves B usable; unauthorized workspace management fails.
- [ ] Global password/reset/revocation behavior matches the documented shared-account contract.
- [ ] Exact frontend origins, cookies, CSRF, and production/preview behavior are tested.
- [ ] Limits, safe errors, redacted logs, audit records, and upstream/email failure handling work.
- [ ] Backups restore both databases and required signing/encryption/configuration material.
- [ ] Existing direct GoTrue consumers and callbacks migrate before its public Caddy route is removed.
- [ ] End-to-end two-project walkthrough passes using the deployed platform API.
