# GNPS Civic Readiness Portal — Design Document

> **Archived prototype design note.** This document records the original May 4 prototype plan. It is not the current production recommendation. For meeting-ready guidance, use `docs/meeting-brief.md`, `docs/go-live-checklist.md`, `docs/deployment-guide.md`, and `docs/it-handoff-brief.md`. Current framing: Infinite Campus remains the system of record; the portal is the workflow, evidence, and audit layer; real student data belongs only in district-approved environments.

**Project:** Open-source web application for tracking the New York State Seal of Civic Readiness at Great Neck Public Schools
**Version:** 1.0 — Design Phase
**Date:** May 4, 2026
**Status:** Design approved by Social Studies Department; awaiting C&I and Technology Department review

---

## Executive summary

The New York State Seal of Civic Readiness ("the Seal") is a state-recognized distinction added to a student's high school transcript and diploma. Earning it requires a documented portfolio of civic knowledge (course credits, Regents performance, research) and civic participation (service-learning, projects, capstones) accumulated across grades 9–12 — six points minimum, with at least two points in each column.

Great Neck Public Schools currently has no infrastructure to track these requirements. Peer Long Island districts (Seaford, Connetquot, 3 Village) have launched programs but rely on Microsoft or Google Forms feeding counselor inboxes — there is no central tracker, no live progress view for students or families, and end-of-year roll-up is a manual aggregation burden.

This document specifies an **open-source web portal**, MIT-licensed, that:

1. **Auto-populates** civic knowledge data (course enrollment, Regents scores) from Infinite Campus exports
2. **Collects** civic participation evidence through a public landing page with a structured submission flow
3. **Routes** evidence through verifiable approval workflows: supervisor-email confirmations for hours, faculty review for reflections, Seal of Civic Readiness Committee (SCRC) review for projects
4. **Surfaces** a live roster dashboard for Social Studies department staff and counselors, with eligibility calculations against the NYSED rubric
5. **Exports** a NYSED-compliant audit pack at year-end (per-student PDFs + roster CSV) for transcript office and possible state audit

The system ships in two phases:

- **Phase 1** (~4 weeks of development) runs entirely on free SaaS (Vercel + Supabase + Resend) at $0/mo, requires zero GNPS infrastructure, and delivers a working public URL that staff can pilot immediately.
- **Phase 2** (after IT integration) adds Single Sign-On for students, a student-facing progress portal, and a live Infinite Campus data feed — reusing the same codebase and database schema.

The repository is published on GitHub under MIT license so other Long Island and New York State districts can fork the implementation. This positions Great Neck as the originator of an open civic-readiness standard rather than a single-district consumer.

---

## Table of contents

1. [Background](#1-background)
2. [Design principles & constraints](#2-design-principles--constraints)
3. [System architecture](#3-system-architecture)
4. [Data model](#4-data-model)
5. [User roles & flows](#5-user-roles--flows)
6. [NYSED compliance mapping](#6-nysed-compliance-mapping)
7. [Phase 1 → Phase 2 roadmap](#7-phase-1--phase-2-roadmap)
8. [IT-handoff brief](#8-it-handoff-brief)
9. [Open-source repository structure](#9-open-source-repository-structure)
10. [GNPS website integration options](#10-gnps-website-integration-options)
11. [Cost analysis](#11-cost-analysis)
12. [Risks & mitigations](#12-risks--mitigations)
13. [Appendices](#13-appendices)

---

## 1. Background

### 1.1 What is the NYS Seal of Civic Readiness?

The Seal of Civic Readiness, established by the NYS Board of Regents in September 2021 as an approved +1 Diploma Pathway, formally recognizes students who have demonstrated civic knowledge, civic skills, civic mindsets, and civic experiences. The Seal appears as a distinction on a student's transcript and diploma.

To earn the Seal, a student must complete all standard NYS diploma requirements **and** earn six points across two columns of pathway options, with a minimum of two points in each column.

**Source:** New York State Seal of Civic Readiness Manual, Updated March 2025 (NYSED, Office of Standards and Instruction); the Criteria document at https://www.nysed.gov/standards-instruction/criteria-earn-seal-civic-readiness.

The Seal does **not** have a "with Distinction" tier (that is a feature of the Seal of Biliteracy, distinct from this seal).

### 1.2 NYSED pathway reference

| # | Pathway | Points | Notes |
|---|---|---|---|
| 1a | 4 credits of social studies (Global I/II, US History, Participation in Government) | 1 | Required for graduation; auto-counts |
| 1b | Mastery (≥85) on Global II or US History Regents | 1.5 | Repeatable — both exams count separately |
| 1c | Proficiency (65–84) on Global II or US History Regents | 1 | Repeatable; approved safety-net, special-appeal, and 45-variance cases honored |
| 1d | Advanced SS course (Honors / Pre-AP / AP / IB / dual-enrollment) | 0.5 | Repeatable; SCRC approves which courses qualify |
| 1e | Civic-knowledge research project | 1 | SCRC pre-approves topic; rubric in NYSED Appendix F |
| 2a | High School Civic Project | 1.5 | Maximum 2 instances → 3-point cap; SCRC approves; rubric in Appendix G |
| 2b | Service-learning (≥25 hrs + reflection) | 1 | Repeatable; 5-stage process; reflection is gating element |
| 2c | Civic-engagement elective (proficiency + application essay) | 0.5 | Repeatable; SCRC maintains course list |
| 2d | Middle school capstone (grades 7–8 only) | 1 | Back-entered at HS intake with MS teacher signoff |
| 2e | Extra-curricular or work-based learning (≥40 hrs + essay) | 0.5 | Repeatable; may accumulate over 4 years |
| 2f | High School Civics Capstone Project | **4** | Single largest pathway; 4 essential elements; SCRC scores against Appendix P |

> **Pathway letters disagree between NYSED documents.** The single-page Criteria PDF and the full Handbook use slightly different letter labels for the participation pathways (e.g., MS Capstone is "2d" in one and "2e" in the other). To avoid ambiguity, **the system keys pathways by name (`pathway_ms_capstone`, `pathway_hs_capstone`, etc.) rather than letter.**

### 1.3 Current state at Great Neck

Great Neck Public Schools currently has no Seal of Civic Readiness program — no application to NYSED, no roster, no submission infrastructure. The Social Studies department has identified launching the program as a priority and is using this design to scope what would need to be built.

### 1.4 Peer-district analysis

Three Long Island districts with active Seal programs were reviewed to understand prevailing practice:

| District | Approach | Submission method | Tracking |
|---|---|---|---|
| **Seaford HS** | Microsoft Forms — "Reflection Worksheet" + separate elective form; counselors collect by May 1 deadline. Three paper forms (Hours Report, Verification, Reflection). 27-course civic-elective list published. | Public form, no auth | Manual roll-up by guidance counselors |
| **3 Village CSD** | Google Site landing page; submissions routed through Director of Social Studies. Mechanism not publicly documented. | Department-driven | Department-internal |
| **Connetquot CSD** | Page exists under Social Studies department; submission details linked but not enumerated on public site. | Same pattern as above | Same |

**The common gap:** none of these districts has a central student-record system tracking SoCR progress in real time. Course/Regents data is re-keyed from the SIS into forms, end-of-year roll-up consumes counselor hours during peak season, and there is no live progress view for students or families. This is precisely what GNPS can leapfrog by building right.

---

## 2. Design principles & constraints

### 2.1 Principles

1. **Ship a usable URL fast.** A working application drives the IT and leadership conversations; a proposal does not.
2. **Phase the integration risk away.** Phase 1 has zero IT dependency. IT involvement is gated to a Phase 2 promotion, after the system has proven its value.
3. **Be NYSED-defensible by default.** Every awarded point traces to verifiable evidence + an audit log. The system can produce the audit pack NYSED would request without manual work.
4. **Open-source from day one.** Other districts can fork. Vendors cannot rent-seek the GNPS implementation.
5. **Brand-match the GNPS website.** The portal feels like an extension of greatneck.k12.ny.us, not a third-party tool.

### 2.2 Constraints

- **No student-facing login in Phase 1.** Avoids the SSO integration cliff that stalls peer-district projects in IT review.
- **Multi-year tracking from day one.** Seal evidence accumulates from 9th grade onward; senior-year-only collection (the peer-district default) loses two thirds of the evidence.
- **Two-tier verification.** Hours need supervisor email confirmation; reflections/artifacts need staff review; course/Regents data is auto-counted from the SIS import. Workload is allocated to where fraud risk actually lives.
- **District must apply to NYSED before awarding seals.** This is a Curriculum & Instruction action, not an IT action, but the system cannot confer seals on transcripts until GNPS is on the NYSED-approved school list.

---

## 3. System architecture

### 3.1 Phase 1 architecture (ship now)

```
Browser ──── HTTPS ────▶  civicseal-gnps.vercel.app  (or subdomain)
                                    │
                         ┌──────────┼──────────┐
                         ▼          ▼          ▼
                    SvelteKit   Supabase     Resend
                    (Vercel)    Postgres     (email)
                                Storage
                                Auth
```

**Component responsibilities:**

| Component | Hosted on | Cost (Phase 1) | Responsibility |
|---|---|---|---|
| **Frontend** — SvelteKit | Vercel free tier | $0 | Public submission form, supervisor confirm pages, counselor/SCRC/admin portals, roster dashboard, exports |
| **Database** — Supabase Postgres | Supabase free tier (500 MB DB, 1 GB file storage) | $0 | Students, submissions, evidence, audit log, course catalog |
| **File storage** — Supabase Storage | Same | $0 | Reflection essays, artifact uploads, supervisor confirmation receipts |
| **Auth** — Supabase Auth (magic link) | Same | $0 | Counselor / SCRC committee / admin login. No student auth in Phase 1. |
| **Email** — Resend | Resend free tier (3,000/mo) | $0 | Supervisor confirmation links, counselor notifications. **Phase 1 sends from a Resend-managed verified domain** (e.g. `civicseal-gnps@resend.dev`) until item #6 of the IT-handoff brief is completed (SPF/DKIM on greatneck.k12.ny.us subdomain). Email body explains the unfamiliar sender. |
| **Domain** — Custom subdomain | GNPS DNS or Vercel-provided | $0 | civicseal.greatneck.k12.ny.us |

### 3.2 Phase 2 architecture (after IT integration)

The Phase 2 architecture is the same code, with three substitutions:

| Component | Phase 1 | Phase 2 |
|---|---|---|
| Student auth | Not present | ClassLink / Google Workspace / Azure AD SSO via Supabase Auth providers |
| SIS data ingestion | Counselor uploads CSV | Live Infinite Campus feed (OneRoster API or nightly export to S3/SFTP) |
| Hosting | Vercel free / Supabase free | IT decides: keep SaaS under district account, or self-host (Postgres + reverse proxy on GNPS infrastructure) |

Phase 2 also unlocks the **student-facing portal**: each student logs in, sees a live progress bar, submits evidence themselves, and family members can be granted read-only view access. Counselor and admin views remain.

The codebase does not change between phases — only configuration. This is intentional: it means the IT promotion conversation is "flip these three switches once," not "rebuild the application."

---

## 4. Data model

### 4.1 Core entities

```
students
  ├── id (text, e.g. GN20271234)
  ├── last_name, first_name
  ├── grad_year (int, e.g. 2027)
  ├── counselor_id (fk → users)
  ├── accommodations_flag (bool, IEP/504 — drives Regents safety-net handling)
  ├── transferred_in_date (date, nullable)
  └── status (enum: active, awarded, withdrawn, graduated_without_seal)

course_catalog
  ├── id, course_code, title
  ├── counts_for (array: '1a' | '1d' | '2c')
  ├── credits (decimal)
  ├── scrc_approved (bool, true after committee blesses)
  └── scrc_approved_at, scrc_approved_by

course_enrollment
  ├── student_id (fk)
  ├── course_id (fk)
  ├── school_year, term
  ├── final_grade (int 0-100)
  └── credit_status (enum: passed, failed, in_progress)

regents_scores
  ├── student_id (fk)
  ├── exam_code (enum: 'GLOBAL_II', 'US_HISTORY')
  ├── score (int 0-100)
  ├── exam_date
  ├── safety_net_applied (bool, safety-net / special-appeal / 45-variance)
  └── proficiency_level (computed: 'mastery' if ≥85, 'proficiency' if 65-84, 'safety_net_pass' if 45-64 + flag)

pathway_submissions  ◀── central entity for pathways with submitted evidence
                       (participation + research projects).
                       SIS-derived pathways do NOT have rows here — they are
                       computed at read time from course_enrollment + regents_scores
                       (see §4.2 SIS-derived pathway lifecycle).
  ├── id, student_id (fk)
  ├── pathway_type (enum: research_project, hs_civic_project,
  │                       service_learning, civic_elective_essay,
  │                       wbl_extracurr, ms_capstone, hs_capstone)
  │   note: civic_elective_essay covers the application-of-knowledge essay
  │         component of pathway 2c; the proficiency-grade component is
  │         computed from course_enrollment, not stored here.
  ├── status (enum: draft, proposed, topic_approved, in_progress,
  │                 submitted, scored, awarded, rejected, revoked)
  ├── points_awarded (decimal, nullable)
  ├── instance_number (int, for repeatable pathways and 2x-cap on hs_civic_project)
  ├── domain_tags (array: 'knowledge', 'skills', 'mindsets', 'experiences')
  ├── proposed_at, topic_approved_at, submitted_at, scored_at, awarded_at
  ├── proposed_by_text, topic_approved_by (fk → users), scored_by (fk → users)
  ├── rubric_scores (jsonb — pathway-specific rubric data)
  └── notes (text, free-form reviewer comments)

hours_log  (1:N from pathway_submissions for service_learning + wbl_extracurr)
  ├── submission_id (fk)
  ├── activity_name, organization
  ├── service_type (enum for 2b: direct, indirect, advocacy)
  ├── hours, date_start, date_end
  ├── supervisor_name, supervisor_email, supervisor_org
  ├── confirmation_token (uuid, signed)
  ├── confirmation_status (enum: pending, confirmed, disputed, expired)
  ├── confirmation_sent_at, confirmation_responded_at
  └── confirmer_ip (audit)

evidence_files
  ├── id, submission_id (fk)
  ├── storage_path (Supabase storage ref)
  ├── filename, mime_type, size_bytes
  ├── kind (enum: reflection_essay, artifact, presentation,
  │              supervisor_receipt, rubric_scoresheet)
  ├── domain_tags (array, links to NYSED civic-readiness domains)
  └── uploaded_at, uploaded_by

users  (staff only — counselors, SCRC committee, admins)
  ├── id, email
  ├── role (enum: counselor, scrc_member, admin)
  ├── full_name
  └── caseload_filter (jsonb — counselors see assigned students by default)

audit_log
  ├── id, occurred_at, actor_id (fk → users, nullable for student/supervisor actions)
  ├── action (enum: student_submitted, supervisor_confirmed, counselor_approved,
  │                 scrc_approved_topic, scrc_scored, admin_imported_csv,
  │                 admin_exported_audit_pack, ...)
  ├── target_type, target_id
  ├── ip, user_agent
  └── data (jsonb — relevant field values before/after)
```

The audit_log is **append-only** — its retention policy is "indefinite while seal records exist." NYSED can audit a district at any time to verify that students who received the seal genuinely earned it.

### 4.2 Pathway lifecycles

**Project-type pathways** (`research_project`, `hs_civic_project`, `hs_capstone`, `ms_capstone`):

```
[draft] ──student-edits──▶ [proposed]
                                │  SCRC reviews
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
        [topic_approved]   [proposed]    [rejected]
                │            (revisions)
                │ student does the work
                ▼
            [in_progress]
                │ student uploads evidence + reflection
                ▼
            [submitted]
                │ SCRC scores against NYSED rubric
                ▼
            [scored]  ◀── points calculated, written to record
                │ counselor confirms point total enters seal calculation
                ▼
            [awarded]
```

**Hours-based pathways** (`service_learning`, `wbl_extracurr`):

```
[student logs hours] → [supervisor email auto-sent with signed link]
                                │
                                ▼
                       [supervisor clicks confirm or dispute]
                                │
                                ▼  (after 25 hrs for 2b, 40 hrs for 2e accumulated)
                       [student writes reflection]
                                │
                                ▼
                       [counselor reviews reflection]
                                │
                                ▼
                       [scored / awarded]
```

**SIS-derived pathways** (1a 4-SS-credits, 1b/1c Regents proficiency, 1d advanced SS, 2c civic-elective proficiency component):

```
[CSV import or live IC sync] → [course_enrollment + regents_scores rows] → [points computed at read time]
                                                                                      │
                                                                                      ▼
                                                                        [appears on roster, no review]
```

**These pathways have no `pathway_submissions` row.** They are evaluated by querying `course_enrollment` and `regents_scores` against `course_catalog.counts_for` and the Regents proficiency thresholds. The system represents them in API responses as virtual pathway records (with stable computed IDs like `sis:1a:GN20271234`) so the frontend can render them in the same roster UI as evidence-backed pathways without special-casing.

The civic-elective pathway (2c) splits across systems: the proficiency *grade* component comes from IC (computed), but the *application-of-knowledge essay* component is an evidence file the student submits and is stored as a `civic_elective_essay` row in `pathway_submissions`. Points award only when both halves exist for the same course-year.

### 4.3 Rules baked into the data layer

- 2a (HS Civic Project) caps at 2 instances → maximum 3 points
- 1b/1c/1d/2b/2c/2d/2e: repeatable, no cap
- 2d (MS Capstone, in the criteria-PDF labeling) only counts if grade level at submission was 7 or 8
- 2e (extra-curr/WBL) hours may aggregate across multiple activities and across all four years of HS
- A student is `eligible` when: total points ≥ 6 AND knowledge column ≥ 2 AND participation column ≥ 2
- `eligible` is not the same as `awarded`; counselor must confirm to advance the state
- Approved safety-net, special-appeal, and 45-variance Regents cases are scored as proficiency for 1c

### 4.4 Infinite Campus CSV import format (Phase 1)

Counselor-uploaded CSV, one row per (student, course-or-exam) pair:

```csv
student_id,last_name,first_name,grad_year,kind,code,year_or_date,score_or_credit,safety_net_applied
GN20271234,Goldberg,Maya,2027,course,SS_GLOBAL_II,2024-2025,passed,
GN20271234,Goldberg,Maya,2027,course,SS_US_HISTORY,2025-2026,passed,
GN20271234,Goldberg,Maya,2027,regents,GLOBAL_II,2025-06-15,87,false
GN20271234,Goldberg,Maya,2027,regents,US_HISTORY,2026-06-12,45,true
GN20271234,Goldberg,Maya,2027,course,AP_US_GOV,2026-2027,in_progress,
```

**Fields:**
- `kind ∈ {course, regents, demographic}`
- `code` is a course code (matched against `course_catalog`) or exam code (`GLOBAL_II`, `US_HISTORY`)
- `year_or_date`: school year (`YYYY-YYYY`) for courses, exam date (`YYYY-MM-DD`) for Regents
- `score_or_credit`: integer Regents score (0–100), or one of `passed | failed | in_progress`
- `safety_net_applied`: optional Regents-only boolean for safety-net / special-appeal / 45-variance cases

The importer validates and reports a diff: which rows are new, which update existing records, which are unchanged. Admin reviews the diff before committing. All imports write to `audit_log` with the source filename and row count.

For the Phase 2 live IC integration, the JSON shape coming from OneRoster or a custom IC export will be transformed by an adapter into this same internal shape — so the rest of the system does not change.

### 4.5 NYSED audit pack export format

Year-end exports produce a zip per graduation cohort:

```
nysed_audit_pack_class_of_2027.zip
├── roster.csv                          ← all 412 students, status column
├── awarded_students.csv                ← subset who were awarded (transcript office input)
├── per_student/
│   ├── GN20271234_Goldberg_Maya.pdf   ← portfolio: pathways, evidence list, rubrics, audit log excerpt
│   ├── GN20275511_Chen_David.pdf
│   └── …
├── evidence_files/
│   ├── GN20271234/                    ← all uploaded artifacts
│   │   ├── service_learning_reflection.pdf
│   │   ├── capstone_artifact_v3.pdf
│   │   └── …
│   └── …
└── audit_log_excerpt.csv              ← every state transition, signed
```

The per-student PDF is the document a NYSED auditor would review.

---

## 5. User roles & flows

### 5.1 Roles

| Role | Phase 1 auth | Phase 2 auth | Capabilities |
|---|---|---|---|
| **Student** | None — submission keyed by Student ID + last name + grad year (de-duped server-side) | District SSO (ClassLink / Google / Azure) | Submit evidence; view own progress (Phase 2) |
| **Supervisor** | None — signed email link | Same | Confirm or dispute hours via one-click email link (no account) |
| **Counselor** | Magic-link login | District SSO | Review hours/reflections, approve point awards, see own caseload roster |
| **SCRC Committee Member** | Magic-link login | District SSO | Pre-approve project topics; score completed projects against NYSED rubrics |
| **Admin** | Magic-link login | District SSO | Manage course catalog, import IC CSV, manage user roster, generate NYSED audit pack |

### 5.2 Student submission flow (example: service-learning hours)

1. Student visits `civicseal.greatneck.k12.ny.us/submit`
2. Enters Student ID + last name + grad year → server matches roster record
3. Selects pathway (Service-Learning) → form adapts to NYSED requirements:
   - Activity / organization name
   - Date range
   - Hours this submission
   - Service type (NYSED-defined: Direct, Indirect, Advocacy)
   - Supervisor name + email
   - Brief description (1–3 sentences)
4. On submit:
   - `pathway_submissions` row created with `status = submitted`
   - `hours_log` row created with `confirmation_status = pending`
   - `audit_log` records the event
   - System emails supervisor a signed confirmation link
   - Student sees confirmation: "Your hours are pending supervisor confirmation. You can add reflection later."

### 5.3 Supervisor confirmation flow

1. Supervisor receives email. In Phase 1, the sender is a Resend-managed verified address (the email body identifies the program and links back to the GNPS-themed portal so recipients can sanity-check legitimacy). In Phase 2, sender becomes `civicseal@greatneck.k12.ny.us` once SPF/DKIM are added.
2. Email body: brief context + two buttons (`Confirm 8 hours` / `Hours don't match`)
3. Supervisor clicks → lands on a no-auth page with the signed token
4. Server validates token, marks `hours_log` row `confirmed`, records IP + timestamp in audit log
5. Confirmation page shows: "Thanks. Maya can now use these hours toward her Seal of Civic Readiness."

The confirmation link expires in 14 days. If a supervisor clicks "Hours don't match," they're prompted with a textarea to indicate the correct hours; this routes to the counselor queue for resolution.

### 5.4 SCRC committee project review flow

1. Student proposes a project topic via `/submit?type=hs_capstone` — provides issue identification, scope, civic-experience plan, advisor name, mapping to the four NYSED domains
2. Submission lands in SCRC dashboard with status `proposed`
3. SCRC member reviews against NYSED Appendix P essential elements:
   - Identify an issue (local/state/national/global) ✓
   - Apply civic knowledge, skills, actions, and mindsets ✓
   - Engage in a civic experience to influence positive change ✓
   - Present overall project to the school's Civic Readiness Committee (deferred until completion)
4. Three actions: Approve topic / Request revisions / Reject
5. On approval, `status = topic_approved`, student receives email, can begin work
6. After student completes work and uploads evidence, status moves to `submitted`
7. SCRC member scores against the published rubric (Appendix P for HS Capstone, F for Research Project, G for HS Civic Project) — rubric scores stored as JSON
8. On scoring complete, points await counselor confirmation to enter the seal calculation

### 5.5 Counselor approval queue

1. Counselor logs in via magic link → lands on dashboard scoped to caseload
2. Approval queue lists all `submitted` reflections + `confirmed`-but-unreflected hours-based submissions
3. Each item shows:
   - Student name + ID + grade
   - Pathway type + claim ("Service-Learning, 25hrs, all 5 stages addressed")
   - Inline reflection text (so counselor doesn't need to download)
   - Supporting evidence file list
   - Three actions: Approve · award N points · Request revision · Decline
4. Approval writes points to the submission record, advances to `awarded`, records in audit log

### 5.6 Admin operations

- **Roster import**: drag-and-drop CSV from IC, preview diff, commit
- **Course catalog**: edit which courses count for which pathways; SCRC approval recorded
- **User management**: invite counselors and SCRC members by email, assign caseloads
- **NYSED audit pack export**: one click, generates the zip described in §4.5
- **Cohort review**: filter roster by grad year, status, eligibility; bulk transition `eligible` → `awarded` after final review

---

## 6. NYSED compliance mapping

Every awarded point traces to a NYSED rule citation. The system enforces these by default and surfaces them in audit-pack PDFs:

| Pathway | NYSED rule | Evidence retained |
|---|---|---|
| 1a — 4 SS credits | Manual p.10 | Course enrollment records (IC) |
| 1b — Mastery Regents | Manual p.10 | Regents score records (IC) |
| 1c — Proficiency Regents | Manual p.10 | Regents score records (IC) |
| 1d — Advanced SS | Manual p.10 | Course enrollment + course catalog flag |
| 1e — Research Project | Manual p.12, rubric in Appendix F | SCRC topic approval + completed artifact + rubric scoresheet + reflection |
| 2a — HS Civic Project | Manual p.17, rubric in Appendix G | SCRC topic approval + artifact + rubric scoresheet + reflection |
| 2b — Service Learning | Manual p.20, 5-stage process | Hours log + supervisor confirmations + reflection covering all 5 stages |
| 2c — Civic Elective | Manual p.23 | Course enrollment + grade + application-of-knowledge essay |
| 2d — MS Capstone | Manual p.24, essential elements | MS teacher signoff + artifact + reflection (back-entered at 9th grade) |
| 2e — Extra-curr/WBL | Manual p.23 | Hours log + supervisor confirmations + application essay |
| 2f — HS Capstone | Manual p.26, 4 essential elements + rubric in Appendix P | SCRC topic approval + civic experience evidence + presentation + rubric scoresheet + reflection |

The four NYSED civic-readiness domains (Knowledge / Skills / Mindsets / Experiences) are surfaced as required tags on every reflection submission. This lets the audit pack PDF include a "domains addressed" matrix per student, which is how NYSED auditors evaluate whether a student's portfolio actually demonstrates civic readiness rather than merely accumulating points.

**Testing accommodations and appeals:** Regents safety-net passes, special appeals, and 45-variance cases are honored equivalently to standard proficiency when the imported Regents row has `safety_net_applied=true`.

---

## 7. Phase 1 → Phase 2 roadmap

### Phase 1 — Pilot launch (Weeks 0–4 from development start)

| Week | Deliverable |
|---|---|
| 1 | Repository scaffolded; Postgres schema migrated; magic-link auth working for staff roles; GNPS theme tokens applied |
| 2 | Public submission form (all 6 pathway types); supervisor email confirmation flow; audit log writes |
| 3 | Counselor approval queue; SCRC project-proposal review; admin roster + progress calculations; CSV import; course catalog editor |
| 4 | NYSED audit-pack export; pilot deploy; onboarding documentation |

**Phase 1 audience:** Social Studies department + a small counselor pilot. Not yet promoted to students or families.

### Phase 1.5 — Pilot stabilization (Months 1–3 in production)

- First cohort of senior submissions runs end-to-end
- SCRC committee onboarded (or formed if it does not yet exist)
- Workflow gaps documented for the IT brief
- District applies to NYSED via the SED Application Business Portal — gates the actual conferral of seals on transcripts

### Phase 2 — IT-integrated full launch

- District SSO (ClassLink / Google Workspace / Azure AD) replaces magic-link auth
- Student-facing portal with live progress bar and self-service evidence submission
- Family-visible read-only progress view
- Live Infinite Campus sync (OneRoster API or nightly export job) replaces CSV import
- Optional migration to GNPS-hosted Postgres (or stay on Supabase under district account)
- Mobile-optimized redesign pass

---

## 8. IT-handoff brief

Phase 1 has zero IT dependency. The following items are required to promote to Phase 2 and own the system long-term. They are listed in the order they typically need to be addressed.

1. **NYSED district application** *(Curriculum & Instruction action, gates everything)*. Great Neck must apply via the SED Application Business Portal to be authorized to award the seal. Approximately 30 days for state review. Without this approval, the system can track everything but seals cannot be conferred on transcripts.
2. **Domain CNAME.** Point `civicseal.greatneck.k12.ny.us` (or chosen subdomain) to Vercel. Approximately 5 minutes of DNS work. Vercel handles SSL provisioning automatically.
3. **FERPA / privacy review.** Phase 1 architecture: Supabase US-East region, encrypted at rest and in transit, role-based access controls, full audit log. Confirm acceptable for FERPA-covered student data. Sign Supabase Data Processing Agreement if district policy requires.
4. **SSO integration.** Choose: ClassLink, Google Workspace for Education, or Azure AD. Use Supabase Auth providers (no application code change required) or migrate to a district-managed identity provider. Drives the Phase 2 student portal.
5. **Infinite Campus integration.** Provide read access to:
    - Student roster (id, name, grad year, counselor)
    - Course enrollment (course code, school year, credit status)
    - Regents scores (exam, score, accommodation flag)
   Two acceptable shapes: (a) OneRoster API if Infinite Campus supports it at GNPS, (b) nightly CSV export to S3 or SFTP. Either is supported by the codebase.
6. **Email reputation.** Supervisor confirmations send from `civicseal@greatneck.k12.ny.us`. Either:
    - Use district SMTP credentials, or
    - Keep Resend and add SPF / DKIM records to GNPS DNS for the subdomain
7. **GNPS website integration.** Choose one of three options detailed in §10.
8. **Long-term hosting decision.** Free-tier Vercel + Supabase covers the GNPS scale (~6,800 students) for years. IT can keep that tier under a district-paid account, or self-host the same code on GNPS infrastructure. Either path is supported. No code changes are required to switch.

---

## 9. Open-source repository structure

```
civic-readiness-portal/
├── README.md                  · overview · screenshots · quick-start
├── LICENSE                    · MIT
├── CONTRIBUTING.md            · how peer districts contribute
├── SECURITY.md                · vulnerability reporting (responsible disclosure)
├── CODE_OF_CONDUCT.md         · community norms
├── docs/
│   ├── architecture.md        · this design document
│   ├── deployment-guide.md    · "deploy for your district in 1 hour"
│   ├── it-handoff-brief.md    · the §8 brief, standalone
│   ├── nysed-mapping.md       · pathway → NYSED rule citations
│   ├── data-import-guide.md   · IC CSV format spec; adapter for other SIS systems
│   └── customization.md       · rebrand for non-GNPS districts (theme tokens)
├── apps/web/                  · SvelteKit frontend
│   ├── src/routes/
│   │   ├── +page.svelte       · public landing
│   │   ├── submit/            · student submission flows
│   │   ├── confirm/[token]/   · supervisor email-link landing
│   │   ├── counselor/         · approval queue + roster
│   │   ├── scrc/              · committee project review
│   │   └── admin/             · roster import + course catalog + NYSED export
│   ├── src/lib/theme/         · brand tokens (district-swappable)
│   └── src/lib/pathways/      · NYSED rule engine
├── supabase/
│   ├── migrations/            · SQL schema (versioned)
│   ├── functions/             · edge functions (supervisor emails, scheduled jobs)
│   └── seed.sql               · sample data for development
├── packages/
│   ├── pathway-rules/         · NYSED logic, separately testable
│   └── nysed-export/          · audit-pack PDF + roster CSV generator
├── scripts/
│   ├── ic-csv-import/         · reference IC CSV importer
│   └── nysed-export.ts        · CLI for ad-hoc exports
├── config/
│   └── district.yaml          · district-specific config (colors, logo, course catalog)
├── .github/workflows/         · CI tests, staging auto-deploy, prod manual gate
└── tests/{unit,integration,e2e}
```

**License:** MIT. Permissive enough that other districts and even commercial vendors can fork without legal friction.

**Initial repository location:** `github.com/<jon-handle>/civic-readiness-portal` until GNPS leadership approves public release. Then transferred to `github.com/great-neck-public-schools/civic-readiness-portal` (or an org of leadership's choosing). Access can stay private during initial development.

**District customization:** Forks edit `config/district.yaml` — colors, logo URL, course catalog seed, SCRC member emails, domain — without touching application source. This is part of the leadership pitch: GNPS publishes the standard, peers adopt it.

**Theme tokens** (extracted live from greatneck.k12.ny.us):
- Primary color: `#204A97` (royal navy)
- Secondary color: `#FE8158` (warm coral)
- Heading font: Outfit (Google Fonts)
- Body font: Roboto (Google Fonts)
- Long-form font: Literata (Google Fonts; for reflection display)
- Logo: GNPS round logo from the district CDN

---

## 10. GNPS website integration options

All three options use the same codebase. IT chooses based on Finalsite policy and how seamless the URL experience needs to be.

### Option A — Subdomain CNAME (recommended)

User journey: from greatneck.k12.ny.us, the Social Studies department page links to `civicseal.greatneck.k12.ny.us`. Click navigates the user to the standalone portal, GNPS-themed throughout.

- **IT effort:** approximately 5 minutes — one DNS CNAME record. Vercel handles SSL automatically.
- **Pro:** cleanest URL, district-branded, full application capabilities, no iframe quirks
- **Con:** visible domain change on click (mitigated by matching brand)

### Option B — iframe embed in Finalsite page

User journey: from greatneck.k12.ny.us, the Social Studies page contains an embedded iframe pointing at the SoCR app. URL stays on greatneck.k12.ny.us.

- **IT effort:** approximately 30 minutes inside the Finalsite editor; auto-resize configuration
- **Pro:** URL stays on the district domain
- **Con:** file uploads and SSO popups inside iframes are fragile; scroll behavior is awkward; this is the Seaford pattern; some Finalsite tiers strip iframes

### Option C — Reverse proxy via Finalsite or Cloudflare

User journey: greatneck.k12.ny.us/socr serves the application directly via path-rewrite rules. URL never changes; no iframe; the Vercel origin is invisible.

- **IT effort:** approximately half a day; opens a Finalsite ticket or stands up a Cloudflare Worker
- **Pro:** most seamless — URL never leaves district domain; works with SSO better than iframe
- **Con:** Finalsite tier may not allow path rewrites; Cloudflare alternative adds infrastructure; highest IT lift

**Recommendation:** start with Option A. Switch to B or C later if leadership wants the URL to stay on greatneck.k12.ny.us. Switching is a configuration change, not a code change.

---

## 11. Cost analysis

| Phase | Vercel | Supabase | Resend | Total |
|---|---|---|---|---|
| Phase 1 (free tiers) | $0 | $0 | $0 | **$0/mo** |
| Phase 2 (likely state at GNPS scale) | $0 | $0–25 | $0 | **$0–25/mo** |
| Self-hosted alternative | GNPS infra + ops time | Same | Same or district SMTP | District-internal cost |

GNPS scale (~6,800 students; ~412 per graduating class; ~2,500 active submissions per year at steady state) fits comfortably within all three free tiers for the foreseeable future:

- Supabase free tier: 500 MB database, 1 GB file storage. At ~10 KB per submission record + ~500 KB per artifact upload, GNPS would use roughly 5–10 MB DB and 200–400 MB file storage per year. Free tier supports this for 3+ years before pressure.
- Resend free tier: 3,000 emails per month. Supervisor confirmations + counselor notifications come to roughly 800–1,200 per month at steady state.
- Vercel free tier: 100 GB bandwidth per month. Application is asset-light; well within limits.

Supabase Pro at $25/mo would only become relevant if the district wants daily backups beyond the free tier's point-in-time recovery, or anticipates exceeding 500 MB DB (unlikely at GNPS scale until ~year 5).

---

## 12. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| GNPS does not apply to NYSED in time, blocking seal conferral | Medium | High | Flagged as IT-brief item #1; track explicitly; can begin in parallel with Phase 1 development |
| IT review takes longer than expected, stalling Phase 2 | Medium | Medium | Phase 1 is fully usable independently; staff-only pilot continues regardless |
| Counselor approval workload becomes burdensome | Medium | Medium | Two-tier verification (supervisor email handles fraud risk on hours); approval queue UI optimized for fast review; can adjust to honor system + spot audit if needed |
| Student / supervisor data quality issues (typos in supervisor emails, etc.) | High | Low | Form validation; confirmation links bounce visibly; admin can re-issue from queue |
| Supabase or Vercel pricing changes | Low | Medium | Codebase is portable; can self-host on GNPS infrastructure with no application changes |
| FERPA review surfaces blocker | Low | High | Architecture is conservative (US region, encrypted, audit-logged); DPA is standard for both vendors; if blocker, self-host path is available without rewriting |
| Other districts fork and build competing product | Low | Low | This is in fact the goal — open-source positioning; GNPS keeps reputation as originator |

---

## 13. Appendices

### Appendix A — NYSED criteria, verbatim

(Reproduced from the NYSED Criteria document, https://www.nysed.gov/standards-instruction/criteria-earn-seal-civic-readiness)

> In order to obtain the Seal of Civic Readiness, a student must complete all the requirements for a New York State local or Regents diploma and earn a total of six points with at least two points in Civic Knowledge and at least two points in Civic Participation.

The point chart is reproduced in §1.2 of this document.

### Appendix B — NYSED Capstone essential elements, verbatim

(Reproduced from the NYS Seal of Civic Readiness Manual, p.16 and p.26)

> 2f. High School Capstone Project — 4 pts
>
> - Identify an issue (local, state, national, or global)
> - Apply civic knowledge, skills, actions, and mindsets to the issue
> - Engage in a civic experience based on the issue to influence positive change to the community (local, state, national, or global)
> - Present overall project to the school's Civic Readiness Committee

### Appendix C — Service Learning 5-stage process, verbatim

(Reproduced from NYS Seal of Civic Readiness Manual, p.20)

> Service-learning projects are typically organized into five stages:
> 1. Investigation — conduct research on a community-based problem or needs
> 2. Preparation — create a plan to address these needs
> 3. Conduct Action — Direct service / Indirect service / Advocacy
> 4. Reflection — required to earn the point for the NYSED Civics Diploma Seal
> 5. Demonstration / celebration — can be combined with the presentation of the project and reflection

### Appendix D — Glossary

- **NYSED** — New York State Education Department
- **NYSSCR** — New York State Seal of Civic Readiness (the credential this system tracks)
- **SCRC** — Seal of Civic Readiness Committee (district-level body that approves project topics and scores completed work; required by NYSED)
- **+1 Pathway** — A NYS diploma pathway option; the Seal of Civic Readiness counts as one
- **OneRoster** — IMS Global standard for SIS roster data exchange (one of the IC integration options)
- **FERPA** — Family Educational Rights and Privacy Act; governs student-record privacy
- **DPA** — Data Processing Agreement; the legal contract between a school district and a SaaS vendor for FERPA-covered data
- **Audit pack** — The year-end zip the system produces containing per-student PDFs, roster CSV, evidence files, and audit log excerpt; the artifact NYSED auditors would review

### Appendix E — Sources

- NYSED Seal of Civic Readiness Information: https://www.nysed.gov/standards-instruction/seal-civic-readiness-information
- NYSED Criteria document: https://www.nysed.gov/standards-instruction/criteria-earn-seal-civic-readiness
- NYSED Seal of Civic Readiness Manual (Updated March 2025): https://www.nysed.gov/standards-instruction/seal-civic-readiness-manual
- NYSED Civic Readiness Initiative: https://www.nysed.gov/standards-instruction/civic-readiness-initiative
- NYSED Approved Schools list: https://www.nysed.gov/curriculum-instruction/approved-seal-civic-readiness-schools
- Seaford HS landing page (peer district): https://seafordhigh.seaford.k12.ny.us/students-families/nys-seal-of-civic-readiness
- 3 Village CSD landing page: https://sites.google.com/3villagecsd.org/seal-of-civic-readiness/home
- Connetquot CSD landing page: https://www.ccsdli.org/departments/seal_of_civic_readiness
- Great Neck Public Schools (theme source): https://www.greatneck.k12.ny.us/

---

**End of design document.**
