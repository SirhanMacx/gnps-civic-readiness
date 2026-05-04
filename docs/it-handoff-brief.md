# GNPS Civic Readiness Portal — IT Handoff Brief

**For:** Great Neck Public Schools Technology Department
**From:** Social Studies Department
**Re:** NYS Seal of Civic Readiness tracking portal — integration asks
**Date:** May 4, 2026

**Live demo:** https://gnps-civic-readiness.vercel.app
**Source code (MIT):** https://github.com/SirhanMacx/gnps-civic-readiness

---

## What this is

An open-source web portal for tracking the New York State Seal of Civic Readiness — the +1 Diploma Pathway distinction approved by the NYS Board of Regents in 2021. The portal collects civic-knowledge data (auto-pulled from Infinite Campus where possible) and civic-participation evidence (service hours, projects, capstones submitted by students with supervisor and counselor verification). At year-end it produces a NYSED-compliant audit pack and a roster CSV for the transcript office.

**Phase 1 has zero IT dependency.** The application ships on free-tier SaaS (Vercel + Supabase + Resend), runs at $0/mo, and gives Social Studies a working URL within ~4 weeks of development start.

The items below are required only to **promote from Phase 1 (staff pilot) to Phase 2 (full launch with student-facing portal, district SSO, and live Infinite Campus integration).** They are listed in the order they typically need to be addressed.

---

## What we're asking of GNPS Technology

| # | Ask | Effort | Owner |
|---|---|---|---|
| 1 | NYSED district application (Application Business Portal) — gates *awarding* of seals on transcripts | ~30 days state review | Curriculum & Instruction (not IT) |
| 2 | Domain CNAME — point `civicseal.greatneck.k12.ny.us` (or chosen subdomain) to Vercel | ~5 minutes | Network/DNS |
| 3 | FERPA / privacy review of the Phase 1 architecture (Supabase US-East, encrypted at rest + in transit, role-based access, full audit log); sign Supabase DPA if district policy requires | ~1–2 hours | Privacy/Compliance + IT |
| 4 | SSO integration — choose ClassLink / Google Workspace / Azure AD; configurable in Supabase Auth providers (no application code change) | ~1 day | Identity Management |
| 5 | Infinite Campus integration — read access to roster, course enrollment, Regents scores. Either OneRoster API or nightly CSV/SFTP export works | ~2–4 hours scoping; setup varies | SIS Administrator |
| 6 | Email reputation — supervisor confirmations send from `civicseal@greatneck.k12.ny.us`. Either use district SMTP creds, or keep Resend and add SPF/DKIM records to GNPS DNS for the subdomain | ~30 minutes | Email Administrator |
| 7 | Website integration — choose one of: (A) **subdomain CNAME** [recommended], (B) iframe embed in Finalsite page, (C) reverse proxy via Finalsite or Cloudflare | A: 5 min · B: 30 min · C: ½ day | Web team |
| 8 | Long-term hosting decision — keep free-tier Vercel + Supabase under a district-paid account (handles GNPS scale for years), or self-host the same code on GNPS infrastructure. No code changes either way | District policy decision | IT Leadership |

---

## Architecture summary (Phase 2 target)

```
                      ┌─────────────────────────────────┐
   Students ─────▶    │  civicseal.greatneck.k12.ny.us  │
   Counselors ───▶    │     (Vercel · SvelteKit app)    │
   SCRC ─────────▶    └────────┬────────────────────────┘
                               │
                       ┌───────┴──────────────────────────┐
                       │                                  │
                       ▼                                  ▼
              ┌──────────────────┐             ┌──────────────────┐
              │  Supabase        │             │  GNPS Identity   │
              │  Postgres + Auth │             │  Provider (SSO)  │
              │  (FERPA-DPA'd)   │             │  ClassLink/      │
              └────┬─────────────┘             │  Google/Azure    │
                   │                           └──────────────────┘
                   │ nightly sync
                   ▼
          ┌──────────────────────┐
          │  Infinite Campus     │
          │  (OneRoster API or   │
          │   SFTP CSV export)   │
          └──────────────────────┘

Email out: Resend → SPF/DKIM-aligned to greatneck.k12.ny.us
```

---

## Cost trajectory

| Phase | Vercel | Supabase | Resend | **Total** |
|---|---|---|---|---|
| Phase 1 (free tiers) | $0 | $0 | $0 | **$0/mo** |
| Phase 2 (typical at GNPS scale) | $0 | $0–25 | $0 | **$0–25/mo** |
| Self-hosted alternative | GNPS infrastructure + ops time | Same | District SMTP or Resend | District-internal cost |

GNPS scale (~6,800 students; ~412 per graduating class) fits comfortably within all three free tiers for years. Supabase Pro at $25/mo only becomes relevant if the district wants daily backups beyond the free-tier point-in-time recovery, or if the database exceeds 500 MB (unlikely until ~year 5 at GNPS scale).

---

## What we are NOT asking

- **No new infrastructure procurement.** Phase 1 doesn't touch GNPS infra.
- **No vendor contracts to negotiate.** All Phase 1 services are usable on free tiers under district-owned accounts or under existing personal accounts during pilot.
- **No proprietary lock-in.** Codebase is MIT-licensed and portable. If the district later decides to self-host, that path is supported with no application code changes.
- **No student data leaves the United States.** Supabase US-East region is the only data-residency point.
- **No CMS migration.** Finalsite stays as-is. Integration option A (recommended) is just a DNS CNAME alongside existing Finalsite hosting.

---

## Infinite Campus integration — demonstrated end-to-end

The system already accepts IC data and auto-counts the Civic Knowledge column. The proof is on the live demo right now.

**The format we need from IC** (one row per student × course-or-exam):

```
student_id,last_name,first_name,grad_year,kind,code,year_or_date,score_or_credit
GN20271234,Goldberg,Maya,2027,course,SS_GLOBAL_II,2025-2026,passed
GN20271234,Goldberg,Maya,2027,regents,GLOBAL_II,2026-06-15,87
GN20275511,Chen,David,2027,course,AP_US_GOV,2026-2027,passed
…
```

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
