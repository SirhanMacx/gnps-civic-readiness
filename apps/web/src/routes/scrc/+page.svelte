<script lang="ts">
  import type { PageData } from './$types.js';
  export let data: PageData;

  type Tab = 'proposals' | 'scoring';
  let activeTab: Tab = data.proposalQueue.length === 0 && data.scoringQueue.length > 0 ? 'scoring' : 'proposals';

  const PATHWAY_LABEL: Record<string, string> = {
    research_project: 'Research Project (1e)',
    hs_civic_project: 'HS Civic Project (2a)',
    hs_capstone: 'HS Capstone (2f)',
    ms_capstone: 'MS Capstone'
  };

  function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function truncate(s: string | null, n = 110): string {
    if (!s) return '';
    return s.length > n ? `${s.slice(0, n).trim()}…` : s;
  }
</script>

<svelte:head>
  <title>SCRC Review · GNPS Civic Readiness Portal</title>
</svelte:head>

<section class="py-8">
  <p class="text-xs uppercase tracking-widest text-secondary font-display font-semibold mb-2">
    Civic Readiness Committee
  </p>
  <h1 class="font-display text-3xl font-bold text-primary mb-3">
    Welcome, {data.user?.fullName ?? 'committee member'}.
  </h1>
  <p class="text-sm text-muted mb-6 leading-relaxed max-w-3xl">
    Review proposed project topics for NYSED essential elements, then score completed work against
    the published Appendix F / G / P rubrics. Every action you take is recorded in the audit log
    and surfaces in the year-end NYSED audit pack.
  </p>

  <!-- Stats strip -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
    <div class="border border-border rounded-lg bg-surface px-5 py-4">
      <p class="text-xs uppercase tracking-wider text-muted font-semibold">Topics pending</p>
      <p class="font-display text-3xl font-bold text-primary mt-1">{data.proposalQueue.length}</p>
    </div>
    <div class="border border-border rounded-lg bg-surface px-5 py-4">
      <p class="text-xs uppercase tracking-wider text-muted font-semibold">Awaiting scoring</p>
      <p class="font-display text-3xl font-bold text-primary mt-1">{data.scoringQueue.length}</p>
    </div>
    <div class="border border-border rounded-lg bg-surface px-5 py-4">
      <p class="text-xs uppercase tracking-wider text-muted font-semibold">Scored / awarded</p>
      <p class="font-display text-3xl font-bold text-primary mt-1">{data.awardedCount}</p>
    </div>
  </div>

  <!-- Tabs -->
  <div class="border-b border-border mb-4 flex gap-2" role="tablist">
    <button
      type="button"
      role="tab"
      aria-selected={activeTab === 'proposals'}
      class="px-4 py-2 font-display font-semibold text-sm border-b-2 transition-colors {activeTab === 'proposals' ? 'border-secondary text-primary' : 'border-transparent text-muted hover:text-primary'}"
      on:click={() => (activeTab = 'proposals')}
    >
      Proposal review ({data.proposalQueue.length} pending)
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={activeTab === 'scoring'}
      class="px-4 py-2 font-display font-semibold text-sm border-b-2 transition-colors {activeTab === 'scoring' ? 'border-secondary text-primary' : 'border-transparent text-muted hover:text-primary'}"
      on:click={() => (activeTab = 'scoring')}
    >
      Scoring ({data.scoringQueue.length} pending)
    </button>
  </div>

  {#if activeTab === 'proposals'}
    <div role="tabpanel">
      {#if data.proposalQueue.length === 0}
        <div class="border border-border rounded-lg bg-surface px-6 py-10 text-center">
          <p class="font-display font-semibold text-lg text-primary mb-1">No topics pending review.</p>
          <p class="text-sm text-muted">When students submit project proposals they'll appear here.</p>
        </div>
      {:else}
        <ul class="space-y-3">
          {#each data.proposalQueue as row (row.submissionId)}
            <li class="border border-border rounded-lg bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span class="font-display font-semibold text-primary">{row.studentFullName}</span>
                  <span class="text-xs text-muted">#{row.studentId} · class of {row.gradYear}</span>
                </div>
                <p class="text-sm text-muted mt-1">
                  <span class="font-semibold text-ink">{PATHWAY_LABEL[row.pathwayType] ?? row.pathwayType}</span>
                  {#if row.scope}<span class="text-muted"> · {row.scope}</span>{/if}
                  {#if row.advisorName}<span class="text-muted"> · advisor {row.advisorName}</span>{/if}
                </p>
                {#if row.issueIdentified}
                  <p class="text-sm text-ink mt-1.5">{truncate(row.issueIdentified)}</p>
                {/if}
                <p class="text-xs text-muted mt-1.5">Proposed {fmtDate(row.proposedAt)}</p>
              </div>
              <a
                class="self-start sm:self-center inline-flex items-center justify-center px-4 py-2 rounded-md bg-primary text-white font-display font-semibold text-sm hover:bg-primary-dark whitespace-nowrap"
                href="/scrc/proposal/{row.submissionId}"
              >
                review →
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {:else}
    <div role="tabpanel">
      {#if data.scoringQueue.length === 0}
        <div class="border border-border rounded-lg bg-surface px-6 py-10 text-center">
          <p class="font-display font-semibold text-lg text-primary mb-1">No projects awaiting scoring.</p>
          <p class="text-sm text-muted">When students complete approved projects and upload evidence, they'll appear here.</p>
        </div>
      {:else}
        <ul class="space-y-3">
          {#each data.scoringQueue as row (row.submissionId)}
            <li class="border border-border rounded-lg bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span class="font-display font-semibold text-primary">{row.studentFullName}</span>
                  <span class="text-xs text-muted">#{row.studentId} · class of {row.gradYear}</span>
                </div>
                <p class="text-sm text-muted mt-1">
                  <span class="font-semibold text-ink">{PATHWAY_LABEL[row.pathwayType] ?? row.pathwayType}</span>
                  {#if row.scope}<span class="text-muted"> · {row.scope}</span>{/if}
                  {#if row.advisorName}<span class="text-muted"> · advisor {row.advisorName}</span>{/if}
                </p>
                {#if row.issueIdentified}
                  <p class="text-sm text-ink mt-1.5">{truncate(row.issueIdentified)}</p>
                {/if}
                <p class="text-xs text-muted mt-1.5">Submitted {fmtDate(row.submittedAt)}</p>
              </div>
              <a
                class="self-start sm:self-center inline-flex items-center justify-center px-4 py-2 rounded-md bg-secondary text-white font-display font-semibold text-sm hover:opacity-90 whitespace-nowrap"
                href="/scrc/proposal/{row.submissionId}"
              >
                score →
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</section>
