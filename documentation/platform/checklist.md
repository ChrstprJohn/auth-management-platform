# Developer Platform — V1 Checklist

Planned items; check only after implementation and verification. [Feature spec](features.md).

- [ ] Developer signup/verification/login/current account/logout/recovery and display-name editing work through shared GoTrue.
- [ ] Explicit onboarding creates one personal workspace; retries reconcile safely without duplicate records or premature permissions.
- [ ] Project create/list/view/settings/status operations enforce workspace ownership.
- [ ] Publishable/server keys have correct scopes; secrets are shown once; revocation/replacement work.
- [ ] Project member list/details/suspension/restoration/removal never mutate global credentials or other memberships.
- [ ] New signup and existing-account explicit join follow policy; email alone cannot authorize access or overwrite passwords.
- [ ] Project login/current user/refresh/logout work only with valid membership and project status.
- [ ] Project credentials are opaque and hashed; upstream tokens are encrypted with protected key material.
- [ ] Refresh rotation handles concurrency/replay and cannot change project scope.
- [ ] Online validation checks server-key scope, session, expiry, revocation, project, and membership.
- [ ] Customer/console/operator credentials cannot substitute for each other.
- [ ] Delivered callbacks validate flow context, identity, expiry, and redirect; recovery explains global account effects.
- [ ] TS guide works from project creation through a protected application backend route.
- [ ] Two-project checks prove cross-project denial and independent membership removal.
- [ ] Limits, safe failures, audit records, secret redaction, origins/cookies/CSRF are verified.
- [ ] Platform API deploys independently to VM; frontend deploys to Vercel.
- [ ] Both databases/configuration/signing/encryption material restore successfully.
- [ ] Existing direct GoTrue consumers/callbacks migrate before its public proxy route is removed.
- [ ] Full developer/customer walkthrough passes before the external pilot.
