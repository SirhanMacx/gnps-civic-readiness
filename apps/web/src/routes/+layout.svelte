<script lang="ts">
  import '../app.css';
  import AppShell from '$theme/AppShell.svelte';
  import type { LayoutData } from './$types.js';

  export let data: LayoutData;
</script>

<AppShell user={data.user ?? null}>
  <slot />
</AppShell>
