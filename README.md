# NYS Seal of Civic Readiness Portal

<img src="https://resources.finalsite.net/images/f_auto,q_auto,t_image_size_2/v1719848341/greatneckk12nyus/mapstlq0ll8etgbkht69/NewGNPSLogoRound.png" alt="GNPS" width="80" align="right">

**Open-source web portal for tracking the New York State Seal of Civic Readiness.** Built by Great Neck Public Schools — Social Studies Department. MIT-licensed. Forkable by any New York district.

**Live demo (prototype deployment):** https://gnps-civic-readiness.vercel.app — proof-of-concept only; not a recommended production architecture. See [Architecture](#architecture) below.

---

## What this is

The [NYS Seal of Civic Readiness](https://www.nysed.gov/standards-instruction/seal-civic-readiness-information) is a +1 Diploma Pathway distinction approved by the Board of Regents in 2021. Students earn the Seal — a transcript-and-diploma marker — by accumulating six points across two columns (Civic Knowledge and Civic Participation) over grades 9–12.

Most New York districts that offer the Seal collect evidence with Microsoft Forms or Google Forms feeding counselor inboxes. There is no central tracker, course/Regents data is re-keyed manually, and end-of-year roll-up is a manual aggregation burden.

This portal does it differently: a public submission landing page (mirrors district branding), supervisor email confirmation for service hours, counselor and SCRC committee approval queues, an admin roster with live point computation against the NYSED rules, and a year-end NYSED audit-pack export (per-student PDFs + roster CSV + evidence files in a zip).

## Status

**Feature-complete proof of concept.** The portal supports public evidence intake for all non-SIS pathways, staff review queues, Infinite Campus CSV import, roster point calculation, and NYSED audit-pack export. Infinite Campus remains the system of record; this portal is a workflow and evidence-tracking layer on top of it.

The codebase is **technically deployable today**, but technically deployable does not mean institutionally approved. District use should follow a proper technology, curriculum, and privacy review path. See [`docs/go-live-checklist.md`](docs/go-live-checklist.md) for the distinction between demo-live, pilot-live, and production-live.

**Deferred until district IT review:** live Infinite Campus integration, district SSO, student-facing progress portal, transcript write-back.

## How it works

```
Student → /submit/service          → Postgres (students, pathway_submissions,
                                      hours_log, audit_log)
                                   ↓
              ┌─ supervisor email auto-sent (district SMTP) ─┐
              ↓                                               ↓
       Supervisor clicks confirm                       Counselor approves
       (no account needed)                             reflection (logged in)
                                                                ↓
                                                    SCRC scores projects
                                                    against NYSED rubric
                                                                ↓
                                            Admin → year-end NYSED audit pack
                                                    (zip per cohort)
```

## Pathway support

The system implements all 11 NYSED pathways. The implementation keys pathways by name (not letter), since NYSED's own letter labels disagree between the Criteria one-pager and the full Handbook.

| ID | Column | Points | Cap | NYSED reference |
|---|---|---|---|---|
| `four_ss_credits` | Knowledge | 1 | 1× | Manual p.10 (1a) |
| `regents_mastery` | Knowledge | 1.5 | repeatable | Manual p.10 (1b) |
| `regents_proficiency` | Knowledge | 1 | repeatable | Manual p.10 (1c) |
| `advanced_ss_course` | Knowledge | 0.5 | repeatable | Manual p.10 (1d) |
| `research_project` | Knowledge | 1 | 1× | Manual p.12 (1e) — SCRC pre-approves |
| `hs_civic_project` | Participation | 1.5 | max 2 (3pt cap) | Manual p.17 (2a) — SCRC pre-approves |
| `service_learning` | Participation | 1 | repeatable | Manual p.20 (2b) — 5-stage process |
| `civic_elective` | Participation | 0.5 | repeatable | Manual p.23 (2c) — paired with course grade |
| `ms_capstone` | Participation | 1 | 1× | Manual p.24 (Gr 7–8 only) |
| `wbl_extracurr` | Participation | 0.5 | repeatable | Manual p.23 (2e) |
| `hs_capstone` | Participation | **4** | 1× | Manual p.26 (2f) — SCRC scores against Appendix P |

## Architecture

**Recommended production path: district-owned or district-approved infrastructure.** This repository supports a self-hosted stack out of the box:

- SvelteKit 2 on Node 22 (frontend + server)
- Postgres 16
- Docker Compose for orchestration
- Caddy as reverse proxy (auto-issues Let's Encrypt SSL)
- District SMTP for transactional email
- Self-hosted magic-link JWT sessions (no third-party auth provider required)
- Filesystem (default) or S3-compatible evidence storage

**Infinite Campus remains the system of record.** The portal is a workflow and evidence-tracking layer for evidence intake, review queues, point calculation, and audit preparation.

**About the live demo / prototype vendors.** The live demo is a proof-of-concept deployment running on Vercel + Supabase + Resend. Those were useful prototype/demo choices; **they are not required vendors** and they are not the recommended production architecture. The prototype vendors are replaceable; the workflow is the value. For district use, use the self-hosted stack described above (or any district-approved equivalent).

**Deferred until district IT review:**
- ClassLink / Google Workspace / Azure AD SSO replacing magic-link auth
- Student-facing portal with live progress and family-visible status
- Live Infinite Campus integration (OneRoster API or nightly export job) replacing the manual CSV import path
- Transcript write-back

For full architectural detail see the [design document](dist/GNPS-Civic-Readiness-Portal-Design.pdf) (27 pages, also available as [.docx](dist/GNPS-Civic-Readiness-Portal-Design.docx)) and the [IT-handoff brief](dist/GNPS-IT-Handoff-Brief.pdf) (1 page, [.docx](dist/GNPS-IT-Handoff-Brief.docx)).

## For districts adopting this

Fork the repo, edit `config/district.yaml` (logo URL, colors, district name, support email, course catalog seed, SCRC committee emails), and deploy. Source code does not need to change. See [docs/customization.md](docs/customization.md).

## For developers contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). New pathway logic and submission flows must include tests (Vitest for unit, Playwright for E2E).

## Quick start

### Self-hosted (recommended for any real deployment)

Prerequisites: a Linux host with Docker Engine 24+ and Docker Compose v2; a DNS A record pointing at it; district SMTP credentials.

```bash
git clone https://github.com/<owner>/gnps-civic-readiness
cd gnps-civic-readiness
cp .env.example .env
# Edit .env — fill CIVICSEAL_DOMAIN, POSTGRES_PASSWORD, SESSION_SECRET (32+ chars),
# SIGNED_LINK_SECRET (32+ chars), SMTP_*, and EMAIL_FROM.

make up                                    # builds + starts db, migrations, app, caddy
make admin EMAIL=you@your-district.k12.ny.us   # provision the bootstrap admin
```

Then visit `https://${CIVICSEAL_DOMAIN}/login` and request a one-time sign-in link.

See [`docs/deployment-guide.md`](docs/deployment-guide.md) and [`docs/it-runbook.md`](docs/it-runbook.md) for the full procedure (smoke tests, backups, updates, rollback).

### Local development

Prerequisites: Node 22+, pnpm 9+, Postgres 16 (local or via Docker), Git.

```bash
git clone https://github.com/<owner>/gnps-civic-readiness
cd gnps-civic-readiness
pnpm install
cp .env.example apps/web/.env.local
# Edit apps/web/.env.local — point DATABASE_URL at a local Postgres
# and set SESSION_SECRET / SIGNED_LINK_SECRET to any 32+ character value.

pnpm dev
```

Open http://localhost:5173 — the GNPS-themed landing page should load.

## Documentation

| Doc | Audience |
|---|---|
| [Project goal & rollout plan](docs/project-goal-and-rollout-plan.md) | Social Studies leadership, district IT, project sponsors |
| [Design document](dist/GNPS-Civic-Readiness-Portal-Design.pdf) | Leadership, architects, anyone evaluating the system |
| [IT-handoff brief](dist/GNPS-IT-Handoff-Brief.pdf) | District technology departments |
| [docs/deployment-guide.md](docs/deployment-guide.md) | Engineers deploying for a district |
| [docs/data-import-guide.md](docs/data-import-guide.md) | Counselors importing IC data |
| [docs/customization.md](docs/customization.md) | Districts re-skinning for their own brand |
| [docs/superpowers/specs/](docs/superpowers/specs/) | Source-of-truth design spec |
| [docs/superpowers/plans/](docs/superpowers/plans/) | 28-task implementation plan |

## License

[MIT](LICENSE). Fork freely. Submit PRs back if you make improvements other districts could use.

## Acknowledgments

Built on top of NYSED's [Seal of Civic Readiness Manual (Updated March 2025)](https://www.nysed.gov/standards-instruction/seal-civic-readiness-manual) and current NYSED FAQ/reporting guidance. Peer-district approaches reviewed during design: Seaford, Three Village CSD, Connetquot. Round logo and brand palette: Great Neck Public Schools.

Built for Great Neck Public Schools — Social Studies Department · 2026.
