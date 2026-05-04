<script lang="ts">
  import type { PageData } from './$types.js';
  import type { RosterRow, RosterStatus } from '$server/roster.js';
  export let data: PageData;

  // ---------- Filtering ----------
  let q = '';
  let gradFilter: number | 'all' = 'all';
  let statusFilter: RosterStatus | 'all' = 'all';

  $: gradYears = Array.from(new Set(data.roster.map((r: RosterRow) => r.gradYear))).sort();

  $: filtered = data.roster.filter((r: RosterRow) => {
    if (gradFilter !== 'all' && r.gradYear !== gradFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (q.trim().length > 0) {
      const needle = q.trim().toLowerCase();
      const hay = `${r.firstName} ${r.lastName} ${r.studentId}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  // ---------- Display helpers ----------
  function statusClass(s: RosterStatus): string {
    switch (s) {
      case 'awarded':
        return 'bg-green-100 text-green-900 border-green-300';
      case 'eligible':
        return 'bg-green-50 text-green-900 border-green-200';
      case 'needs_knowledge':
      case 'needs_participation':
        return 'bg-yellow-50 text-yellow-900 border-yellow-200';
      case 'needs_both':
        return 'bg-red-50 text-red-900 border-red-200';
      case 'in_progress':
      default:
        return 'bg-blue-50 text-blue-900 border-blue-200';
    }
  }

  function statusLabel(s: RosterStatus): string {
    switch (s) {
      case 'awarded':
        return 'Awarded';
      case 'eligible':
        return 'Eligible · confirm';
      case 'needs_knowledge':
        return 'Needs Knowledge';
      case 'needs_participation':
        return 'Needs Participation';
      case 'needs_both':
        return 'Needs Both';
      case 'in_progress':
      default:
        return 'In progress';
    }
  }

  function fmt(n: number): string {
    return Number.isInteger(n) ? n.toFixed(1) : n.toFixed(1);
  }

  // 6-point ceiling. Bar is solid coral up to 6 then capped.
  function barWidth(total: number): number {
    return Math.min(100, (total / 6) * 100);
  }
</script>

<svelte:head>
  <title>Counselor Dashboard · GNPS Civic Readiness Portal</title>
</svelte:head>

<section class="py-6">
  <div class="flex items-start justify-between flex-wrap gap-3 mb-1">
    <div>
      <p class="text-xs uppercase tracking-widest text-secondary font-display font-semibold mb-1">
        Counselor Workspace
      </p>
      <h1 class="font-display text-3xl font-bold text-primary leading-tight">
        Caseload roster
      </h1>
      <p class="text-sm text-muted mt-1">
        {data.user?.fullName ?? 'Counselor'} · {data.roster.length} students
      </p>
    </div>
    <nav class="flex gap-2 items-center mt-2">
      <a
        href="/counselor/queue"
        class="inline-block btn btn-primary"
      >
        Approval Queue
      </a>
      <a
        href="/counselor/import-help"
        class="btn btn-secondary"
      >
        Import Help
      </a>
    </nav>
  </div>
</section>

<!-- Rollup tiles -->
<section class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
  <div class="border border-border rounded-lg bg-surface p-4">
    <p class="text-xs uppercase tracking-widest text-muted font-display font-semibold">Total caseload</p>
    <p class="font-display text-2xl text-primary font-bold mt-1">{data.roster.length}</p>
  </div>
  <div class="border border-green-200 rounded-lg bg-green-50 p-4">
    <p class="text-xs uppercase tracking-widest text-green-900/70 font-display font-semibold">Awarded</p>
    <p class="font-display text-2xl text-green-900 font-bold mt-1">{data.awardedCount}</p>
  </div>
  <div class="border border-secondary/30 rounded-lg bg-secondary/5 p-4">
    <p class="text-xs uppercase tracking-widest text-secondary font-display font-semibold">Eligible · needs confirm</p>
    <p class="font-display text-2xl text-secondary font-bold mt-1">{data.eligibleCount}</p>
  </div>
  <div class="border border-blue-200 rounded-lg bg-blue-50 p-4">
    <p class="text-xs uppercase tracking-widest text-blue-900/70 font-display font-semibold">In progress</p>
    <p class="font-display text-2xl text-blue-900 font-bold mt-1">{data.pendingCount}</p>
  </div>
</section>

<!-- Filter bar -->
<section class="border border-border rounded-lg bg-surface px-4 py-3 mb-4 flex flex-wrap gap-3 items-end">
  <label class="block flex-1 min-w-[200px]">
    <span class="text-xs uppercase tracking-wider font-display font-medium text-primary block mb-1">
      Search by name or ID
    </span>
    <input
      type="search"
      bind:value={q}
      placeholder="Goldberg, Maya, GN20271234"
      class="w-full px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary bg-white"
    />
  </label>
  <label class="block">
    <span class="text-xs uppercase tracking-wider font-display font-medium text-primary block mb-1">
      Grad year
    </span>
    <select
      bind:value={gradFilter}
      class="px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary bg-white"
    >
      <option value="all">All</option>
      {#each gradYears as y}
        <option value={y}>{y}</option>
      {/each}
    </select>
  </label>
  <label class="block">
    <span class="text-xs uppercase tracking-wider font-display font-medium text-primary block mb-1">
      Status
    </span>
    <select
      bind:value={statusFilter}
      class="px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary bg-white"
    >
      <option value="all">All</option>
      <option value="awarded">Awarded</option>
      <option value="eligible">Eligible · confirm</option>
      <option value="needs_knowledge">Needs Knowledge</option>
      <option value="needs_participation">Needs Participation</option>
      <option value="needs_both">Needs Both</option>
      <option value="in_progress">In progress</option>
    </select>
  </label>
</section>

<!-- Roster table -->
{#if filtered.length === 0}
  <div class="border border-border rounded-lg bg-surface px-6 py-10 text-center">
    {#if data.roster.length === 0}
      <p class="font-display font-semibold text-lg text-primary mb-1">No students assigned yet</p>
      <p class="text-sm text-muted">
        Once admin imports the IC roster and assigns counselors, your caseload will appear here.
      </p>
    {:else}
      <p class="font-display font-semibold text-lg text-primary mb-1">No matches</p>
      <p class="text-sm text-muted">Try clearing the filters above.</p>
    {/if}
  </div>
{:else}
  <div class="border border-border rounded-lg bg-white overflow-hidden">
    <table class="w-full text-sm">
      <thead class="bg-primary text-white font-display">
        <tr>
          <th class="px-4 py-3 text-left text-xs uppercase tracking-widest font-semibold">Student</th>
          <th class="px-3 py-3 text-left text-xs uppercase tracking-widest font-semibold">Grad</th>
          <th class="px-3 py-3 text-left text-xs uppercase tracking-widest font-semibold">Knowledge</th>
          <th class="px-3 py-3 text-left text-xs uppercase tracking-widest font-semibold">Participation</th>
          <th class="px-3 py-3 text-left text-xs uppercase tracking-widest font-semibold">Total</th>
          <th class="px-3 py-3 text-left text-xs uppercase tracking-widest font-semibold">Status</th>
        </tr>
      </thead>
      <tbody>
        {#each filtered as r (r.studentId)}
          <tr class="border-t border-border hover:bg-surface transition">
            <td class="px-4 py-3">
              <a
                href={`/counselor/student/${r.studentId}`}
                class="font-display font-semibold text-primary hover:underline"
              >
                {r.lastName}, {r.firstName}
              </a>
              <p class="text-xs text-muted font-mono mt-0.5">{r.studentId}</p>
            </td>
            <td class="px-3 py-3 text-ink">{r.gradYear}</td>
            <td class="px-3 py-3 text-ink">
              <span class={r.knowledge >= 2 ? 'font-semibold text-green-900' : 'text-ink'}>
                {fmt(r.knowledge)}
              </span>
              <span class="text-xs text-muted">/ ≥ 2</span>
            </td>
            <td class="px-3 py-3 text-ink">
              <span class={r.participation >= 2 ? 'font-semibold text-green-900' : 'text-ink'}>
                {fmt(r.participation)}
              </span>
              <span class="text-xs text-muted">/ ≥ 2</span>
            </td>
            <td class="px-3 py-3">
              <div class="flex items-center gap-2">
                <div class="w-24 h-2 rounded bg-border overflow-hidden">
                  <div
                    class="h-full bg-secondary transition-all"
                    style:width={`${barWidth(r.total)}%`}
                  ></div>
                </div>
                <span class="text-xs font-mono text-ink whitespace-nowrap">
                  {fmt(r.total)} / 6
                </span>
              </div>
            </td>
            <td class="px-3 py-3">
              <span
                class={`inline-block text-[10px] uppercase tracking-widest font-display font-semibold px-2 py-1 rounded border ${statusClass(r.status)}`}
              >
                {statusLabel(r.status)}
              </span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<p class="text-xs text-muted mt-4">
  Showing {filtered.length} of {data.roster.length} students.
</p>
