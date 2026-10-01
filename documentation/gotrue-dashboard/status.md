# GoTrue operator dashboard status

Last verified for this goal: 2026-10-02.

Active [create-user modal and Resend goal](create-user-modal-resend-goal.md): **implementation ready; setup/live delivery pending**.

## Create dialog and SMTP preparation (2026-10-02)

- Users header/empty-state Dialog retains pagination and explicit policies; idle close clears passwords and returns focus. Pending close/Escape/backdrop are blocked; navigation cannot release the submission lock. Confirmed results persist until deliberate Create another; unknown/partial outcomes retain IDs and read-only history inspection across close/reopen/navigation. Session loss clears state and rejects late responses.
- Hosted Resend SMTP preparation uses port 465 after checking official guidance and pinned GoTrue/gomail TLS source. Mailpit is opt-in with an explicit Compose override; Mailpit-only live probes fail closed before mutations if running capture settings cannot be confirmed. Recovery/setup copy is provider-neutral. Endpoint contracts and admin creation email semantics are unchanged.
- 78 backend/script tests and 68 frontend tests passed, including modal lifecycle and capture-guard regressions; aggregate typecheck, lint, formatting, production build and emitted-asset scan (including SMTP passwords) passed. Compose base service selection and override capture settings validated without starting infrastructure.
- Bounded fixture review and one confirmation pass passed at 1440/390/320px: keyboard entry/trap/return, first-invalid-field focus, idle Escape/backdrop, pending protection/password cleanup, long-content viewport scrolling, retained success, legacy redirect and uncertain navigation. Visual reviewer disposition: ship; incumbent shadcn tokens/components preserved. Ten captures per pass live under ignored `artifacts/web-review/create-after` and `create-confirm`.
- No SQL/setup, real operator change, ignored environment write, infrastructure start/recreate, external email, deployment or push occurred. Foreground review resources closed; project/Next worker inspection found no attributable leftovers. Real Resend activation/delivery/recovery are pending.

## Remaining setup

Follow the [final SMTP checklist](../../infrastructure/local/README.md#final-setup-checklist-user-operated-after-independent-checks): verify sender-domain DNS, enter a domain-restricted sending key and sender identity locally, preserve callback/site URLs, and perform the user-operated GoTrue restart. Authorize controlled recipients before any external email. Actual inbox delivery and same-browser recovery/reset/new-password login remain pending; the goal stays active until these steps are verified. Production deployment remains separate work.
