# NYS Seal of Civic Readiness Portal — Executive Summary

**For:** Great Neck Public Schools leadership · district administration · Board of Education
**Project lead:** Jon · Social Studies Department
**Status:** v0.2.0 — feature-complete prototype, ready for GNPS technology/curriculum review and district-approved deployment planning

---

## What this is

A web portal that **organizes and tracks every student's progress toward the New York State Seal of Civic Readiness** — the +1 Diploma Pathway approved by the Board of Regents in 2021. The Seal recognizes students who demonstrate civic knowledge, civic skills, civic mindsets, and civic experiences across grades 9–12.

Today, GNPS has no infrastructure for this. Peer Long Island districts (Seaford, 3 Village, Connetquot) collect evidence with Microsoft or Google Forms feeding counselor inboxes — no central tracker, no live progress, no audit trail. **Great Neck can do better.**

## What's been built

A fully-functional portal that handles every NYSED-defined pathway. Students submit evidence; supervisors confirm hours by email; teachers push points for class-wide projects; counselors and the Civic Readiness Committee review and approve; admins generate the year-end NYSED audit pack.

Under the hood: 11 pathways (NYSED-compliant), 10 schema migrations, 121 automated tests, MIT-licensed open-source code on GitHub, and a Docker-based self-hosted deployment path for GNPS infrastructure. If GNPS prefers managed services, those providers can be selected through the district's normal approval process.

## What it does for each audience

| Audience | What they get |
|---|---|
| **Students** | A single GNPS-branded URL to submit hours, projects, and reflections. After every submission, an automatic personalized progress report email arrives — current points, what's still needed, recent activity. |
| **Families** | The same progress report cc'd to the student's faculty advisor. Phase 2: family-visible read-only dashboard. |
| **Teachers** | Quick-Push UI: pick a pathway (e.g. "1.5 pts for HS Civic Project"), paste a class roster, push the points to all students in one action. NYSED cap rules enforced automatically. |
| **Counselors** | Live caseload roster with auto-counted points from Infinite Campus data. Approval queue for reflections + supervisor-confirmed hours. Per-student PDF audit pack download. |
| **Civic Readiness Committee** | Topic-approval queue (pre-work) + scoring queue (post-work) using the official NYSED rubrics for research projects, civic projects, and the capstone. |
| **Admin / Curriculum office** | Full cohort roster, IC CSV import (auto-counts ~50–80% of points without student input), course catalog management, staff invites, year-end NYSED audit-pack zip export. |
| **GNPS IT** | Docker stack (`docker compose up`) on a single Linux VM. No required SaaS vendor. Migration runner. Backup script. Full ops runbook. |
| **NYSED auditors** | Per-student audit-record PDF with point breakdown, evidence list, rubric scores, and audit-log excerpt. Roster CSV of all awarded students. Bundled as a year-end zip. |

## Why this matters strategically

1. **Closes a competitive gap.** Peer districts already have programs; GNPS doesn't. Launching gives our students the same NYSED recognition.
2. **Surpasses peer implementations.** Their forms-based approaches lose evidence and stress counselors at year-end. Ours is a real tracker with audit defensibility.
3. **Serves civics education well.** The NYSED Seal is structurally aligned with the kind of civic engagement Great Neck values — service learning, advocacy projects, AP government, capstones. The portal makes it easy to recognize students who are already doing this work.
4. **District-controlled.** The recommended path can be self-hosted on GNPS infrastructure; any managed provider path remains a district approval decision. Real student data should never enter an unapproved demo environment.
5. **Open-source artifact.** Other Long Island and NYS districts can adopt the GNPS implementation. Positions Great Neck as the originator of an open civic-readiness standard.

## What's needed to go live

| Stakeholder | Action | Effort |
|---|---|---|
| Curriculum & Instruction | Apply to NYSED via the SED Application Business Portal (~30 days state review) | one-time |
| C&I + Social Studies | Form / formalize the Seal of Civic Readiness Committee (NYSED-required body that approves project topics + scores capstones) | one-time |
| GNPS Technology | Provision a Linux VM, set up DNS, provide SMTP credentials, run `docker compose up` | ~half a day |
| Privacy / Compliance | FERPA review of the selected deployment architecture and provider path | ~1 hour |

Detailed runbook at [`docs/it-runbook.md`](it-runbook.md). IT-specific brief at [`docs/it-handoff-brief.md`](it-handoff-brief.md). Current meeting guidance is in [`docs/meeting-brief.md`](meeting-brief.md) and the forwardable packet in `dist/admin-share/`.

## Cost

The self-hosted path can run with **$0/month in required third-party application fees** on existing GNPS infrastructure. If GNPS chooses managed providers for hosting, database, email, storage, or backups, cost and contracts should be handled through the normal district approval process. The main ongoing internal cost is IT staff time for maintenance (estimated <1 hour/week at steady state).

## Timeline

| Milestone | Status |
|---|---|
| Research, design, spec, plan | ✅ done |
| Phase 1 development | ✅ done — feature-complete prototype with public demo for sample-data workflow review |
| Phase 1.5 self-host migration | ✅ done — Docker stack, full IT runbook, and no required SaaS vendor dependencies |
| GNPS IT deployment | pending IT scheduling |
| First pilot cohort (Class of 2027) | targeted for fall 2026 onboarding |
| First seals awarded | targeted for June 2027 graduation |
| Phase 2: live IC integration + student SSO | targeted for school year 2027–28 |

## Source + transparency

- **GitHub:** https://github.com/SirhanMacx/gnps-civic-readiness — public, MIT-licensed
- **Latest release:** v0.2.0 (2026-05-04) at https://github.com/SirhanMacx/gnps-civic-readiness/releases/tag/v0.2.0
- **Live demo (prototype only; sample data only):** https://gnps-civic-readiness.vercel.app

## Asks of leadership

1. **Approve** the program launch as a district priority for the 2026–27 school year.
2. **Authorize** Curriculum & Instruction to file the NYSED application.
3. **Authorize** GNPS Technology to provision the deployment.
4. **Form** the Seal of Civic Readiness Committee with members who can pre-approve projects and score capstones (NYSED-required).
5. **Approve** the open-source publication and (eventually) the transfer of the GitHub repo to a GNPS-owned organization.

## Contact

Jon · Social Studies Department · Great Neck Public Schools · civicseal@greatneck.k12.ny.us
