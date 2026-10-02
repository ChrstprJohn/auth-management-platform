# GoTrue operator dashboard status

Last verified for this goal: 2026-10-02.

Active [create-user modal and Resend goal](create-user-modal-resend-goal.md): **implementation ready; setup/live delivery pending**.

## Create dialog and SMTP preparation (2026-10-02)

- Final setup update (2026-10-02): the user saved the sending key locally. Read-only checks confirmed its presence and the SMTP username; the agent corrected the remaining local host/port/sender settings to `smtp.resend.com:465` and `auth@mail.chrbuilds.dev`, preserving the key and callback settings. A key inadvertently entered in the tracked example was restored to its placeholder; only the ignored `.env` retains it. The emitted-asset credential scan passed with the newly configured key. DNS verified status, user-operated GoTrue recreation and authorized live inbox/recovery verification remain pending.
- Users header/empty-state Dialog retains pagination and explicit policies; idle close clears passwords and returns focus. Pending close/Escape/backdrop are blocked; navigation cannot release the submission lock. Confirmed results persist until deliberate Create another; unknown/partial outcomes retain IDs and read-only history inspection across close/reopen/navigation. Session loss clears state and rejects late responses.
- Hosted Resend SMTP preparation uses port 465 after checking official guidance and pinned GoTrue/gomail TLS source. Mailpit is opt-in with an explicit Compose override; Mailpit-only live probes fail closed before mutations if running capture settings cannot be confirmed. Recovery/setup copy is provider-neutral. At the original modal stage, endpoint contracts and admin creation email semantics were unchanged; the separately authorized email extension is recorded below.
- 78 backend/script tests and 68 frontend tests passed, including modal lifecycle and capture-guard regressions; aggregate typecheck, lint, formatting, production build and emitted-asset scan (including SMTP passwords) passed. Compose base service selection and override capture settings validated without starting infrastructure.
- Bounded fixture review and one confirmation pass passed at 1440/390/320px: keyboard entry/trap/return, first-invalid-field focus, idle Escape/backdrop, pending protection/password cleanup, long-content viewport scrolling, retained success, legacy redirect and uncertain navigation. Visual reviewer disposition: ship; incumbent shadcn tokens/components preserved. Ten captures per pass live under ignored `artifacts/web-review/create-after` and `create-confirm`.
- Credential-independent implementation did not execute SQL/setup, change real operators or ignored environment values, start/recreate infrastructure, send external email, deploy or push. Final local SMTP configuration is recorded above; infrastructure recreation remains user-operated. Foreground review resources closed; project/Next worker inspection found no attributable leftovers. Real Resend activation/delivery/recovery are pending.

## Remaining setup

Follow the [final SMTP checklist](../../infrastructure/local/README.md#final-setup-checklist-user-operated-after-independent-checks): verify sender-domain DNS, enter a domain-restricted sending key and sender identity locally, preserve callback/site URLs, and perform the user-operated GoTrue restart. Authorize controlled recipients before any external email. Actual inbox delivery and same-browser recovery/reset/new-password login remain pending; the goal stays active until these steps are verified. Production deployment remains separate work.

## Email extension (2026-10-02)

Implemented invitation, verification, reinvitation and recipient OTP/password setup, with durable email-action audit and explicit partial/unknown outcomes. Codes/passwords clear before requests settle; no recipient flow grants operator eligibility. Definite rate-limit errors allow deliberate re-entry, and late proof completion preserves newer sign-in sessions.

88 backend/script tests and 75 frontend tests passed, alongside typecheck, lint, formatting, production build, emitted-asset credential scan and a bounded desktop/320px fixture review of forms, invitation acceptance, email confirmation dialogs and mobile uncertain outcomes. Both public OTP templates were reachable from the existing GoTrue container through Vite. Fixture tests sent no email and used no Mailpit probe. User reports migration 0004 applied; no SQL or infrastructure recreation was performed by the agent.

The local ignored SMTP settings use `smtp.resend.com:465`, username `resend`, sender `auth@mail.chrbuilds.dev` and the user-entered key. The pre-existing GoTrue container still needs user-operated recreation to load Resend/template settings. Actual inbox arrival, live OTP/password acceptance and same-browser Resend recovery/new-password login remain for manual testing. See the [API contracts](api.md#email-extension-contract-implemented-live-delivery-pending) and [local SMTP setup](../../infrastructure/local/README.md#invitation-and-confirmation-templates).
