# Meeting brief — Civic Readiness Portal

**Audience:** GNPS technology and curriculum leadership.
**Purpose:** evaluate whether the Civic Readiness Portal solves a real district need and identify the proper review path.

---

## One-sentence description

A workflow, evidence, and audit layer for the New York State Seal of Civic Readiness — students submit evidence, supervisors confirm, staff review against NYSED rubrics, Infinite Campus data auto-populates Civic Knowledge points, and a year-end NYSED audit pack is produced.

## Leadership framing

> Infinite Campus remains the system of record. The Civic Readiness Portal is a workflow, evidence, and audit layer.
>
> Demo-live, pilot-live, and production-live are different things.
>
> Technically deployable does not mean institutionally approved.
>
> The prototype services are replaceable; the workflow is the value.
>
> The district can choose its approved providers, hosting, identity, email, and database path after review.
>
> I'm not asking to bypass IT. I'm asking for the right review path.
>
> The remaining work is production governance: hosting, authentication, privacy, backups, accessibility, and ownership.

## Problem solved

GNPS does not have a system for managing the NYS Seal of Civic Readiness. Peer Long Island districts (Seaford, Three Village, Connetquot) collect evidence with Microsoft / Google Forms feeding counselor inboxes — no central tracker, no live progress, manual end-of-year roll-up, and no audit-ready output. As a result, students who are *already* doing civic work in classes and clubs may not be recognized at graduation, and counselors carry the cost of re-keying SIS data and chasing supervisors.

The portal closes that gap by combining four things into one workflow:

1. **Public submission landing page** for service hours, projects, capstones, and reflections.
2. **Two-tier verification** — supervisor email confirmation plus counselor / SCRC review.
3. **Infinite Campus CSV import** that auto-counts Civic Knowledge points (SS credits, Regents, advanced coursework) without re-keying.
4. **Year-end NYSED audit pack** — per-student PDFs + roster CSV + evidence files, in one zip.

## 60-second pitch

> Thank you for meeting with me. I built this because the Seal of Civic Readiness is a valuable opportunity for students, but the management side can become fragmented quickly. My goal was to prototype a workflow system that helps students submit evidence, helps staff review it, imports SIS data where appropriate, calculates points against NYSED criteria, and prepares a year-end audit package.
>
> I'm not presenting this as something that should bypass IT review. I'm presenting it as a serious proof of concept. I'd like feedback from technology and curriculum leadership on whether this solves a real district need, what would need to change for security/privacy/compliance, and whether it is worth piloting or formally reviewing.

## Architecture in plain language

- Single web application that staff sign into with a one-time email link.
- One Postgres database holding students, submissions, hours, evidence files, course data, Regents scores, users, and an audit log.
- Outbound email to a district SMTP relay for supervisor confirmations and staff sign-in.
- Optional Infinite Campus CSV import; live IC integration is deferred until IT review.
- Designed to run inside district infrastructure on a single Linux host with Docker, or on equivalent district-approved services.

Infinite Campus stays the system of record. The portal records workflow events (submissions, approvals, scores, exports) and prepares the NYSED audit pack at year-end.

## Current technical stack

**Recommended concrete production path (self-hosted):**

- SvelteKit 2 on Node 22 — application server
- Postgres 16 — relational store
- Docker Compose — orchestration
- Caddy — reverse proxy with automatic Let's Encrypt SSL
- District SMTP — outbound email
- Self-hosted magic-link JWT sessions — staff authentication
- Filesystem (default) or S3-compatible — evidence storage

**Live demo (prototype only):** useful for evaluators to click around with sample data. It is not approved for real student records. The district can decide later whether production should run self-hosted, on district cloud, or on approved managed services.

## What the prototype demonstrates

- Public submission flows for all 11 NYSED pathways
- Supervisor email confirmation (5-second click-to-confirm flow, no account needed)
- Counselor review queues, including reflection approval and hours verification
- SCRC topic approval and rubric scoring
- Infinite Campus CSV import with diff preview before commit, and auto-counted Civic Knowledge points
- Teacher quick-push for class-wide projects, with NYSED cap rules enforced
- Per-student PDF audit record and year-end NYSED audit-pack zip export
- Audit log on every state transition
- 121 automated tests, MIT-licensed open-source code

## 10-minute meeting demo path

1. **Open the landing page.** Say: "This is a prototype workflow, not a request to bypass IT. Infinite Campus remains the system of record."
2. **Show `/submit`.** Point out that students submit only what IC cannot already know: hours, projects, reflections, capstones, and advisor/supervisor evidence.
3. **Open one evidence form.** Emphasize required fields, supervisor confirmation, and the audit trail.
4. **Show staff login framing.** Say staff accounts are provisioned by admins; staff then request a one-time sign-in link. Production auth can stay magic-link or move to district SSO after review.
5. **Show admin import concept.** Explain the IC CSV import as the bridge from the SIS to auto-counted Civic Knowledge points.
6. **Show roster/export language.** Close with the year-end NYSED audit pack: the system reduces spreadsheet work and makes every point traceable.

## Provider / service answer

If asked whether the district must use the current prototype services:

> No. The public demo proves the workflow. The codebase is open source and v0.2.0 is fully self-hostable. GNPS Technology can choose the approved hosting, database, email, storage, identity, and backup path. My goal is to bring a serious prototype to the right review process, not to choose vendors for the district.

## What remains for IT / curriculum review

- **Hosting.** Decide where the production deployment lives — district VM, district VMware/cloud tenancy, or another district-approved provider/service.
- **Authentication.** Today: self-hosted magic-link JWT sessions. Phase 2 option: ClassLink / Google Workspace / Azure AD SSO.
- **Privacy / FERPA.** Confirm the data flow (intake, review, evidence storage, IC import, audit export) meets district privacy requirements. Confirm the demo-data boundary — no real student data into any unapproved environment.
- **Database.** Postgres 16 inside Docker is the default. If district policy prefers a managed Postgres, the connection string is a single env var.
- **Email.** District SMTP; confirm authorized `EMAIL_FROM` address and SPF/DKIM if district policy requires.
- **Evidence storage.** Filesystem (default, on the host volume) or S3-compatible (district object store or approved cloud bucket).
- **Backups and disaster recovery.** Sample nightly `pg_dump` + evidence-file tarball is documented; needs alignment with district backup policy.
- **Accessibility.** Student- and staff-facing flows need an accessibility review before broad release.
- **Infinite Campus integration.** Phase 1: manual quarterly CSV upload (works today). Phase 2: live OneRoster API or nightly SFTP export — requires SIS administrator coordination.
- **Long-term ownership.** Technical owner, program owner, staff offboarding process, incident contact.
- **Transcript / write-back governance.** Out of scope for now; if it ever lands, it needs its own review.

## Key phrases

> Infinite Campus remains the system of record.
>
> The Civic Readiness Portal is a workflow, evidence, and audit layer.
>
> Demo-live, pilot-live, and production-live are different things.
>
> Technically deployable does not mean institutionally approved.
>
> The prototype services are replaceable; the workflow is the value.
>
> The district can choose the approved provider path.
>
> I'm not asking to bypass IT. I'm asking for the right review path.
>
> The remaining work is production governance: hosting, authentication, privacy, backups, accessibility, and ownership.

## Codex / AI-assisted development framing

This project also shows a bigger opportunity. Teachers and curriculum leaders understand workflow problems, but usually cannot prototype solutions. A governed Codex or AI-assisted development pilot could let curriculum and IT evaluate ideas faster — not to bypass IT, but to make collaboration more concrete. Curriculum brings the workflow knowledge; IT brings the governance, hosting, and privacy review; AI-assisted development closes the prototype gap between them.

## Ask to leadership

I'd like guidance on the right pathway: should this remain a demo, become a limited internal pilot, or enter formal production review? I'd also like IT's requirements around hosting, authentication, database, email, evidence storage, Infinite Campus integration, privacy, accessibility, and long-term ownership.
