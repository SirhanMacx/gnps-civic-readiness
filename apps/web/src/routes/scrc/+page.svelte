<script lang="ts">
  import type { PageData } from './$types.js';
  export let data: PageData;
</script>

<svelte:head>
  <title>SCRC Review · GNPS Civic Readiness Portal</title>
</svelte:head>

<section class="py-8">
  <p class="text-xs uppercase tracking-widest text-secondary font-display font-semibold mb-2">Civic Readiness Committee</p>
  <h1 class="font-display text-3xl font-bold text-primary mb-3">Welcome, {data.user?.fullName ?? 'committee member'}.</h1>
  <p class="text-sm text-muted mb-6 leading-relaxed">
    Project topic review and rubric scoring will appear here.
  </p>

  <div class="border border-border rounded-lg bg-surface px-6 py-8 text-center">
    <p class="font-display font-semibold text-lg text-primary mb-1">SCRC review queue — coming soon.</p>
    <p class="text-sm text-muted">Topic approvals · NYSED rubric scoring · capstone review will land here.</p>
  </div>
</section>
