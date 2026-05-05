# NYS Seal of Civic Readiness Portal

<img src="https://resources.finalsite.net/images/f_auto,q_auto,t_image_size_2/v1719848341/greatneckk12nyus/mapstlq0ll8etgbkht69/NewGNPSLogoRound.png" alt="GNPS" width="80" align="right">

**Open-source web portal for tracking the New York State Seal of Civic Readiness.** Built by Great Neck Public Schools — Social Studies Department. MIT-licensed. Forkable by any New York district.

**Live demo:** https://gnps-civic-readiness.vercel.app

---

## What this is

The [NYS Seal of Civic Readiness](https://www.nysed.gov/standards-instruction/seal-civic-readiness-information) is a +1 Diploma Pathway distinction approved by the Board of Regents in 2021. Students earn the Seal — a transcript-and-diploma marker — by accumulating six points across two columns (Civic Knowledge and Civic Participation) over grades 9–12.

Most New York districts that offer the Seal collect evidence with Microsoft Forms or Google Forms feeding counselor inboxes. There is no central tracker, course/Regents data is re-keyed manually, and end-of-year roll-up is a manual aggregation burden.

This portal does it differently: a public submission landing page (mirrors district branding), supervisor email confirmation for service hours, counselor and SCRC committee approval queues, an admin roster with live point computation against the NYSED rules, and a year-end NYSED audit-pack export (per-student PDFs + roster CSV + evidence files in a zip).

## Status

**Phase 1 — pilot, feature-complete demo.** The live demo includes public evidence intake for all non-SIS pathways, staff review queues, Infinite Campus CSV import, roster point calculation, and NYSED audit-pack export. **Phase 2** (live Infinite Campus integration, district SSO, student-facing progress portal, transcript write-back) is deferred until district IT review.

## How it works

```
Student → /submit/service          → Supabase (students, pathway_submissions,
                                      hours_log, audit_log)
                                   ↓
              ┌─ supervisor email auto-sent (Phase 1: Resend) ─┐
              ↓                                                 ↓
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

**Phase 1 stack:** SvelteKit 2 (frontend + server) on Vercel + Supabase (Postgres + Storage + Auth) + Resend (transactional email). $0/mo on free tiers at GNPS scale (~6,800 students). MIT license on GitHub.

**Phase 2 additions** (deferred until district IT review):
- ClassLink / Google Workspace / Azure AD SSO replaces magic-link auth
- Student-facing portal with live progress and family-visible status
- Live Infinite Campus integration (OneRoster API or nightly export job) replaces the manual CSV import path
- Optional migration to GNPS-hosted Postgres or self-hosted SvelteKit

For full architectural detail see the [design document](dist/GNPS-Civic-Readiness-Portal-Design.pdf) (27 pages, also available as [.docx](dist/GNPS-Civic-Readiness-Portal-Design.docx)) and the [IT-handoff brief](dist/GNPS-IT-Handoff-Brief.pdf) (1 page, [.docx](dist/GNPS-IT-Handoff-Brief.docx)).

## For districts adopting this

Fork the repo, edit `config/district.yaml` (logo URL, colors, district name, support email, course catalog seed, SCRC committee emails), and deploy. Source code does not need to change. See [docs/customization.md](docs/customization.md).

## For developers contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). New pathway logic and submission flows must include tests (Vitest for unit, Playwright for E2E).

## Quick start (local development)

Prerequisites: Node 22+, pnpm 9+, [Supabase CLI](https://supabase.com/docs/guides/cli), Git.

```bash
git clone https://github.com/<owner>/gnps-civic-readiness
cd gnps-civic-readiness
pnpm install
cp .env.example apps/web/.env.local
# Edit apps/web/.env.local — fill in values from your Supabase project

# Either: use Supabase Cloud (recommended)
supabase login
supabase link --project-ref <your-project-ref>
supabase db push

# Or: local Supabase
supabase start

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
