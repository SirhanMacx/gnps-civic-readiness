# Security policy

## Reporting a vulnerability

Please email **civicseal@greatneck.k12.ny.us** with details. Do not file a public GitHub issue.

We follow a 90-day responsible-disclosure window: we'll acknowledge within 5 business days, work on a fix, and publish an advisory + credit you (with permission) once the fix ships.

## In scope

- Authentication / authorization bypass (counselor / SCRC / admin role gates)
- FERPA-relevant data exposure (student records, evidence files, supervisor emails)
- Remote code execution
- SQL injection
- Cross-site scripting in submission or staff-facing UIs
- Insecure direct object references (e.g., predictable confirmation tokens)

## Out of scope

- Denial-of-service against unapproved demo / prototype hosting
- Social engineering of staff
- Issues that require physical access to a staff member's machine
- Reports against the design document or non-code artifacts

---

## Production readiness expectations

Before any district uses the portal with real student data, the deployment should be reviewed against district policy and approved by the appropriate technology, curriculum, and privacy stakeholders.

At minimum, production readiness should include:

- **Authentication and role-based access:** staff accounts, role assignments, session handling, and offboarding must be reviewed and owned.
- **FERPA/privacy handling:** student records and evidence artifacts must remain within approved systems and be accessed only by staff with a legitimate educational interest.
- **Evidence-file storage and retention:** uploaded artifacts need an approved storage location, retention timeline, and archival/deletion process.
- **Backups and disaster recovery:** Postgres data and evidence files need tested backups and a restore procedure.
- **Accessibility:** student- and staff-facing workflows should be reviewed for accessibility before broad release.
- **Incident response:** the district should know who receives reports, who can disable access, and how affected users are notified.
- **Ownership and staff offboarding:** long-term technical and program ownership must be assigned, with a recurring review of staff access.
- **Demo-data boundary:** no real student data should be entered into unapproved demo or prototype environments.

Technically deployable does not mean institutionally approved. See [`docs/go-live-checklist.md`](docs/go-live-checklist.md) for the distinction between demo-live, pilot-live, and production-live.
