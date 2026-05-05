<script lang="ts">
  import type { PageData } from './$types.js';
  export let data: PageData;

  $: detail = data.detail;
  $: student = detail.student;

  function fmt(n: number): string {
    return n.toFixed(1);
  }

  function fmtDate(s: string | null): string {
    if (!s) return ' · ';
    try {
      return new Date(s).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return s;
    }
  }

  function fmtDateTime(s: string): string {
    try {
      return new Date(s).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return s;
    }
  }

  function pathwayLabel(p: string): string {
    return p.replace(/_/g, ' ');
  }

  function statusBadge(): { cls: string; label: string } {
    if (detail.student.status === 'awarded') {
      return {
        cls: 'bg-green-100 text-green-900 border-green-300',
        label: 'Seal awarded',
      };
    }
    if (detail.eligible) {
      return {
        cls: 'bg-green-50 text-green-900 border-green-200',
        label: 'Eligible · confirm to award',
      };
    }
    const lowK = detail.knowledge < 2;
    const lowP = detail.participation < 2;
    if (lowK && lowP) return { cls: 'bg-red-50 text-red-900 border-red-200', label: 'Needs both columns' };
    if (lowK) return { cls: 'bg-yellow-50 text-yellow-900 border-yellow-200', label: 'Needs Knowledge' };
    if (lowP) return { cls: 'bg-yellow-50 text-yellow-900 border-yellow-200', label: 'Needs Participation' };
    return { cls: 'bg-blue-50 text-blue-900 border-blue-200', label: 'In progress' };
  }

  $: badge = statusBadge();

  // Per-column award lists. Knowledge column = research_project (1e).
  // Participation column = everything else (2a/2b/2c/2d/2e/2f).
  $: knowledgeAwards = detail.awardedSubmissions.filter(
    (a) => a.pathwayType === 'research_project',
  );
  $: participationAwards = detail.awardedSubmissions.filter(
    (a) => a.pathwayType !== 'research_project',
  );

  // Course-enrollment slices for the per-column UI.
  $: knowledgeCoursework = detail.enrollment.filter((e) =>
    e.countsFor.some((t) => ['1a', '1d'].includes(t)),
  );
  $: civicElectiveCoursework = detail.enrollment.filter((e) => e.countsFor.includes('2c'));

  function emailHref(): string {
    return `mailto:?subject=${encodeURIComponent(`Seal of Civic Readiness · ${student.firstName} ${student.lastName}`)}`;
  }
</script>

<svelte:head>
  <title>{student.lastName}, {student.firstName} · Counselor</title>
</svelte:head>

<section class="py-4 mb-4">
  <a href="/counselor" class="text-sm text-primary hover:underline">← Back to roster</a>
</section>

<!-- Header -->
<header class="mb-6 pb-5 border-b border-border">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <p class="text-xs uppercase tracking-widest text-secondary font-display font-semibold mb-1">
        Student record
      </p>
      <h1 class="font-display text-3xl font-bold text-primary leading-tight">
        {student.lastName}, {student.firstName}
      </h1>
      <p class="text-sm text-muted mt-1 font-mono">
        {student.id} · Class of {student.gradYear}
        {#if student.accommodationsFlag}
          <span class="ml-2 inline-block text-[10px] uppercase tracking-widest font-display font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200">
            504 / IEP
          </span>
        {/if}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <span class={`inline-block text-xs uppercase tracking-widest font-display font-semibold px-3 py-1.5 rounded border ${badge.cls}`}>
        {badge.label}
      </span>
      <a
        href={emailHref()}
        class="btn btn-secondary"
      >
        Email student
      </a>
      <a
        href={`/counselor/student/${student.id}/audit.pdf`}
        class="inline-block btn btn-primary"
      >
        NYSED audit pack PDF
      </a>
    </div>
  </div>
</header>

<!-- Two-column points breakdown -->
<section class="grid md:grid-cols-2 gap-4 mb-6">
  <div class="border border-border rounded-lg bg-surface p-5">
    <div class="flex items-baseline justify-between mb-3">
      <h2 class="font-display text-lg font-bold text-primary">Civic Knowledge</h2>
      <span class="font-display text-2xl font-bold text-primary">
        {fmt(detail.knowledge)}
        <span class="text-sm text-muted font-normal">/ ≥ 2</span>
      </span>
    </div>
    <div class="space-y-2 text-sm">
      <p class="text-xs uppercase tracking-wider text-muted font-display font-semibold mb-2">
        Coursework + Regents
      </p>
      {#each knowledgeCoursework as e}
        <p class="flex justify-between text-ink">
          <span class="font-mono text-xs">{e.courseCode}</span>
          <span class="text-muted">{e.title}</span>
          <span class="text-xs text-muted">
            {e.creditStatus === 'passed' ? '✓ passed' : e.creditStatus}
          </span>
        </p>
      {/each}
      {#each detail.regents as r}
        <p class="flex justify-between text-ink">
          <span class="font-mono text-xs">{r.examCode}</span>
          <span class="font-display font-semibold text-primary">{r.score}</span>
          <span class="text-xs text-muted">{fmtDate(r.examDate)}</span>
        </p>
      {/each}

      {#if knowledgeAwards.length > 0}
        <p class="text-xs uppercase tracking-wider text-muted font-display font-semibold pt-3 mb-1">
          Awarded projects (knowledge column)
        </p>
        {#each knowledgeAwards as a}
          <p class="flex justify-between text-ink">
            <span class="capitalize">{pathwayLabel(a.pathwayType)}</span>
            <span class="font-display font-semibold text-primary">+{fmt(a.pointsAwarded)} pt</span>
            <span class="text-xs text-muted">{fmtDate(a.awardedAt)}</span>
          </p>
        {/each}
      {/if}
    </div>
  </div>

  <div class="border border-border rounded-lg bg-surface p-5">
    <div class="flex items-baseline justify-between mb-3">
      <h2 class="font-display text-lg font-bold text-primary">Civic Participation</h2>
      <span class="font-display text-2xl font-bold text-primary">
        {fmt(detail.participation)}
        <span class="text-sm text-muted font-normal">/ ≥ 2</span>
      </span>
    </div>
    <div class="space-y-2 text-sm">
      {#if participationAwards.length === 0}
        <p class="text-sm text-muted italic">No awarded participation pathways yet.</p>
      {:else}
        <p class="text-xs uppercase tracking-wider text-muted font-display font-semibold mb-1">
          Awarded
        </p>
        {#each participationAwards as a}
          <p class="flex justify-between text-ink">
            <span class="capitalize">{pathwayLabel(a.pathwayType)}</span>
            <span class="font-display font-semibold text-primary">+{fmt(a.pointsAwarded)} pt</span>
            <span class="text-xs text-muted">{fmtDate(a.awardedAt)}</span>
          </p>
        {/each}
      {/if}

      {#each civicElectiveCoursework as e}
        <p class="flex justify-between text-ink">
          <span class="font-mono text-xs">{e.courseCode}</span>
          <span class="text-muted text-xs">civic elective: {e.creditStatus}</span>
        </p>
      {/each}
    </div>
  </div>
</section>

<!-- Total + eligibility -->
<section class="mb-6 border-l-4 border-secondary pl-5 py-3 bg-secondary/5 rounded-r">
  <p class="text-xs uppercase tracking-widest text-secondary font-display font-semibold mb-1">
    Total · 6 points required
  </p>
  <p class="font-display text-3xl text-primary font-bold">
    {fmt(detail.total)}
    <span class="text-base text-muted font-normal">/ 6</span>
  </p>
  <p class="text-sm text-muted mt-1">
    {detail.eligible
      ? 'Meets all NYSED thresholds. Awaiting counselor confirmation to advance to "awarded".'
      : `Needs ${(6 - detail.total).toFixed(1)} more pts (Knowledge ≥ 2, Participation ≥ 2, total ≥ 6).`}
  </p>
</section>

<!-- Pending submissions -->
{#if detail.pendingSubmissions.length > 0}
  <section class="mb-6">
    <h2 class="font-display text-xl font-bold text-primary mb-3">Pending submissions</h2>
    <ul class="space-y-2">
      {#each detail.pendingSubmissions as p}
        <li class="border border-border rounded bg-white px-4 py-3 text-sm flex flex-wrap gap-3 justify-between items-start">
          <div>
            <p class="font-display font-semibold text-primary capitalize">
              {pathwayLabel(p.pathwayType)}
            </p>
            {#if p.proposalSummary}
              <p class="text-xs text-muted mt-0.5">{p.proposalSummary}</p>
            {/if}
            {#if p.domainTags.length > 0}
              <div class="flex flex-wrap gap-1 mt-1">
                {#each p.domainTags as t}
                  <span class="text-[10px] uppercase tracking-widest font-display font-medium px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    {t}
                  </span>
                {/each}
              </div>
            {/if}
          </div>
          <div class="text-right">
            <span class="text-[10px] uppercase tracking-widest font-display font-semibold px-2 py-1 rounded border bg-blue-50 text-blue-900 border-blue-200">
              {p.status.replace(/_/g, ' ')}
            </span>
            <p class="text-xs text-muted mt-1">
              {p.submittedAt
                ? `Submitted ${fmtDate(p.submittedAt)}`
                : p.proposedAt
                ? `Proposed ${fmtDate(p.proposedAt)}`
                : ''}
            </p>
          </div>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<!-- Course enrollment table -->
{#if detail.enrollment.length > 0}
  <section class="mb-6">
    <h2 class="font-display text-xl font-bold text-primary mb-3">Course enrollment</h2>
    <div class="border border-border rounded-lg bg-white overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-surface">
          <tr class="text-left">
            <th class="px-4 py-2 text-xs uppercase tracking-widest font-display text-primary">Course</th>
            <th class="px-3 py-2 text-xs uppercase tracking-widest font-display text-primary">Year</th>
            <th class="px-3 py-2 text-xs uppercase tracking-widest font-display text-primary">Grade</th>
            <th class="px-3 py-2 text-xs uppercase tracking-widest font-display text-primary">Status</th>
            <th class="px-3 py-2 text-xs uppercase tracking-widest font-display text-primary">Counts for</th>
          </tr>
        </thead>
        <tbody>
          {#each detail.enrollment as e}
            <tr class="border-t border-border">
              <td class="px-4 py-2">
                <span class="font-mono text-xs text-muted">{e.courseCode}</span>
                <span class="text-ink ml-2">{e.title}</span>
              </td>
              <td class="px-3 py-2 text-xs text-ink">{e.schoolYear}</td>
              <td class="px-3 py-2 text-xs text-ink">{e.finalGrade ?? ' · '}</td>
              <td class="px-3 py-2 text-xs text-ink capitalize">{e.creditStatus.replace(/_/g, ' ')}</td>
              <td class="px-3 py-2">
                <div class="flex flex-wrap gap-1">
                  {#each e.countsFor as t}
                    <span class="text-[10px] uppercase tracking-widest font-display font-medium px-2 py-0.5 rounded bg-secondary/10 text-secondary border border-secondary/20">
                      {t}
                    </span>
                  {/each}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{/if}

<!-- Regents scores table -->
{#if detail.regents.length > 0}
  <section class="mb-6">
    <h2 class="font-display text-xl font-bold text-primary mb-3">Regents scores</h2>
    <div class="border border-border rounded-lg bg-white overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-surface">
          <tr class="text-left">
            <th class="px-4 py-2 text-xs uppercase tracking-widest font-display text-primary">Exam</th>
            <th class="px-3 py-2 text-xs uppercase tracking-widest font-display text-primary">Score</th>
            <th class="px-3 py-2 text-xs uppercase tracking-widest font-display text-primary">Date</th>
            <th class="px-3 py-2 text-xs uppercase tracking-widest font-display text-primary">Tier</th>
          </tr>
        </thead>
        <tbody>
          {#each detail.regents as r}
            <tr class="border-t border-border">
              <td class="px-4 py-2 font-mono text-xs">{r.examCode}</td>
              <td class="px-3 py-2 font-display font-semibold text-primary">{r.score}</td>
              <td class="px-3 py-2 text-xs">{fmtDate(r.examDate)}</td>
              <td class="px-3 py-2 text-xs">
                {#if r.score >= 85}
                  Mastery (+1.5)
                {:else if r.score >= 65}
                  Proficiency (+1)
                {:else if r.safetyNetApplied && r.score >= 45}
                  Safety-net / appeal (+1)
                {:else}
                  Below
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{/if}

<!-- Audit log -->
{#if detail.auditLog.length > 0}
  <section class="mb-6">
    <h2 class="font-display text-xl font-bold text-primary mb-3">Audit log (last {detail.auditLog.length})</h2>
    <ol class="border border-border rounded-lg bg-white divide-y divide-border">
      {#each detail.auditLog as a}
        <li class="px-4 py-2 text-xs flex flex-wrap gap-3 justify-between">
          <div>
            <span class="font-display font-semibold text-primary">
              {a.action.replace(/_/g, ' ')}
            </span>
            <span class="text-muted"> · </span>
            <span class="text-muted capitalize">{a.actorKind}</span>
          </div>
          <span class="text-muted font-mono">{fmtDateTime(a.occurredAt)}</span>
        </li>
      {/each}
    </ol>
  </section>
{/if}
