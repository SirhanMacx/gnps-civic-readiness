<script lang="ts">
  import type { PageData } from './$types.js';
  export let data: PageData;
</script>

<svelte:head><title>Teacher · Push Civic Readiness Points</title></svelte:head>

<section class="mb-10">
  <p class="text-xs uppercase tracking-widest text-secondary font-display font-semibold mb-2">Teacher</p>
  <h1 class="font-display text-3xl text-primary mb-3">Push civic readiness points</h1>
  <p class="font-serif text-base text-muted max-w-3xl">
    When you've already collected the evidence — graded the research paper, supervised the civic project, taught the elective course — you can push points to your students directly. No need to ask each one to submit through the public form.
  </p>
</section>

<section class="grid md:grid-cols-2 gap-5 mb-10">
  <a href="/teacher/push" class="block border border-border rounded-lg p-6 hover:border-primary hover:shadow-md transition group">
    <div class="font-display font-semibold text-lg text-primary group-hover:text-secondary transition">Bulk push</div>
    <p class="text-sm text-muted mt-2">Pick a pathway, paste a list of student IDs (or upload a class roster), award the points to all of them at once. Optional class-wide attachment.</p>
    <div class="text-xs text-secondary font-display font-semibold uppercase tracking-wider mt-4">Open →</div>
  </a>

  <a href="/teacher/recent" class="block border border-border rounded-lg p-6 hover:border-primary hover:shadow-md transition group">
    <div class="font-display font-semibold text-lg text-primary group-hover:text-secondary transition">My recent pushes</div>
    <p class="text-sm text-muted mt-2">See the last 50 pathway submissions you've created on behalf of students. Useful for tracking what's awaiting SCRC review vs already awarded.</p>
    <div class="text-xs text-secondary font-display font-semibold uppercase tracking-wider mt-4">View →</div>
  </a>
</section>

<section class="bg-surface border-l-4 border-secondary p-5 rounded-lg max-w-3xl mb-8">
  <p class="font-display font-semibold text-primary mb-2">How pushes are reviewed</p>
  <ul class="text-sm text-muted space-y-1.5 list-disc pl-5">
    <li>If you're also on the <strong>Civic Readiness Committee</strong>, your push is awarded immediately — your score is the SCRC score.</li>
    <li>Otherwise, your push lands in the SCRC review queue and gets the same rubric scoring as a student-initiated proposal. The SCRC committee scores against the NYSED rubric, then the points award.</li>
    <li>Either way, the student gets credit and can see it in their progress email after the next submission.</li>
  </ul>
</section>

<p class="text-xs text-muted">
  Signed in as <strong>{data.user?.fullName ?? data.user?.email}</strong> ({data.user?.role}). Need a different role? Email <a href="mailto:civicseal@greatneck.k12.ny.us" class="text-primary hover:underline">civicseal@greatneck.k12.ny.us</a>.
</p>
