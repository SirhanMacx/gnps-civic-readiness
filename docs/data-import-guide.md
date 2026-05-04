# Data import guide — IC CSV format (Phase 1)

The portal auto-counts five SIS-derived pathways (1a, 1b, 1c, 1d, 2c) from data exported from Infinite Campus and uploaded by an admin. This guide explains the CSV format the importer expects.

## CSV format

One row per (student, course-or-exam) pair. UTF-8 encoded, RFC 4180 (commas as separators, double-quotes for escaping).

```csv
student_id,last_name,first_name,grad_year,kind,code,year_or_date,score_or_credit
GN20271234,Goldberg,Maya,2027,course,SS_GLOBAL_II,2024-2025,passed
GN20271234,Goldberg,Maya,2027,course,SS_US_HISTORY,2025-2026,passed
GN20271234,Goldberg,Maya,2027,regents,GLOBAL_II,2025-06-15,87
GN20271234,Goldberg,Maya,2027,regents,US_HISTORY,2026-06-12,91
GN20271234,Goldberg,Maya,2027,course,AP_US_GOV,2026-2027,in_progress
```

## Field reference

| Field | Type / values | Notes |
|---|---|---|
| `student_id` | text | The SIS identifier (e.g. `GN20271234`). Acts as the join key. |
| `last_name` | text | Used for the student-lookup form match. |
| `first_name` | text | Display only. |
| `grad_year` | int | E.g. `2027`. Used for keying the student record (a kid named "John Smith" in 2027 vs 2031 are different records). |
| `kind` | enum | `course` &middot; `regents` &middot; `demographic` |
| `code` | text | For `course`: course code matching `course_catalog.course_code`. For `regents`: `GLOBAL_II` or `US_HISTORY`. |
| `year_or_date` | text | For `course`: school year `YYYY-YYYY` (e.g. `2025-2026`). For `regents`: ISO date (e.g. `2026-06-12`). |
| `score_or_credit` | text | For `course`: `passed`, `failed`, or `in_progress`. For `regents`: integer 0–100. |

## Sample IC export workflow

Infinite Campus does not natively export this exact format. Most districts run a Custom Report or use the Ad Hoc Reporting tool to produce a CSV that's then transformed (Excel formulas, a small Python script, or the IC API) into the shape above. Specifics vary by district. As one approach:

1. In IC's Ad Hoc Reporting, build three filters:
   - Students by graduation year (e.g. seniors)
   - Course history filtered to social studies course codes
   - State assessment scores filtered to Global II and US History Regents
2. Export each as CSV
3. Reshape (concatenate, normalize columns) into the format above
4. Upload to the Civic Readiness Portal admin → Import IC CSV

The admin import UI runs validation on every row and shows you a diff (new / updated / unchanged counts) before committing.

## Validation rules

The importer rejects rows that:
- Have an unknown `kind` (anything other than `course`, `regents`, `demographic`)
- Reference a `code` that's not in the course catalog (for `course` kind)
- Have a Regents score outside 0–100
- Have an invalid date format
- Have an unknown `credit_status` value

Rejected rows are listed by row number in the import preview; valid rows commit on Continue.

## Update semantics

The importer is **idempotent**: re-uploading the same CSV does nothing. New rows are inserted; existing rows with the same key (`student_id, course_id, school_year, term` for courses; `student_id, exam_code, exam_date` for Regents) are updated only if the score changed.

## Phase 2

Once district IT integrates with Infinite Campus directly (OneRoster API or nightly export), this manual CSV upload becomes a fallback path. The schema above stays the same; an adapter transforms IC's response into these fields. See the [design doc](../dist/GNPS-Civic-Readiness-Portal-Design.pdf) §3.2 for Phase 2 architecture.
