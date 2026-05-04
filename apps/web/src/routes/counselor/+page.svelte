<script lang="ts">
  import type { PageData } from './$types.js';
  export let data: PageData;
</script>

<svelte:head>
  <title>Counselor Dashboard · GNPS Civic Readiness Portal</title>
</svelte:head>

<section class="py-8">
  <p class="text-xs uppercase tracking-widest text-secondary font-display font-semibold mb-2">Counselor Workspace</p>
  <h1 class="font-display text-3xl font-bold text-primary mb-3">Welcome, {data.user?.fullName ?? 'counselor'}.</h1>
  <p class="text-sm text-muted mb-6 leading-relaxed">
    Your caseload roster, approval queue, and progress views are coming online in the next deploy.
  </p>

  <div class="border border-border rounded-lg bg-surface px-6 py-8 text-center">
    <p class="font-display font-semibold text-lg text-primary mb-1">Counselor dashboard — coming soon.</p>
    <p class="text-sm text-muted">Approval queue · roster · reflection review will land here.</p>
  </div>
</section>
