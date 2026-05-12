# Project Goal & Rollout Plan

**Working goal:** give the Great Neck Social Studies Department a defensible, low-friction way to launch the New York State Seal of Civic Readiness from zero infrastructure to a serious prototype, then to a district-approved program that can be reviewed by curriculum leadership, adopted by IT, and reused by other New York districts.

This document stands in for the requested `/goal` record because no local `/goal` CLI skill is installed in this workspace. Keep it current as the project source of truth for non-engineers.

## Research Baseline

NYSED's current public guidance says students earn the Seal by completing diploma requirements and earning six total points, with at least two points from Civic Knowledge and at least two from Civic Participation. The online manual is marked **Updated March 2025**, with formatting/toolkit updates and no program-requirement changes. NYSED also says districts must be approved through the Business Portal before awarding the Seal and must report recipients using **Program Service Code 8313** by the SIRS reporting deadline.

Peer districts show the usual implementation pattern:

| District | What they do | Lesson for GNPS |
|---|---|---|
| [Seaford HS](https://seafordhigh.seaford.k12.ny.us/students-families/nys-seal-of-civic-readiness) | Public page, Microsoft Forms, paper hour/reflection forms, counselor deadline. | Good family-facing clarity, but manual counselor roll-up and repeated student entry. |
| [Three Village CSD](https://sites.google.com/3villagecsd.org/seal-of-civic-readiness/home) | Public Google Site explaining the two columns and pathway menu. | Clear public education layer, but not a tracking system. |
| [Connetquot](https://www.ccsdli.org/seal-of-civic-readiness) | Social Studies-owned program page with approved course lists and contact workflow. | Course lists should be SCRC-approved and district-specific, but the data should not live only on a static page. |

GNPS should not start with scattered forms and spreadsheets. The better position is: public submission portal plus staff approval workflow plus Infinite Campus-backed auto-counting. Infinite Campus remains the system of record; this portal is the workflow, evidence, and audit layer.

## What Infinite Campus Can Auto-Populate

| Data from IC | Portal use | Seal pathway |
|---|---|---|
| Student ID, name, graduation year | Identity, cohort, counselor roster | All |
| Required social studies credits passed | Auto-count 4-credit gate | 1a |
| Global II / US History Regents score | Auto-count mastery/proficiency | 1b / 1c |
| Safety-net, special-appeal, or 45-variance flag | Auto-count approved lower-score Regents cases | 1c |
| Advanced SS course enrollment and pass status | Auto-count approved advanced coursework | 1d |
| SCRC-approved civic elective enrollment and pass status | Pair with student essay evidence | 2c |
| Counselor of record | Filter counselor caseloads | Staff workflow |
| Student email | Progress-report email | Communications |

## What Must Be Collected Through the Portal

| Evidence | Why IC cannot supply it | Portal workflow |
|---|---|---|
| Service-learning hours and reflection | IC does not know supervisor-confirmed community service or the five-stage reflection quality. | Student submits; supervisor confirms; counselor approves. |
| Work-based learning / extracurricular hours and application essay | IC may know club membership, but not verified hours or the civic-application product. | Student submits; supervisor/advisor confirms; counselor approves. |
| Civic-engagement elective essay | IC can show course credit, not the application-of-knowledge product. | Student uploads essay; counselor approves; points count only when matching IC course credit exists. |
| Research project | Requires SCRC approval and rubric-based review. | Student proposes; SCRC reviews/scores; counselor confirms. |
| High School Civic Project | Requires local SCRC criteria and may be completed up to two times. | Student proposes; SCRC reviews/scores; counselor confirms. |
| Middle School / High School Capstone | Requires topic, civic experience, presentation, and committee review. | Student proposes; committee scores; counselor confirms. |

## Recommended Rollout

1. **Now: Social Studies evaluation.** Walk the workflow end-to-end against the proof-of-concept deployment with sample data only — no real student records into any unapproved environment. Verify course catalog, SCRC members, and counselor roles.
2. **Before public launch: NYSED application.** Curriculum leadership must apply through the NYSED Business Portal; the portal cannot make GNPS eligible to award the Seal by itself.
3. **Quarterly IC import.** Start with the documented CSV upload: August, October, January, April, and post-Regents June. This gets most auto-populated value without IT integration risk.
4. **Family-facing GNPS page.** Embed or link the portal from the GNPS site with a short explanation, contact email, and student/family directions.
5. **IT handoff.** Stand up the recommended self-hosted Docker stack, or another district-approved provider path, with district-issued accounts, custom domain, district SMTP/approved mail service, backups, and FERPA review. No real student data should enter any unapproved demo environment.
6. **Phase 2 integration.** Replace CSV upload with nightly SFTP or OneRoster where available. Keep the CSV path as the emergency fallback.
7. **Graduation reporting.** Export the audit pack, mark transcript/diploma records, and report Program Service Code 8313 through SIRS.

## Quality Bar

The project is ready for leadership review only when:

- Every awarded point traces to either IC data or reviewed evidence.
- Hours-based points cannot be awarded until hours meet NYSED thresholds and supervisor confirmation is complete.
- Regents safety-net, special-appeal, and 45-variance cases are represented in the import and rules engine.
- Staff can export a cohort audit pack without rebuilding a spreadsheet.
- All handoff docs explain the same current workflow and cite NYSED's current guidance.

## Source Links

- [NYSED Seal of Civic Readiness Information](https://www.nysed.gov/standards-instruction/seal-civic-readiness-information)
- [NYSED Criteria to Earn the Seal](https://www.nysed.gov/standards-instruction/criteria-earn-seal-civic-readiness)
- [NYSED Seal of Civic Readiness Manual](https://www.nysed.gov/standards-instruction/seal-civic-readiness-manual)
- [Seaford HS NYS Seal of Civic Readiness](https://seafordhigh.seaford.k12.ny.us/students-families/nys-seal-of-civic-readiness)
- [Three Village NYS Seal of Civic Readiness](https://sites.google.com/3villagecsd.org/seal-of-civic-readiness/home)
- [Connetquot Seal of Civic Readiness](https://www.ccsdli.org/seal-of-civic-readiness)
