# Infinite Campus Integration — Complete Wiring Guide

**Purpose:** turn raw Infinite Campus data into auto-counted Civic Knowledge column points for every GNPS student, with no student input required.

**Audience:** GNPS IT (specifically whoever administers the Infinite Campus instance) + the Civic Readiness Portal maintainer.

---

## 0. The integration goal in one paragraph

The Civic Readiness Portal computes seal-readiness from two data streams:

1. **Civic Knowledge column** (pathways 1a, 1b, 1c, 1d, 2c) — derived from coursework and Regents performance. **This is what Infinite Campus already knows.** If we can pipe that data in, students don't have to claim points they've already earned in class.
2. **Civic Participation column** (pathways 2a, 2b, 2e, 2f) — service hours, projects, capstone work. Students submit these via the public form.

The Civic Knowledge column accounts for ~50–80% of the points a typical GNPS senior earns. Wiring IC means counselors stop re-keying transcripts into spreadsheets, and students stop wondering whether their AP score "counts."

---

## 1. What the portal needs from IC

| Field | Drives | Notes |
|---|---|---|
| Student ID | Identity / join key | The IC `localStudentNumber` or `personID` — pick whichever is the canonical print on student-issued IDs (e.g. `GN20271234`) |
| Last name | Identity | Used in lookup forms |
| First name | Identity | Display only |
| Graduation year | Cohort partition | Critical: a student named "John Smith" graduating 2027 vs 2031 are different records |
| Course code | Pathway 1a / 1d / 2c eligibility | Joined to `course_catalog.course_code` to determine which pathway the credit counts for |
| Course year (e.g. 2025-2026) | Disambiguates retakes / multi-year courses | YYYY-YYYY format |
| Credit status (passed / failed / in_progress) | 1a only counts when `passed` | |
| Regents exam name | Identifies which exam | We need: Global History & Geography II, US History & Government |
| Regents score (0–100) | Pathway 1b / 1c | 85+ = mastery (1.5pt), 65–84 = proficiency (1pt), 55–64 with safety-net flag = also proficiency |
| Regents accommodation flag | IEP / 504 safety-net handling | Per NYSED: students with accommodations who score 55–64 still earn the proficiency point |

**Optional but useful:**
- Counselor-of-record (assigns student to a counselor's caseload in the portal)
- Student email (auto-progress emails)
- Date of birth (for age-out decisions; not stored by default)

**What we explicitly DO NOT need from IC:**
- Grades on non-social-studies courses
- Attendance
- Discipline records
- Anything not on the list above

The principle is **least privilege**: the integration pulls only what's needed for SoCR computation, nothing more. This minimizes FERPA surface area.

---

## 2. Three integration paths

In order from "works today" to "ideal long-term":

### Path A — Manual quarterly CSV (Phase 1, ready now)

A counselor or admin runs a custom report in IC, exports as CSV in our format (§3 below), uploads at `/admin/import`. The portal:
1. Validates every row (rejects bad dates, unknown course codes, malformed scores)
2. Shows a preview with new / updated / unchanged counts
3. On confirmation, upserts into `students`, `course_enrollment`, and `regents_scores`
4. Auto-recomputes Knowledge points on next page render

Cadence: **once at start of school year, then quarterly** (Oct, Jan, April), plus once after Regents week in June.

Pros: works immediately, no IC vendor coordination, no IT engineering required.
Cons: manual; relies on the admin remembering; fresh enrollment changes don't show up until next upload.

### Path B — Nightly SFTP export (Phase 2)

IC has a "Custom Report Scheduler" feature (or equivalent under Infinite Campus's reporting tools) that can drop a CSV onto an SFTP host on a schedule. The Civic Readiness Portal can poll that SFTP host nightly:

1. IC's scheduled report exports the CSV at 2am to `sftp://csv-drop.greatneck.k12.ny.us:/civicseal/<date>.csv`
2. A new container service in `docker-compose.yml` (`ic-importer`) runs `cron`-style: `0 3 * * *` checks for a new file, downloads it, runs through the same import pipeline as Path A, archives the file
3. Failures alert the IT team via SMTP

This is the **first step toward "live" without requiring a real-time API.** ~99% of the value of a live integration with ~10% of the effort.

**To enable Path B:**
- IC admin: schedule the export (see §4 for the report definition)
- IT: provision SFTP credentials for the portal server to read from (the SFTP server can be GNPS-internal)
- Portal: enable the `ic-importer` service in `docker-compose.yml` (currently commented out; uncomment and set `IC_SFTP_*` env vars)

### Path C — Live OneRoster API (Phase 2+)

Infinite Campus supports the **OneRoster 1.1 / 1.2** API standard for read-only roster data. If GNPS has the OneRoster module licensed, the portal can pull data directly via authenticated REST calls.

Endpoints we'd use (OneRoster v1.1):
- `GET /ims/oneroster/v1p1/users?role=student` — student roster
- `GET /ims/oneroster/v1p1/enrollments?filter=role=student` — course enrollments
- (Regents scores typically require IC's separate "State Reporting" API; OneRoster doesn't model state assessments out of the box)

The portal would have a `oneroster-pull` job similar to the SFTP version but with API auth. Reach the IC OneRoster docs at: https://infinitecampus.knowledgeowl.com/help/oneroster (verify availability with your IC representative).

**To enable Path C:**
- IC admin: enable OneRoster API access for the portal; provide OAuth2 client credentials
- Portal: enable `STORAGE_BACKEND=oneroster` (config-driven)
- Test against a sandbox instance first

This is the cleanest long-term path but requires the most coordination (vendor licensing + auth setup + testing).

---

## 3. CSV format specification (Path A — works today)

One row per `(student × course-or-exam)` pair. UTF-8, comma-separated, RFC 4180 escaping.

### Required header (exact, case-sensitive)

```csv
student_id,last_name,first_name,grad_year,kind,code,year_or_date,score_or_credit
```

### Field definitions

| Column | Type | Constraints |
|---|---|---|
| `student_id` | text | The SIS identifier (e.g. `GN20271234`). Treated as-is; case-sensitive. |
| `last_name` | text | Used for the public-form student lookup |
| `first_name` | text | Display only |
| `grad_year` | int | 2024–2040; identifies the student's cohort |
| `kind` | enum | One of: `course`, `regents`, `demographic` |
| `code` | text | For `course`: a course code that matches `course_catalog.course_code`. For `regents`: `GLOBAL_II` or `US_HISTORY`. For `demographic`: ignored. |
| `year_or_date` | text | For `course`: school year as `YYYY-YYYY` (e.g. `2025-2026`). For `regents`: ISO date `YYYY-MM-DD`. |
| `score_or_credit` | text | For `course`: `passed`, `failed`, or `in_progress`. For `regents`: integer 0–100. |

### Example

```csv
student_id,last_name,first_name,grad_year,kind,code,year_or_date,score_or_credit
GN20271234,Goldberg,Maya,2027,course,SS_GLOBAL_I,2024-2025,passed
GN20271234,Goldberg,Maya,2027,course,SS_GLOBAL_II,2025-2026,passed
GN20271234,Goldberg,Maya,2027,course,SS_US_HISTORY,2026-2027,in_progress
GN20271234,Goldberg,Maya,2027,course,AP_US_GOV,2026-2027,passed
GN20271234,Goldberg,Maya,2027,regents,GLOBAL_II,2026-06-15,87
```

A working example is committed at [`docs/sample-ic-data.csv`](sample-ic-data.csv).

### Validation rules

The importer rejects:
- Rows with unknown `kind`
- Rows where `code` (for `course` kind) isn't in `course_catalog`
- Rows with malformed dates or year strings
- Rows where Regents `score_or_credit` isn't a 0–100 integer
- Rows where `credit_status` (course) isn't `passed`/`failed`/`in_progress`

The preview UI shows rejected rows with explanations. The admin must fix and re-upload (or skip and let those rows fall through).

### Idempotency

Re-uploading the same CSV is a **no-op** if no values changed. Updates apply only when an existing row has different fields. Re-uploads after fixing data are safe.

### Course-code conventions

You and IC need to agree on a stable course-code mapping. The portal's `course_catalog` is seeded with GNPS social-studies courses (see `config/district.yaml`). Add your full SS catalog by going to `/admin/courses` after deploy.

**Minimum recommended catalog for GNPS (already seeded):**
| Course code | Title | counts_for |
|---|---|---|
| `SS_GLOBAL_I` | Global History & Geography I | `1a` |
| `SS_GLOBAL_II` | Global History & Geography II | `1a` |
| `SS_US_HISTORY` | United States History & Government | `1a` |
| `SS_PIG_ECON` | Participation in Government & Economics | `1a` |
| `AP_US_GOV` | AP US Government & Politics | `1d`, `2c` |
| `AP_WORLD_HISTORY` | AP World History | `1d` |
| `AP_HUMAN_GEO` | AP Human Geography | `1d`, `2c` |
| `AP_ECON_MACRO` | AP Macroeconomics | `1d` |

Add more as the district adds eligible electives. The SCRC committee approves additions.

---

## 4. IC Ad Hoc Reporting recipe (for Path A)

This is the IC-side query you'd build to produce the CSV. Adjust slightly based on your IC instance's exact field names — IC's data model is consistent across districts but field labels vary.

**In Infinite Campus, navigate to Reporting → Ad Hoc Reporting → Filter Designer.**

### Filter 1 — Course Roster (one row per student-course-year)

**Element selection:**
- `student.localStudentNumber` (alias: `student_id`)
- `student.lastName` (alias: `last_name`)
- `student.firstName` (alias: `first_name`)
- `student.gradYear` (alias: `grad_year`)
- The literal string `'course'` (alias: `kind`)
- `course.number` or your district's `course.localCourseCode` (alias: `code`) — must match the course_code values in `course_catalog`
- `roster.term.scheduleStructure.activeDate` formatted to `YYYY-YYYY` (alias: `year_or_date`)
- `roster.creditStatus` mapped: `Earned/PassFail-Pass` → `passed`, `Failed` → `failed`, `In Progress` → `in_progress` (alias: `score_or_credit`)

**Filters:**
- `course.subjectArea` = `Social Studies` (or your district's equivalent)
- Active enrollment as of report date
- Optionally: graduation year ≥ current year + 0 (active students only)

**Output:** CSV; download.

### Filter 2 — Regents Scores

**Element selection:**
- `student.localStudentNumber` (alias: `student_id`)
- `student.lastName` (alias: `last_name`)
- `student.firstName` (alias: `first_name`)
- `student.gradYear` (alias: `grad_year`)
- The literal string `'regents'` (alias: `kind`)
- `assessment.testCode` mapped: `RCT-Global` and `RR Global History` → `GLOBAL_II`, `RR US History` → `US_HISTORY` (alias: `code`)
- `assessment.testDate` as `YYYY-MM-DD` (alias: `year_or_date`)
- `assessment.score` (alias: `score_or_credit`)

**Filters:**
- Test code matches Global History & Geography or US History Regents codes
- Score is non-null
- Optionally: state-assessments only (exclude district-internal practice tests)

**Output:** CSV.

### Combine + clean

Concatenate the two CSVs (with one header row), verify the column ordering matches the spec in §3 exactly, save as `civicseal-import-YYYY-MM-DD.csv`. Upload via `/admin/import`.

### Recommended cadence

| When | Why |
|---|---|
| Aug (start of year) | Capture roster + grad-year changes, transferred-in students |
| Oct | Catch first-quarter enrollment changes |
| Jan | Mid-year changes (course adds/drops, transferred-out students) |
| April | Pre-Regents window, ahead of senior-year SoCR confirmations |
| Late June (after Regents) | Capture all Regents scores |

Once Path B (SFTP) lands, this becomes nightly automatic.

---

## 5. Common pitfalls and how to handle them

### Course-code drift
**Problem:** IC uses `1A.SS.GLOBHIST` but `course_catalog` has `SS_GLOBAL_I`. Imports skip rows.
**Fix:** Add a mapping step in the IC report (alias the IC code to the portal code), OR rename the catalog entry to match IC.

### Transferred-in students
**Problem:** Maya transfers from another district in 11th grade with 2 years of Regents scores already passed. The IC export includes those scores; should they count?
**Fix:** Per NYSED, prior-district credits count if approved by the district superintendent. The portal trusts the import — if IC has the data, it's counted. If you need to flag transfers for SCRC review, add a `transferred_in_date` to the student record (already in schema; just isn't auto-populated from IC by default).

### Safety-net Regents scores
**Problem:** A student with an IEP scores 58 on Global History II. IC reports the score; we need to know if it's a safety-net pass.
**Fix:** The CSV format includes `safety_net_applied` as a fifth field on Regents rows in the CURRENT schema (`regents_scores.safety_net_applied boolean`). Add it to the IC report mapping if your IC instance stores accommodation flags on assessments. If not, the portal defaults to `false` and you can manually flip the flag via psql for affected students.

### Course retakes
**Problem:** A student fails Global II in 10th grade, retakes in 11th. The CSV has two rows.
**Fix:** The schema's `course_enrollment.unique (student_id, course_id, school_year, term)` constraint allows a single row per year × term, so the second attempt is a separate row. The Knowledge points sum credits across all `passed` rows, so this is handled correctly: the failed first attempt doesn't count, the passed retake does.

### Grad-year changes
**Problem:** A student is held back; their grad_year changes.
**Fix:** Update the `students.grad_year` row directly via the admin UI (or `/admin/users` flow once it ships). The CSV import will respect the manual override.

### Course code that should now count for 1d but currently doesn't (and vice versa)
**Problem:** GNPS adds a new advanced SS elective; admin needs to mark it "1d" eligible.
**Fix:** `/admin/courses` → edit the course → check "Counts for 1d" → save. SCRC approval flag must be ticked (see UI).

---

## 6. Phase 2 connector — design sketch

When the time comes to build the live integration, here's the architecture:

### Option: Nightly SFTP poller (recommended first)

A new container `ic-importer` in `docker-compose.yml`:

```yaml
ic-importer:
  build:
    context: ./services/ic-importer
  depends_on:
    db:
      condition: service_healthy
  environment:
    DATABASE_URL: ${DATABASE_URL}
    IC_SFTP_HOST: ${IC_SFTP_HOST}
    IC_SFTP_USER: ${IC_SFTP_USER}
    IC_SFTP_KEY_PATH: /run/secrets/ic-sftp-key
    IC_SFTP_REMOTE_DIR: /civicseal
    IC_IMPORT_SCHEDULE: "0 3 * * *"  # cron expr — 3am daily
  volumes:
    - ic-archive:/archive  # local copy of every file ever imported, with sha256
  secrets:
    - ic-sftp-key
```

The container runs a Node service that:
1. On the schedule, lists files in `IC_SFTP_REMOTE_DIR`, filters to ones not yet seen
2. Downloads each new file, validates its CSV header
3. Runs the same parser the admin UI uses (`apps/web/src/lib/server/imports.ts`)
4. Commits to DB
5. Archives the file to `/archive/<date>-<sha256>.csv` for audit
6. Posts a structured `audit_log` row with `action='ic_imported_csv'` and the row counts
7. Sends an email to the admin distribution list summarizing the import

If validation rejects anything, the email includes the rejected rows. The IT team manually fixes upstream and waits for the next nightly run.

### Option: OneRoster live API

Same container shape but instead of SFTP polling, it makes authenticated REST calls to the OneRoster endpoints, paginates through results, and applies the same upsert logic. Slightly more code but no file dropbox needed.

### Both options preserve

- Idempotency (re-running a sync is safe)
- Audit log (every import is recorded)
- The admin UI's manual-import path (always available as a fallback)

---

## 7. Privacy / FERPA considerations

The IC integration moves student-record data from one FERPA-covered system (IC) to another FERPA-covered system (the Civic Readiness Portal on GNPS infrastructure). **No data leaves the district.**

Specific considerations:

- **Data minimization.** We pull only the fields in §1. We don't pull addresses, IEP details (only the safety-net flag for Regents scoring), discipline, attendance.
- **Access control.** Only counselors, SCRC committee members, and admins can see student records in the portal. Each access is logged to `audit_log`.
- **Retention.** The portal retains student records as long as the seal program runs + district records-retention policy (typically 7 years post-graduation for FERPA). Decommissioning procedure in the IT runbook.
- **Disclosure.** The portal does not share data with any third party. Even the Vercel/Supabase Phase 1 deploy was a directory-information processor under FERPA's school-official exception with vendor DPAs in place. Self-hosted Phase 2 keeps everything inside GNPS.
- **Rights.** A parent or eligible student can request to see their record (via existing GNPS FERPA process). The portal's `/admin/student/[id]` view (or a direct DB query) provides this.

---

## 8. Sample data dictionary (portal side)

For reference — this is what the portal stores after a successful IC import:

```
students
  id              "GN20271234"
  last_name       "Goldberg"
  first_name      "Maya"
  grad_year       2027
  email           NULL (student supplies via submission form)
  counselor_id    NULL initially; set when admin assigns caseload
  status          'active'
  created_at      auto

course_enrollment
  student_id      "GN20271234"
  course_id       2 (FK to course_catalog.SS_GLOBAL_II)
  school_year     "2025-2026"
  term            "" (empty default; per-quarter granularity not used at GNPS)
  credit_status   'passed'
  imported_at     auto

regents_scores
  student_id            "GN20271234"
  exam_code             'GLOBAL_II'
  score                 87
  exam_date             '2026-06-15'
  safety_net_applied    false
  imported_at           auto

audit_log
  action      'admin_imported_csv'
  actor_kind  'admin'
  data        { rows_total: 24, new: 21, updated: 3, rejected: 0 }
```

The Knowledge column points are computed at read time — there's no `knowledge_points` field. Touching IC data automatically updates what counselors see; no recompute step is needed.

---

## 9. Putting it all together

| Phase | What's happening | IC's involvement | Effort |
|---|---|---|---|
| **Today** | Manual quarterly CSV upload via `/admin/import`. Works against the current Vercel/Supabase deployment AND the future self-hosted deployment. | None (admin runs the IC report manually) | 0 |
| **Phase 1.5** | Same flow, on self-hosted GNPS infrastructure. Identical UX. | Same as above. | 0 (config swap) |
| **Phase 2 — SFTP** | Nightly SFTP poll picks up the IC report automatically, applies it, alerts on issues. | IC schedules the report; SFTP server (district-internal) accepts the drop. | ~1 week of IT engineering |
| **Phase 2 — OneRoster** | Live API pull. Roster + enrollment changes flow into the portal within hours. | OneRoster module enabled; OAuth2 credentials provisioned. | ~2 weeks if vendor coordination is smooth |

Each step is additive. You don't have to reach Phase 2 to get value — Path A delivers ~95% of the user-facing benefit (auto-counted Knowledge points). Path B closes the staleness gap; Path C closes it fully.

---

## 10. Open questions for the IC vendor / IC admin

When you have your first conversation about wiring this up, here's what to ask:

1. Does our IC instance support **OneRoster 1.1 or 1.2** API access? Is it currently licensed?
2. If yes — what's the OAuth2 client setup procedure for our admin to provision credentials?
3. What's the IC field name for `student.localStudentNumber` (or whatever GNPS uses as the canonical student ID)?
4. Is the Regents score table queryable via Ad Hoc Reporting, or does it require the State Reporting module?
5. Where (which IC field) is the safety-net / accommodation flag stored on Regents assessments?
6. Does IC have a **Custom Report Scheduler** for nightly SFTP delivery? What's the SFTP target setup process?
7. What's the cadence on IC's data refresh — when does a transferred-in student show up in IC?
8. Does GNPS use IC's `gradYear` field consistently, or is grad cohort tracked elsewhere?

When you have those answers, the integration is straightforward. Until then, Path A (manual CSV) covers it.

---

## 11. Contact

Questions on this integration: civicseal@greatneck.k12.ny.us
NYSED reference: [Seal of Civic Readiness Manual (Updated 2024)](https://www.nysed.gov/standards-instruction/seal-civic-readiness-manual)
