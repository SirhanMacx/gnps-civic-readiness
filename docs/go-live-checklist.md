# Go-live checklist

Three things are not the same.

> **Technically deployable does not mean institutionally approved.**

This document distinguishes **demo-live**, **pilot-live**, and **production-live**, and lists what each one requires before a district uses the Civic Readiness Portal with real student data.

Infinite Campus remains the system of record at every tier; the portal is a workflow and evidence-tracking layer.

---

## Demo-live

A demo-live deployment is a proof of concept that lets evaluators click through the workflow.

- [ ] Proof-of-concept deployment (could be the public live demo, a local `docker compose up`, or a sandbox environment)
- [ ] Sample data only — no real student names, no real Regents scores, no real supervisor emails, no real evidence files
- [ ] Not institutionally approved
- [ ] No real student data unless explicitly approved in writing by the district
- [ ] Used to evaluate workflow and gather feedback from staff, leadership, and IT
- [ ] Clearly labeled as a demo / prototype in any link shared

A demo-live system is fine to share with leadership or peer districts so they can see the workflow. It is **not** fine to use it to track actual students.

---

## Pilot-live

A pilot-live deployment is a bounded, IT-aware first run with a small group of students or staff.

- [ ] Limited users and limited scope (e.g. one cohort, one counselor, one project type)
- [ ] IT-aware — district technology has been told the pilot exists, where it runs, and who owns it
- [ ] Approved pilot data boundaries — exactly which student records, evidence types, and time window are in scope
- [ ] Feedback cycle — a defined channel for staff to report problems, and an owner who responds
- [ ] Named program owner (curriculum side)
- [ ] Named technical owner (IT side)
- [ ] Incident / contact path — who gets paged if something breaks, and how affected users are notified
- [ ] Privacy / security review appropriate to pilot scope, signed off by the right stakeholder
- [ ] Hosting on district-owned or district-approved infrastructure (the recommended self-hosted Docker stack, or a district-approved equivalent)
- [ ] Backups in place, even if minimal
- [ ] An exit plan — how the pilot ends, and what happens to the data afterward

A pilot is the first time real student data enters the system. It must be reversible.

---

## Production-live

A production-live deployment serves the full eligible population year over year.

- [ ] Approved hosting on district-owned or district-approved infrastructure
- [ ] Approved authentication — district-issued accounts, role assignments, session lifetimes, and a documented offboarding process
- [ ] Privacy / FERPA review completed, including a written data-flow that covers intake, review, evidence storage, Infinite Campus import, and audit export
- [ ] Backup and disaster recovery — tested restore procedure, off-host copies, defined retention
- [ ] Evidence-file storage and retention policy — approved storage location, retention timeline, archival / deletion process
- [ ] Accessibility review of student- and staff-facing flows
- [ ] Support ownership — long-term technical and program owner identified, with a recurring review of staff access
- [ ] Staff offboarding — process for removing access when staff leave the district
- [ ] Audit / export process — documented procedure for generating the NYSED audit pack, with a designated runner
- [ ] Infinite Campus relationship clearly defined — the portal does not modify IC; IC remains the system of record
- [ ] Transcript / write-back governance — if write-back is ever introduced, it needs its own review (privacy, registrar sign-off, audit log, rollback plan)
- [ ] Incident response — published contact path, who can disable access, how affected users are notified
- [ ] Logging and monitoring — alerting on app down, DB unreachable, disk pressure, and unusual audit-log activity
- [ ] Secret management — rotation policy for `SESSION_SECRET`, `SIGNED_LINK_SECRET`, Postgres password, and SMTP credentials
- [ ] No real student data ever enters an unapproved demo or prototype environment

A production-live system is the only tier where the district commits to using portal-managed data for NYSED reporting.

---

## Theme

> Technically deployable does not mean institutionally approved.

The codebase being feature-complete is one input. Whether the district should run it with real student data is a separate decision that belongs to technology, curriculum, and privacy leadership — not to the codebase.
