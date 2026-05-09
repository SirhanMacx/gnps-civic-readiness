# GNPS Civic Readiness Portal — IT Handoff Brief

**For:** Great Neck Public Schools Technology Department
**From:** Social Studies Department
**Re:** NYS Seal of Civic Readiness tracking portal — deployment + integration
**Date:** May 4, 2026 · Release v0.2.0 (fully self-hostable)

**Source code (MIT):** https://github.com/SirhanMacx/gnps-civic-readiness
**Latest release:** https://github.com/SirhanMacx/gnps-civic-readiness/releases/tag/v0.2.0
**Full IT runbook:** [docs/it-runbook.md](https://github.com/SirhanMacx/gnps-civic-readiness/blob/main/docs/it-runbook.md) — 1,300+ lines covering deploy, ops, backups, DR, security, troubleshooting
**Infinite Campus integration:** [docs/infinite-campus-integration.md](https://github.com/SirhanMacx/gnps-civic-readiness/blob/main/docs/infinite-campus-integration.md) — three integration paths, the exact IC Ad Hoc Reporting recipe, FERPA considerations
**Teacher Quick-Push UI:** [docs/teacher-quick-push.md](https://github.com/SirhanMacx/gnps-civic-readiness/blob/main/docs/teacher-quick-push.md) — bulk-award civic-readiness points to a class roster in one action

---

## What this is

An open-source web portal for tracking the New York State Seal of Civic Readiness — the +1 Diploma Pathway distinction approved by the NYS Board of Regents in 2021. The portal collects civic-knowledge data (auto-pulled from Infinite Campus where possible) and civic-participation evidence (service hours, projects, capstones submitted by students with supervisor and counselor verification). At year-end it produces a NYSED-compliant audit pack and a roster CSV for the transcript office.

**As of v0.2.0, the system is fully self-hostable on GNPS infrastructure.** Zero third-party SaaS dependencies. Any Linux box with Docker can run the entire stack — application, database, email, file storage, SSL termination — via `docker compose up`. Student records never leave the district.

Phase 1.5 (self-host) is the recommended deployment path for production. Phase 2 (live Infinite Campus integration) builds on top of Phase 1.5 once IT has the deploy stable.

The items below are what IT needs to provide / configure to take the system live.

---

## What we're asking of GNPS Technology

| # | Ask | Effort | Owner |
|---|---|---|---|
| 1 | NYSED district application (SED Application Business Portal) — gates *awarding* of seals on transcripts | ~30 days state review | Curriculum & Instruction (not IT) |
| 2 | Provision a Linux VM (Ubuntu 22.04 / Debian 12 / Rocky 9 — district preference). 2 vCPU + 4 GB RAM + 50 GB disk. Public IP on ports 80/443. Outbound internet access. | ~30 min | Infrastructure |
| 3 | DNS A record for `civicseal.greatneck.k12.ny.us` pointing at the VM's public IP. Caddy auto-issues a Let's Encrypt cert on first boot. | ~5 min | Network/DNS |
| 4 | SMTP credentials for the district mail server. Recommend creating a dedicated mailbox `civicseal-portal@greatneck.k12.ny.us` with auth to send as `civicseal@greatneck.k12.ny.us`. | ~1 hour | Email Administrator |
| 5 | FERPA / privacy review. **Self-hosted v0.2.0 keeps all student data on district infrastructure** — no third-party data processor. Encryption at rest via the VM's disk encryption (LUKS / cloud KMS). Audit log captures every state transition. | ~1 hour | Privacy/Compliance |
| 6 | Deploy: `git clone` → `cp .env.example .env` (fill in 7 values) → `make up`. Caddy obtains SSL automatically. Migrations apply automatically. ~10 minutes from clone to live URL. | ~10 min once Steps 2–4 are done | IT (one engineer) |
| 7 | First admin: `make admin EMAIL=jon@greatneck.k12.ny.us` provisions the bootstrap admin. They log in via magic link and invite the rest of staff via the admin UI. | ~5 min | IT |
| 8 | Infinite Campus integration. Phase 1.5 supports manual quarterly CSV uploads (works today). Phase 2 wires the live SFTP / OneRoster path. See [docs/infinite-campus-integration.md](https://github.com/SirhanMacx/gnps-civic-readiness/blob/main/docs/infinite-campus-integration.md) for the IC Ad Hoc Reporting recipe + 8 specific vendor questions. | Phase 1.5: ~30 min/quarter; Phase 2: 1–2 weeks of integration work | SIS Administrator |
| 9 | Backups: nightly cron script ships `pg_dump` + evidence-data tarball off-host. Sample script in [docs/it-runbook.md §6](https://github.com/SirhanMacx/gnps-civic-readiness/blob/main/docs/it-runbook.md#6-backups--disaster-recovery). | ~30 min | IT |
| 10 | Updates: `git pull` + `make up` rebuilds + restarts (~30s outage). Schedule outside school hours. Schema migrations are idempotent. | per release | IT |

---

## Architecture summary (v0.2.0 self-hosted, on GNPS infrastructure)

```
                      Internet
                         │
                         ▼  (HTTPS — Let's Encrypt cert auto-renewed)
            ┌────────────────────────────┐
            │  Caddy (port 443)          │
            │  reverse proxy + SSL term  │
            └──────────────┬─────────────┘
                           │ http://app:3000  (internal Docker network)
                           ▼
            ┌────────────────────────────┐
            │  SvelteKit app (Node 22)   │   the application
            └──────┬─────────────┬───────┘
                   │             │
                   │             └─▶ /app/evidence-data  (Docker volume)
                   │                  uploaded student artifacts
                   ▼
            ┌────────────────────────────┐
            │  Postgres 16               │   single relational store
            │  (Docker volume)           │   students, submissions, hours,
            └────────────────────────────┘   evidence_files, course_catalog,
                                             course_enrollment, regents_scores,
                                             users, audit_log, auth_tokens

Outbound:
  └─▶ District SMTP server (port 587 STARTTLS) — supervisor confirmations,
      student progress reports, staff magic-link sign-in

GNPS-hosted Linux VM, single host:
  ~1 GB RAM total · 1 vCPU steady-state · ~1 GB disk growth/year
```

**Trust boundary:** everything inside the Docker network is private. Only Caddy is on the public interface. Postgres + the app are not internet-reachable.

**Phase 2 enhancement (deferred):** swap self-hosted magic-link auth for district SSO (ClassLink / Google Workspace / Azure AD); add live Infinite Campus integration to replace quarterly CSV uploads. Code already supports both paths; only requires district IT decisions on identity provider + IC vendor coordination.

---

## Cost trajectory

| Deployment | Cost | Notes |
|---|---|---|
| Self-hosted on GNPS infrastructure (recommended) | District-internal cost only — no third-party SaaS fees | Existing Linux host, district SMTP, district backup; ~1 hr/wk steady-state ops |
| Demo / prototype on managed SaaS (Vercel + Supabase + Resend) | $0/mo on free tiers at GNPS scale | **Not a recommended production architecture.** Useful only as a non-production demo, with no real student data, where district policy permits. Vendors are replaceable; the workflow is the value. |

GNPS scale (~6,800 students; ~412 per graduating class) is well within the resource footprint of a single 2 vCPU / 4 GB RAM Linux VM for years.

---

## What we are NOT asking

- **No new infrastructure procurement.** The recommended path uses an existing Linux host inside GNPS infrastructure.
- **No third-party vendor lock-in.** Vercel, Supabase, and Resend were prototype/demo choices, not required vendors. The repository ships a self-hosted Docker stack as the recommended production architecture, and the codebase is MIT-licensed and portable.
- **No student data on third-party SaaS for production.** Recommended deployment keeps student records on district infrastructure.
- **No CMS migration.** Finalsite stays as-is. Integration option A (recommended) is just a DNS CNAME alongside existing Finalsite hosting.

---

## Infinite Campus integration — demonstrated end-to-end

The system already accepts IC data and auto-counts the Civic Knowledge column. The proof is on the live demo right now.

**The format we need from IC** (one row per student × course-or-exam):

```
student_id,last_name,first_name,grad_year,kind,code,year_or_date,score_or_credit,safety_net_applied
GN20271234,Goldberg,Maya,2027,course,SS_GLOBAL_II,2025-2026,passed,
GN20271234,Goldberg,Maya,2027,regents,GLOBAL_II,2026-06-15,87,false
GN20275511,Chen,David,2027,course,AP_US_GOV,2026-2027,passed,
…
```

The final `safety_net_applied` field is Regents-only. It should be `true` when IC marks a safety-net, special-appeal, or 45-variance case that NYSED allows to count for the 1c proficiency point.

A counselor (or admin) drops this CSV at `/admin/import` (UI is live now). The system parses, validates, shows a diff (new / updated / unchanged), and commits. From that moment forward, the cohort roster auto-populates.

**Demonstrated with a 5-student sample class (uploaded May 4, 2026 to validate the pipeline):**

| Student | SS credits passed | Advanced SS courses | Regents scored | Auto-counted Knowledge points | Status |
|---|---|---|---|---|---|
| David Chen (GN20275511) | 4 | 0 | Global II 72 (P) + US History 91 (M) | **3.5** | Knowledge column ≥2 ✓ |
| Maya Goldberg (GN20271234) | 2 | 1 | Global II 87 (M) | **2.0** | Knowledge column ≥2 ✓ |
| Aanya Patel (GN20274432) | 2 | 2 | Global II 93 (M) | **2.5** | Knowledge column ≥2 ✓ |
| Sofia Rivera (GN20277890) | 4 | 1 | Global II 89 (M) + US History 86 (M) | **4.5** | Knowledge column ≥2 ✓ |
| Sean O'Hara (GN20283344) | 1 | 0 | (none yet) | 0.0 | underclassman — auto-counts as evidence accumulates |

These point totals were computed by the system from the IC CSV alone — no student input. Four out of five sample students have already cleared the Civic Knowledge column requirement just from coursework + Regents performance. They now only need to accumulate ≥2 Civic Participation points (service hours, projects, etc.) via the public submission forms.

**This is the value of the auto-populate.** Counselors don't re-key data that the SIS already has, and students don't have to claim points they've already earned in class.

**Phase 1 path (today):** counselor exports a custom report from IC quarterly, uploads at `/admin/import`. Free, works now, no IT integration project needed.

**Phase 2 path (when IT is ready):** OneRoster API or nightly SFTP-export job replaces the manual upload. Same destination tables, same point math, just automated.

A sample CSV in the exact format is committed to the repo at [docs/sample-ic-data.csv](https://github.com/SirhanMacx/gnps-civic-readiness/blob/main/docs/sample-ic-data.csv) — IT can use it as a target for the IC export query.

---

## Why this benefits GNPS

1. **Closes a competitive gap.** Peer Long Island districts (Seaford, 3 Village, Connetquot) already publish Seal of Civic Readiness pages. GNPS has no program; this fixes that on a fast timeline.
2. **Better than peer implementations.** Peer districts use Microsoft / Google Forms feeding counselor inboxes — no central tracker, manual roll-up, end-of-year crunch. The proposed system gives counselors a live roster and produces NYSED audit packs automatically.
3. **Open-source positioning.** Repo is MIT-licensed and forkable. Other NYS districts can adopt the GNPS implementation rather than building their own — a leadership artifact for Curriculum & Instruction and the Board.
4. **Phased risk.** Phase 1 is reversible. If the system doesn't deliver value in pilot, IT involvement never escalates. If it does, Phase 2 promotion is well-scoped.

---

## Repository & contact

- **Live demo:** https://gnps-civic-readiness.vercel.app (try `/about`, `/submit`, `/submit/service`)
- **Source code:** https://github.com/SirhanMacx/gnps-civic-readiness — MIT-licensed, transferable to a GNPS-owned org on approval
- **Contact:** Jon — Social Studies Department, Great Neck Public Schools

The full design document (architecture, data model, user flows, NYSED compliance mapping, repository structure, risks) is available as a 27-page companion PDF/DOCX.
