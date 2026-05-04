# Teacher Quick-Push — Award Civic Readiness Points from Class

**Audience:** GNPS teachers who already collect civic-readiness evidence in their classroom (research papers, civic projects, capstone presentations, supervised service-learning, civic-engagement electives).

**Goal:** turn "every kid has to remember to submit on the portal" into "I award the class in one action."

---

## When to use it

Use Teacher Quick-Push when **you already have the evidence on file in your gradebook**. Examples:

| Situation | Pathway | Default award |
|---|---|---|
| You graded a research paper for AP US Gov on a constitutional amendment | 1e Research Project | 1 pt |
| Your class did a quarter-long civic project on local food insecurity | 2a HS Civic Project | 1.5 pt (max 2× per student) |
| You're the advisor for a student's Civics Capstone | 2f HS Capstone | 4 pt (single instance) |
| Your civic-engagement elective course (Mock Trial, Model UN, etc.) had students submit application essays | 2c Civic Elective Essay | 0.5 pt |
| You supervised a class-wide service-learning trip with reflection journals | 2b Service-Learning | 1 pt per 25 hours |
| You ran an extracurricular with 40+ hour participation | 2e WBL / Extracurricular | 0.5 pt |

**Don't** push individual student-initiated submissions — let the student submit through the public form so the supervisor confirmation flow runs. Quick-Push is for **class-wide or teacher-initiated** awards.

---

## How it works (the workflow)

1. **Sign in.** `https://civicseal.<district>/login` → enter your district email → click the magic link in your email.
2. **Land on `/teacher`.** Two options: **Bulk push** or **My recent pushes**.
3. **Bulk push:** four-step form
   - **Step 1 — Pathway:** pick from the 7 supported pathways. Default points pre-fill (e.g. 1.5 for 2a Civic Project). Override if NYSED-defensible.
   - **Step 2 — Student IDs:** paste a list (one per line or comma-separated, up to 200 per push). Phase 2 will let you pick a class roster directly from Infinite Campus.
   - **Step 3 — Domains:** check off which of the four NYSED civic-readiness domains the work demonstrates (knowledge / skills / mindsets / experiences).
   - **Step 4 — Notes (optional):** assignment context, evidence location, follow-ups.
4. **Click "Push to all".** Each student gets a `pathway_submissions` row.

---

## What happens after the push

Two paths depending on your role:

### If you're an SCRC committee member → points award immediately

Your push lands as `status='awarded'` with you (`scored_by`) recorded as the scoring authority. The student sees the points on their next progress email. The audit log records the action.

### If you're a regular teacher → SCRC reviews

Your push lands as `status='proposed'` in the SCRC review queue. The committee scores against the NYSED rubric using the evidence you uploaded (or your class context notes). After scoring, the points award normally.

In both cases, the system enforces NYSED's cap rules:
- **2a HS Civic Project** caps at 3 points per student (max 2 instances). Pushes over the cap are skipped with `reason: 'already_at_cap'`.
- **1e Research Project** caps at 1 point. Same handling.
- **2f Civics Capstone** caps at 4 points (single instance).
- **service_learning, wbl_extracurr, civic_elective** are uncapped (repeatable).

Skipped students show in the success banner with the reason — you don't have to guess.

---

## Bulk push from a class roster

Phase 1.5 supports paste-a-list. Phase 2 will integrate directly with Infinite Campus class rosters via OneRoster API or SFTP export.

### Phase 1.5 (today): paste from IC

In Infinite Campus:
1. Navigate to your class section.
2. Open the **Student Roster** report (or your district's equivalent).
3. Export as CSV.
4. Open in Excel / Numbers / Sheets.
5. Copy the `Student ID` column.
6. Paste into the Quick-Push form's Step 2 textarea.

### Phase 2 (planned): one-click from IC

Future flow:
1. In IC, open your class.
2. Click "Push civic readiness points" (added via IC's Custom Action button).
3. Browser opens the portal with your class IDs pre-filled.

This requires the OneRoster integration described in [docs/infinite-campus-integration.md §6](infinite-campus-integration.md). Worth doing once 5+ teachers are routinely using Quick-Push.

---

## Tracking what you've pushed

`/teacher/recent` shows your last 50 pushes:
- Date
- Student ID
- Pathway
- Points
- Status (awarded / proposed / scored / rejected)

Filter by status to see which pushes are still awaiting SCRC review.

---

## Audit & accountability

Every push writes:
1. A `pathway_submissions` row with `submitted_by_user_id = your user.id`
2. An `audit_log` entry with `actor_id = you`, `action = 'teacher_pushed_pathway_points'`, payload containing the pathway / points / class label

Counselors can see "Teacher Maue pushed 24 students for 1.5pt 2a · AP US Gov class · 2026-04-15" in their student-detail audit excerpts. SCRC sees the same in their review queue. The audit pack PDF generated at year-end includes teacher-push provenance.

If a push was made in error, contact the C&I lead — admins can `revoke` a submission, which transitions `status='revoked'` and writes a counter-audit entry. Nothing's deleted; the audit log is append-only by NYSED policy.

---

## What NOT to push

- **Don't push points the student would normally earn through coursework already auto-counted.** Civic Knowledge column pathways (1a four credits, 1b/1c Regents, 1d advanced SS, 2c elective grade) auto-populate from the IC integration. Pushing them manually is double-counting; the system rejects duplicates but it's wasted effort.
- **Don't push service-learning hours individually.** Service hours come with NYSED's 5-stage process requirement (investigation → preparation → action → reflection → demonstration). The student-initiated flow with supervisor email confirmation is how NYSED expects this evidence to be collected. Use Quick-Push for service-learning ONLY for class-organized service trips with reflection journals.
- **Don't push capstone projects without sign-off.** The Civics Capstone (4pt) is the highest-value single pathway and NYSED's most-scrutinized one. SCRC must score it against Appendix P even if you're the advisor. Use Quick-Push to *propose* (status='proposed'), not to award directly — unless you're SCRC.

---

## Common scenarios

**"I taught AP World History. 24 students passed. Can I push 0.5pt 1d to all of them?"**
→ Yes, but you don't need to — the IC integration already auto-counts 1d when their AP World History credit imports as `passed`. Save your time.

**"I taught Constitutional Law (an elective on the SCRC-approved 2c list). 18 students passed and submitted application-of-knowledge essays."**
→ Push 0.5pt `civic_elective_essay` to all 18, with their essays attached as evidence. The 2c proficiency credit auto-counts from IC; your push covers the essay component.

**"My AP US Gov class did a class-wide civic project on voting access. 32 students participated."**
→ Push 1.5pt `hs_civic_project` to all 32. Students who already had a 2a instance from another class will get the second one (3pt total) or be skipped (over cap).

**"I'm advising 3 capstone students this year."**
→ Don't bulk-push — capstones are individual. Use the existing student-initiated flow via `/submit/capstone`, where each student proposes their topic, you approve as advisor, they upload evidence, SCRC scores.

---

## Privacy

Same as the rest of the portal: you only see what FERPA permits a school official to see. Pushes are scoped to your role; you can't see other teachers' pushes (counselors and SCRC can, by design).

---

## Phase 2: deeper IC integration

Once IC's OneRoster API is wired (see [docs/infinite-campus-integration.md](infinite-campus-integration.md)):

- **Class-list autofill:** "Push to my AP US Gov Period 4 class" → student IDs pre-populated
- **IC gradebook hook:** "Push 0.5pt 2c to all students with grade ≥ 65 in Constitutional Law" → automatic filtering
- **One-way echo back:** the Seal-of-Civic-Readiness eligibility flag flows back into IC's student record at graduation, so the seal appears on the transcript automatically (current Phase 1 path: registrar pulls the audit-pack CSV at June end and adds it to transcripts manually)

That's the perfection target. The Quick-Push UI you have today already covers ~90% of the practical value.
