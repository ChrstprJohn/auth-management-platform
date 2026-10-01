# GoTrue Dashboard — V1 Checklist

Planned items; check only after implementation and verification. [Feature spec](features.md).

- [ ] Local shared GoTrue/PostgreSQL and email capture work with development secrets.
- [ ] Operator eligibility is provisioned server-side; ordinary accounts cannot become operators.
- [ ] Login/current account/logout, expiry, and delivered recovery work.
- [ ] Every protected route checks operator identity/authority; sessions from the platform API are not substituted.
- [ ] UI displays auth health, paginated users, and safe user details with loading/empty/error states.
- [ ] Search scope/limitations are accurate and tested, or unsupported search is omitted.
- [ ] Create user validates input and documents confirmation/email delivery behavior.
- [ ] Ban/unban works; confirmation and actual upstream session effects are documented.
- [ ] Delete requires explicit confirmation, explains global impact, and has a safe platform-reference reconciliation policy before production use.
- [ ] Durable audit history records successful/failed management actions without credential data.
- [ ] Admin credentials/passwords/tokens never appear in browser bundles, logs, or error responses.
- [ ] Limits, CSRF/cookie/origin rules, and controlled upstream failures work.
- [ ] Admin API deploys independently to VM; frontend deploys to Vercel.
- [ ] Full operator walkthrough passes and non-operator requests fail.
