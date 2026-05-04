<script lang="ts">
  import type { PageData } from './$types.js';
  export let data: PageData;

  let gradYearFilter: string = 'all';
  let statusFilter: string = 'all';
  let searchQuery: string = '';

  $: filteredRoster = data.roster.filter((r) => {
    if (gradYearFilter !== 'all' && String(r.gradYear) !== gradYearFilter) return false;
    if (statusFilter === 'eligible' && !r.eligible) return false;
    if (statusFilter === 'awarded' && r.status !== 'awarded') return false;
    if (statusFilter === 'in_progress' && (r.eligible || r.status === 'awarded')) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const hay = `${r.firstName} ${r.lastName} ${r.id}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  function formatDate(iso: string): string {
    if (!iso) return '';
    return iso.length >= 10 ? iso.slice(0, 10) : iso;
  }
</script>

<svelte:head>
  <title>Admin · GNPS Civic Readiness Portal</title>
</svelte:head>

<section class="py-8">
  <div class="flex flex-wrap items-end justify-between gap-3 mb-6">
    <div>
      <p class="text-xs uppercase tracking-widest text-secondary font-display font-semibold mb-2">
        Portal Administration
      </p>
      <h1 class="font-display text-3xl font-bold text-primary mb-1">
        Welcome, {data.user?.fullName ?? 'admin'}.
      </h1>
      <p class="text-sm text-muted">
        Cohort roster, course catalog, staff directory, and NYSED audit-pack export.
      </p>
    </div>
    <div class="flex flex-wrap gap-2 text-sm">
      <a
        href="/admin/import"
        class="rounded-md bg-primary text-white px-4 py-2 font-display font-semibold hover:bg-primary-dark"
      >
        Import IC CSV
      </a>
      <a
        href="/admin/courses"
        class="rounded-md border border-border bg-white px-4 py-2 font-display font-semibold text-primary hover:bg-surface"
      >
        Course Catalog
      </a>
      <a
        href="/admin/users"
        class="rounded-md border border-border bg-white px-4 py-2 font-display font-semibold text-primary hover:bg-surface"
      >
        Staff
      </a>
      {#if data.gradYearsToShow.length > 0}
        <a
          href={`/admin/export?cohort=${data.gradYearsToShow[data.gradYearsToShow.length - 1]}`}
          class="rounded-md bg-secondary text-white px-4 py-2 font-display font-semibold hover:opacity-90"
        >
          Export Audit Pack
        </a>
      {/if}
    </div>
  </div>

  <!-- Metric bar -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
    <div class="rounded-lg border border-border bg-white px-5 py-4">
      <p class="text-xs uppercase tracking-widest text-muted font-display font-semibold">
        Total students
      </p>
      <p class="font-display text-3xl font-bold text-primary">
        {data.totals.totalStudents}
      </p>
    </div>
    <div class="rounded-lg border border-border bg-white px-5 py-4">
      <p class="text-xs uppercase tracking-widest text-muted font-display font-semibold">
        Eligible
      </p>
      <p class="font-display text-3xl font-bold text-secondary">{data.totals.eligible}</p>
    </div>
    <div class="rounded-lg border border-border bg-white px-5 py-4">
      <p class="text-xs uppercase tracking-widest text-muted font-display font-semibold">
        Awarded
      </p>
      <p class="font-display text-3xl font-bold text-primary">{data.totals.awarded}</p>
    </div>
  </div>

  <!-- Filters -->
  <div class="flex flex-wrap items-end gap-3 mb-4">
    <label class="text-xs flex flex-col">
      <span class="font-display font-semibold text-muted uppercase tracking-widest mb-1">
        Grad year
      </span>
      <select
        bind:value={gradYearFilter}
        class="rounded-md border border-border bg-white px-3 py-2 text-sm"
      >
        <option value="all">All</option>
        {#each data.gradYearsToShow as y (y)}
          <option value={String(y)}>{y}</option>
        {/each}
      </select>
    </label>
    <label class="text-xs flex flex-col">
      <span class="font-display font-semibold text-muted uppercase tracking-widest mb-1">
        Status
      </span>
      <select
        bind:value={statusFilter}
        class="rounded-md border border-border bg-white px-3 py-2 text-sm"
      >
        <option value="all">All</option>
        <option value="eligible">Eligible</option>
        <option value="awarded">Awarded</option>
        <option value="in_progress">In progress</option>
      </select>
    </label>
    <label class="text-xs flex flex-col flex-1 min-w-[200px]">
      <span class="font-display font-semibold text-muted uppercase tracking-widest mb-1">
        Search by name or ID
      </span>
      <input
        type="search"
        bind:value={searchQuery}
        placeholder="Goldberg or GN20271234"
        class="rounded-md border border-border bg-white px-3 py-2 text-sm"
      />
    </label>
    <p class="text-xs text-muted">{filteredRoster.length} of {data.roster.length} students</p>
  </div>

  <!-- Roster table -->
  <div class="overflow-x-auto rounded-lg border border-border bg-white">
    <table class="min-w-full text-sm">
      <thead class="bg-surface text-xs uppercase tracking-widest text-muted">
        <tr>
          <th class="text-left px-4 py-3 font-display font-semibold">Student</th>
          <th class="text-left px-4 py-3 font-display font-semibold">ID</th>
          <th class="text-left px-4 py-3 font-display font-semibold">Class</th>
          <th class="text-right px-4 py-3 font-display font-semibold">Knowledge</th>
          <th class="text-right px-4 py-3 font-display font-semibold">Participation</th>
          <th class="text-right px-4 py-3 font-display font-semibold">Total</th>
          <th class="text-left px-4 py-3 font-display font-semibold">Status</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border">
        {#each filteredRoster as r (r.id)}
          <tr>
            <td class="px-4 py-2 font-medium text-primary">
              {r.lastName}, {r.firstName}
            </td>
            <td class="px-4 py-2 font-mono text-xs text-muted">{r.id}</td>
            <td class="px-4 py-2">{r.gradYear}</td>
            <td class="px-4 py-2 text-right tabular-nums">{r.knowledge.toFixed(1)}</td>
            <td class="px-4 py-2 text-right tabular-nums">{r.participation.toFixed(1)}</td>
            <td class="px-4 py-2 text-right tabular-nums font-semibold">
              {r.total.toFixed(1)}
            </td>
            <td class="px-4 py-2">
              {#if r.status === 'awarded'}
                <span
                  class="inline-block rounded-full bg-primary text-white text-xs px-2 py-0.5"
                >
                  Awarded
                </span>
              {:else if r.eligible}
                <span
                  class="inline-block rounded-full border border-secondary text-secondary text-xs px-2 py-0.5"
                >
                  Eligible
                </span>
              {:else}
                <span class="text-muted text-xs">In progress</span>
              {/if}
            </td>
          </tr>
        {/each}
        {#if filteredRoster.length === 0}
          <tr>
            <td colspan="7" class="px-4 py-8 text-center text-muted">
              No students match the current filters.
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>

  <!-- Recent imports -->
  {#if data.recentImports.length > 0}
    <div class="mt-8">
      <h2 class="font-display text-lg font-bold text-primary mb-2">Recent CSV imports</h2>
      <ul class="text-sm text-muted divide-y divide-border bg-white border border-border rounded-lg">
        {#each data.recentImports as imp (imp.id)}
          <li class="px-4 py-2 flex flex-wrap gap-3 justify-between">
            <span>{formatDate(imp.occurredAt)} · {imp.rows} rows</span>
            <span>
              students upserted: <strong>{imp.studentsUpserted}</strong> ·
              enrollments: <strong>{imp.courseEnrollmentUpserted}</strong> ·
              regents: <strong>{imp.regentsScoresUpserted}</strong>
            </span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>
