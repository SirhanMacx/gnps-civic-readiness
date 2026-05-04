<script lang="ts">
  import type { ActionData, PageData } from './$types.js';
  export let data: PageData;
  export let form: ActionData;

  // Default points by pathway (NYSED-defined). Teacher can override below the cap.
  const PATHWAY_DEFAULTS: Record<string, { label: string; points: number; notes: string }> = {
    research_project:    { label: 'Research Project (1e)',                    points: 1.0, notes: 'NYSED civic-knowledge research project — 1 pt' },
    hs_civic_project:    { label: 'HS Civic Project (2a)',                    points: 1.5, notes: '1.5 pt · max 2 instances per student (3 pt cap)' },
    hs_capstone:         { label: 'Civics Capstone Project (2f)',             points: 4.0, notes: '4 pt · single instance · NYSED Appendix P rubric' },
    ms_capstone:         { label: 'MS Capstone Project (grades 7–8)',          points: 1.0, notes: '1 pt · MS work back-entered at HS intake' },
    civic_elective_essay:{ label: 'Civic-Engagement Elective Essay (2c)',     points: 0.5, notes: '0.5 pt · pairs with course-grade proficiency' },
    service_learning:    { label: 'Service-Learning (2b)',                    points: 1.0, notes: '1 pt · normally student-initiated; use this for class-organized service' },
    wbl_extracurr:       { label: 'Extra-curricular / Work-Based Learning (2e)', points: 0.5, notes: '0.5 pt · 40+ hour threshold; class-org WBL pushes here' }
  };

  let selectedPathway: keyof typeof PATHWAY_DEFAULTS = 'hs_civic_project';
  $: defaultEntry = PATHWAY_DEFAULTS[selectedPathway];
</script>

<svelte:head><title>Bulk Push · Teacher · GNPS Civic Readiness</title></svelte:head>

<a href="/teacher" class="text-sm text-primary hover:underline">← Teacher home</a>
<h1 class="font-display text-3xl text-primary mt-2 mb-1">Bulk push pathway points</h1>
<p class="text-sm text-muted mb-6">Award the same pathway to a list of students in one action. {data.user?.role === 'scrc_member' || data.user?.role === 'admin' ? 'As an SCRC committee member, your pushes award immediately.' : 'Your pushes go to the SCRC review queue for scoring.'}</p>

{#if form?.success}
  <div class="bg-green-50 border-l-4 border-green-600 p-5 rounded mb-6 max-w-3xl">
    <p class="font-display font-semibold text-green-900 text-lg mb-1">
      Pushed {form.pushedCount} student{form.pushedCount === 1 ? '' : 's'}
      {#if form.status === 'awarded'}— points awarded immediately{:else}— queued for SCRC review{/if}
    </p>
    {#if form.rejected && form.rejected.length > 0}
      <details class="mt-2">
        <summary class="text-sm text-green-900 cursor-pointer">{form.rejected.length} student(s) skipped — see why</summary>
        <ul class="text-sm text-green-900 mt-2 list-disc pl-6">
          {#each form.rejected as r}
            <li><code>{r.studentId}</code>: {r.reason.replace(/_/g, ' ')}</li>
          {/each}
        </ul>
      </details>
    {/if}
    <a href="/teacher/recent" class="inline-block mt-3 text-sm text-green-900 underline">See all recent pushes →</a>
    <a href="/teacher/push" class="inline-block mt-3 ml-3 text-sm text-green-900 underline">Push another batch →</a>
  </div>
{:else}
  {#if form?.error}
    <div class="bg-red-50 border-l-4 border-red-600 p-4 rounded mb-4 max-w-3xl">
      <p class="font-display font-semibold text-red-900">There was a problem</p>
      <p class="text-sm text-red-900 mt-1">{form.error}</p>
    </div>
  {/if}

  <form method="POST" class="space-y-5 max-w-3xl">
    <fieldset class="border border-border rounded-lg p-5">
      <legend class="px-2 text-xs uppercase tracking-widest font-display font-semibold text-primary">1 · Which pathway</legend>
      <label class="block">
        <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Pathway</span>
        <select name="pathwayType" bind:value={selectedPathway} class="w-full mt-1 px-3 py-2 border border-border rounded text-sm bg-white focus:border-primary focus:ring-1 focus:ring-primary">
          {#each Object.entries(PATHWAY_DEFAULTS) as [key, def]}
            <option value={key}>{def.label}</option>
          {/each}
        </select>
        {#if defaultEntry}
          <p class="text-xs text-muted mt-2 italic">{defaultEntry.notes}</p>
        {/if}
      </label>

      <div class="grid grid-cols-2 gap-4 mt-4">
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Points (per student)</span>
          <input
            name="pointsAwarded"
            type="number"
            step="0.5"
            min="0"
            max="4"
            value={defaultEntry?.points ?? 0}
            class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary"
            required
          />
          <p class="text-xs text-muted mt-1">Cap rules apply automatically — over-cap pushes are skipped.</p>
        </label>

        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Class label (optional)</span>
          <input
            name="classLabel"
            placeholder="e.g. AP US Government — Period 4"
            class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <p class="text-xs text-muted mt-1">Shows in the audit log + counselor view.</p>
        </label>
      </div>
    </fieldset>

    <fieldset class="border border-border rounded-lg p-5">
      <legend class="px-2 text-xs uppercase tracking-widest font-display font-semibold text-primary">2 · Who gets it</legend>
      <p class="text-xs text-muted mb-2">Paste student IDs — one per line, or comma-separated. Up to 200 per push.</p>
      <textarea
        name="studentIds"
        rows="6"
        required
        placeholder={'GN20271234\nGN20275511\nGN20274432\n...'}
        class="w-full mt-1 px-3 py-2 border border-border rounded text-sm font-mono focus:border-primary focus:ring-1 focus:ring-primary"
      ></textarea>
      <p class="text-xs text-muted mt-2">Phase 2: pick a class roster directly from Infinite Campus. For now, a CSV export from IC's "Student Roster" report works — paste the ID column here.</p>
    </fieldset>

    <fieldset class="border border-border rounded-lg p-5">
      <legend class="px-2 text-xs uppercase tracking-widest font-display font-semibold text-primary">3 · Civic-readiness domains demonstrated</legend>
      <p class="text-xs text-muted mb-3">Required for project pathways (1e, 2a, 2f). NYSED scores against these.</p>
      <div class="flex flex-wrap gap-4">
        {#each ['knowledge', 'skills', 'mindsets', 'experiences'] as d}
          <label class="inline-flex items-center text-sm">
            <input type="checkbox" name="domainTags" value={d} class="mr-2 text-primary focus:ring-primary" />
            <span class="capitalize">{d}</span>
          </label>
        {/each}
      </div>
    </fieldset>

    <fieldset class="border border-border rounded-lg p-5">
      <legend class="px-2 text-xs uppercase tracking-widest font-display font-semibold text-primary">4 · Context (optional)</legend>
      <label class="block">
        <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Notes</span>
        <textarea
          name="notes"
          rows="3"
          maxlength="2000"
          placeholder="What was the assignment? Where did you collect the evidence? Any students who need follow-up?"
          class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary"
        ></textarea>
      </label>
    </fieldset>

    <button class="bg-secondary text-white px-7 py-3 rounded font-display font-semibold uppercase tracking-wide text-sm hover:opacity-90 transition">
      Push to all
    </button>
    <p class="text-xs text-muted mt-2">By pushing, you confirm you have the evidence on file. Pushes are logged with your user identity.</p>
  </form>
{/if}
