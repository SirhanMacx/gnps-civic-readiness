<svelte:head><title>Submit Evidence · GNPS Civic Readiness</title></svelte:head>

<h1 class="font-display text-3xl text-primary mb-3">Submit Evidence</h1>
<p class="font-serif text-lg text-muted mb-8 max-w-3xl">Choose the pathway that matches what you've done. You can submit evidence as you go · you don't have to wait until senior year.</p>

<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
  {#each [
    { href: '/submit/service', label: 'Service-Learning Hours', sub: 'Pathway 2b · 25+ hrs · 1 pt · reflection required', live: true },
    { href: '/submit/wbl', label: 'Extra-curricular / Work-Based Learning', sub: 'Pathway 2e · 40+ hrs · 0.5 pt · application essay', live: true },
    { href: '/submit/civic-project', label: 'High School Civic Project', sub: 'Pathway 2a · 1.5 pt · max 2× · SCRC pre-approves topic', live: true },
    { href: '/submit/research', label: 'Research Project', sub: 'Pathway 1e · 1 pt · SCRC pre-approves topic', live: true },
    { href: '/submit/capstone', label: 'Civics Capstone Project', sub: 'Pathway 2f · 4 pts · SCRC pre-approves topic & scores work', live: true },
    { href: '/submit/civic-elective', label: 'Civic-Engagement Elective Essay', sub: 'Pathway 2c · 0.5 pt · paired with course-grade proficiency', live: true },
  ] as p}
    {#if p.live}
      <a href={p.href} class="block border border-border rounded-lg p-5 hover:border-primary hover:shadow-md transition group">
        <div class="font-display font-semibold text-primary group-hover:text-secondary transition">{p.label}</div>
        <div class="text-xs text-muted mt-1.5">{p.sub}</div>
        <div class="text-xs text-secondary font-display font-semibold uppercase tracking-wider mt-3">Open →</div>
      </a>
    {:else}
      <div class="block border border-border rounded-lg p-5 bg-surface opacity-70 cursor-not-allowed">
        <div class="font-display font-semibold text-primary">{p.label}</div>
        <div class="text-xs text-muted mt-1.5">{p.sub}</div>
        <div class="text-xs text-muted font-display font-semibold uppercase tracking-wider mt-3">Coming soon · pilot expanding May 2026</div>
      </div>
    {/if}
  {/each}
</div>

<p class="text-xs text-muted mt-8">Pilot status: Phase 1 evidence intake is live for all listed pathways. Staff review, Infinite Campus CSV import, and year-end export run behind staff login. Questions: <a href="mailto:civicseal@greatneck.k12.ny.us" class="text-primary hover:underline">civicseal@greatneck.k12.ny.us</a></p>
