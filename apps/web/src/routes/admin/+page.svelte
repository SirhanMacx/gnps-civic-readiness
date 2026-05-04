<script lang="ts">
  import type { PageData } from './$types.js';
  export let data: PageData;
</script>

<svelte:head>
  <title>Admin · GNPS Civic Readiness Portal</title>
</svelte:head>

<section class="py-8">
  <p class="text-xs uppercase tracking-widest text-secondary font-display font-semibold mb-2">Portal Administration</p>
  <h1 class="font-display text-3xl font-bold text-primary mb-3">Welcome, {data.user?.fullName ?? 'admin'}.</h1>
  <p class="text-sm text-muted mb-6 leading-relaxed">
    Roster import, course catalog, staff invites, and NYSED audit-pack export will appear here.
  </p>

  <div class="border border-border rounded-lg bg-surface px-6 py-8 text-center">
    <p class="font-display font-semibold text-lg text-primary mb-1">Admin — coming soon.</p>
    <p class="text-sm text-muted">CSV import · course catalog editor · NYSED audit pack will land here.</p>
  </div>
</section>
