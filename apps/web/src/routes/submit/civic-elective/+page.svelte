<script lang="ts">
  import type { ActionData } from './$types';
  export let form: ActionData;
</script>

<svelte:head><title>Civic-Engagement Elective Essay — GNPS Civic Readiness</title></svelte:head>

<a href="/submit" class="text-sm text-primary hover:underline">← All pathways</a>
<h1 class="font-display text-3xl text-primary mt-2 mb-1">Civic-Engagement Elective Essay</h1>
<p class="text-sm text-muted mb-6">Pathway 2c · 0.5 pt · pairs with course-grade proficiency</p>

{#if form?.success}
  <div class="bg-green-50 border-l-4 border-green-600 p-5 rounded mb-6 max-w-2xl">
    <p class="font-display font-semibold text-green-900 text-lg mb-1">Essay uploaded</p>
    <p class="text-sm text-green-900">Submission #{form.submissionId} saved. Your file <strong>{form.fileName}</strong> has been stored for SCRC review.</p>
    {#if form.storageWarning}
      <p class="text-xs text-amber-900 mt-2">Storage note: {form.storageWarning}. Your submission record is saved; an admin will retry the file upload.</p>
    {/if}
    <p class="text-sm text-green-900 mt-2">The 0.5 point is awarded once your course teacher confirms course-grade proficiency.</p>
    <a href="/submit" class="inline-block mt-3 text-sm text-green-900 underline">Submit more evidence →</a>
  </div>
{:else}
  {#if form?.error}
    <div class="bg-red-50 border-l-4 border-red-600 p-4 rounded mb-4 max-w-2xl">
      <p class="font-display font-semibold text-red-900">There was a problem</p>
      <p class="text-sm text-red-900 mt-1">{form.error}</p>
    </div>
  {/if}

  <form method="POST" enctype="multipart/form-data" class="space-y-5 max-w-2xl">
    <fieldset class="border border-border rounded-lg p-5">
      <legend class="px-2 text-xs uppercase tracking-widest font-display font-semibold text-primary">Your information</legend>
      <div class="grid grid-cols-2 gap-4">
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Student ID</span>
          <input name="studentId" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="GN20271234" />
        </label>
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Graduation year</span>
          <input name="gradYear" type="number" min="2024" max="2040" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="2027" />
        </label>
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">First name</span>
          <input name="studentFirstName" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" />
        </label>
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Last name</span>
          <input name="studentLastName" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" />
        </label>
      </div>
    </fieldset>

    <fieldset class="border border-border rounded-lg p-5">
      <legend class="px-2 text-xs uppercase tracking-widest font-display font-semibold text-primary">Course</legend>
      <div class="grid grid-cols-2 gap-4">
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Course code</span>
          <input name="courseCode" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="PARTIC-IN-GOV · APGOV · CIV12" />
          <span class="text-xs text-muted mt-1 block">From the GNPS course catalog. Must be an SCRC-designated civic-engagement elective.</span>
        </label>
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Course year</span>
          <input name="courseYear" pattern="\d{4}-\d{4}" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="2025-2026" />
          <span class="text-xs text-muted mt-1 block">Format: YYYY-YYYY (e.g., 2025-2026).</span>
        </label>
      </div>
    </fieldset>

    <fieldset class="border border-border rounded-lg p-5">
      <legend class="px-2 text-xs uppercase tracking-widest font-display font-semibold text-primary">Essay file</legend>
      <label class="block">
        <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Upload essay (PDF or DOCX, max 8 MB)</span>
        <input name="essayFile" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary file:text-white file:font-display file:font-semibold file:text-xs file:uppercase file:tracking-wider file:cursor-pointer" />
        <span class="text-xs text-muted mt-1 block">Your essay should reflect on what you learned in the course and connect it to civic engagement. Length expectations are set by the course rubric.</span>
      </label>
    </fieldset>

    <button class="bg-secondary text-white px-7 py-3 rounded font-display font-semibold uppercase tracking-wide text-sm hover:opacity-90 transition">Upload essay</button>
    <p class="text-xs text-muted mt-2">By submitting, you confirm this is your own work. The 0.5 point is awarded once your course teacher confirms course-grade proficiency.</p>
  </form>
{/if}
