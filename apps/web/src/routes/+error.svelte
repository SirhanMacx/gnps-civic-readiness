<script lang="ts">
  import { page } from '$app/stores';
</script>

<svelte:head>
  <title>{$page.status} · GNPS Civic Readiness</title>
</svelte:head>

<section class="text-center py-12 max-w-2xl mx-auto">
  <p class="font-display text-xs uppercase tracking-widest text-secondary font-semibold mb-3">Something went wrong</p>
  <h1 class="font-display text-6xl font-bold text-primary mb-4">{$page.status}</h1>
  <p class="font-serif text-lg text-muted mb-6">
    {#if $page.status === 404}
      That page doesn't exist. The link may have moved, or you may have mistyped the URL.
    {:else if $page.status === 403}
      You don't have access to this page. If you're staff, sign in with your district email; otherwise this area is for staff only.
    {:else if $page.status === 500}
      The server hit an unexpected error. We've logged it · try again in a moment, or email civicseal@greatneck.k12.ny.us if it keeps happening.
    {:else}
      {$page.error?.message ?? 'An unexpected error occurred.'}
    {/if}
  </p>

  <div class="flex flex-wrap gap-3 justify-center mt-8">
    <a href="/" class="inline-block btn btn-primary">Back to home</a>
    <a href="/submit" class="inline-block btn btn-secondary">Submit Evidence</a>
    {#if $page.status === 403}
      <a href="/login" class="inline-block btn btn-secondary">Staff Login</a>
    {/if}
  </div>

  <p class="text-xs text-muted mt-12">
    Questions: <a href="mailto:civicseal@greatneck.k12.ny.us" class="text-primary hover:underline">civicseal@greatneck.k12.ny.us</a>
  </p>
</section>
