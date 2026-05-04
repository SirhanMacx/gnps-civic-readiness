<script lang="ts">
  import type { PageData } from './$types.js';
  export let data: PageData;

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  function pathwayLabel(pt: string): string {
    return pt.replace(/_/g, ' ');
  }
  function statusPill(status: string): string {
    if (status === 'awarded') return 'bg-green-100 text-green-800';
    if (status === 'proposed' || status === 'submitted') return 'bg-yellow-100 text-yellow-900';
    if (status === 'scored') return 'bg-blue-100 text-blue-900';
    if (status === 'rejected') return 'bg-red-100 text-red-900';
    return 'bg-gray-100 text-gray-800';
  }
</script>

<svelte:head><title>My Recent Pushes · Teacher · GNPS Civic Readiness</title></svelte:head>

<a href="/teacher" class="text-sm text-primary hover:underline">← Teacher home</a>
<h1 class="font-display text-3xl text-primary mt-2 mb-2">My recent pushes</h1>
<p class="text-sm text-muted mb-6">Last 50 pathway submissions you've pushed.</p>

{#if data.pushes.length === 0}
  <div class="border border-border rounded-lg p-8 text-center bg-surface">
    <p class="text-muted">You haven't pushed any pathway points yet.</p>
    <a href="/teacher/push" class="inline-block mt-3 btn btn-primary">Push your first batch</a>
  </div>
{:else}
  <div class="overflow-x-auto border border-border rounded-lg">
    <table class="w-full text-sm">
      <thead class="bg-surface text-xs uppercase tracking-wider font-display text-primary">
        <tr>
          <th class="px-4 py-2 text-left">Date</th>
          <th class="px-4 py-2 text-left">Student ID</th>
          <th class="px-4 py-2 text-left">Pathway</th>
          <th class="px-4 py-2 text-right">Points</th>
          <th class="px-4 py-2 text-left">Status</th>
        </tr>
      </thead>
      <tbody>
        {#each data.pushes as p}
          <tr class="border-t border-border">
            <td class="px-4 py-2 text-muted">{formatDate(p.created_at)}</td>
            <td class="px-4 py-2 font-mono text-xs">{p.student_id}</td>
            <td class="px-4 py-2 capitalize">{pathwayLabel(p.pathway_type)}</td>
            <td class="px-4 py-2 text-right font-display font-semibold">{p.points_awarded ?? ' · '}</td>
            <td class="px-4 py-2">
              <span class="inline-block px-2 py-0.5 rounded text-xs font-display font-semibold uppercase tracking-wider {statusPill(p.status)}">
                {p.status.replace(/_/g, ' ')}
              </span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
