<script lang="ts">
  import type { ActionData } from './$types';
  export let form: ActionData;
</script>

<svelte:head><title>Civics Capstone Project — GNPS Civic Readiness</title></svelte:head>

<a href="/submit" class="text-sm text-primary hover:underline">← All pathways</a>
<h1 class="font-display text-3xl text-primary mt-2 mb-1">Civics Capstone Project</h1>
<p class="text-sm text-muted mb-6">Pathway 2f · 4 pts · the highest-value pathway · SCRC committee pre-approves topic and scores final work against NYSED Appendix P</p>

{#if form?.success}
  <div class="bg-green-50 border-l-4 border-green-600 p-5 rounded mb-6 max-w-2xl">
    <p class="font-display font-semibold text-green-900 text-lg mb-1">Topic proposal submitted — awaiting SCRC committee review</p>
    <p class="text-sm text-green-900">Submission #{form.submissionId} is in the SCRC capstone queue. Capstone proposals are reviewed against NYSED Appendix P before approval. <strong>Do not begin work until the topic is approved.</strong></p>
    <a href="/submit" class="inline-block mt-3 text-sm text-green-900 underline">Submit more evidence →</a>
  </div>
{:else}
  {#if form?.error}
    <div class="bg-red-50 border-l-4 border-red-600 p-4 rounded mb-4 max-w-2xl">
      <p class="font-display font-semibold text-red-900">There was a problem</p>
      <p class="text-sm text-red-900 mt-1">{form.error}</p>
    </div>
  {/if}

  <div class="bg-amber-50 border-l-4 border-amber-500 p-4 rounded mb-6 max-w-2xl">
    <p class="font-display font-semibold text-amber-900 text-sm">Capstone projects must address all four NYSED essential elements:</p>
    <ol class="text-sm text-amber-900 mt-2 list-decimal list-inside space-y-1">
      <li>Identify a civic issue.</li>
      <li>Apply civic knowledge, skills, actions, and mindsets.</li>
      <li>Engage in a civic experience that influences positive change.</li>
      <li>Present the project to the SCRC committee.</li>
    </ol>
    <p class="text-xs text-amber-900 mt-2">Address each element explicitly in the civic-experience plan below.</p>
  </div>

  <form method="POST" class="space-y-5 max-w-2xl">
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
        <label class="block col-span-2">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Your email <span class="text-secondary normal-case">(optional — get a personal progress report after each submission)</span></span>
          <input name="studentEmail" type="email" class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="you@example.com or your school email" />
        </label>
      </div>
    </fieldset>

    <fieldset class="border border-border rounded-lg p-5">
      <legend class="px-2 text-xs uppercase tracking-widest font-display font-semibold text-primary">Element 1 — Civic issue</legend>
      <div class="space-y-4">
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">The civic issue you've identified</span>
          <textarea name="issueIdentified" rows="4" minlength="30" maxlength="2000" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Describe the civic issue, its civic significance, and why it matters now."></textarea>
          <span class="text-xs text-muted mt-1 block">Minimum 30 characters. Capstones address an issue with depth and stakes — be specific.</span>
        </label>
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Scope</span>
          <select name="scope" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary bg-white">
            <option value="local">Local — Great Neck, Town of North Hempstead, Nassau County</option>
            <option value="state">State — New York</option>
            <option value="national">National — United States</option>
            <option value="global">Global / international</option>
          </select>
        </label>
      </div>
    </fieldset>

    <fieldset class="border border-border rounded-lg p-5">
      <legend class="px-2 text-xs uppercase tracking-widest font-display font-semibold text-primary">Elements 2–4 — Civic-experience plan</legend>
      <label class="block">
        <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">How will you apply civic knowledge / skills / actions / mindsets · engage in a civic experience to influence positive change · present to the SCRC?</span>
        <textarea name="civicExperiencePlan" rows="10" minlength="30" maxlength="3000" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Cover all three remaining elements explicitly:&#10;&#10;Element 2 — Apply civic knowledge, skills, actions, and mindsets: ...&#10;&#10;Element 3 — Engage in a civic experience to influence positive change: ...&#10;&#10;Element 4 — Present the project to the SCRC: ..."></textarea>
        <span class="text-xs text-muted mt-1 block">Minimum 30 characters. The SCRC will look for explicit treatment of all three remaining essential elements.</span>
      </label>
    </fieldset>

    <fieldset class="border border-border rounded-lg p-5">
      <legend class="px-2 text-xs uppercase tracking-widest font-display font-semibold text-primary">Civic-readiness domains</legend>
      <p class="text-xs text-muted mb-3">Capstones generally engage all four domains. Check every one this project will demonstrate (at least one required).</p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label class="flex items-start gap-3 border border-border rounded p-3 hover:border-primary cursor-pointer">
          <input type="checkbox" name="domains" value="knowledge" class="mt-1" />
          <span>
            <span class="block font-display font-semibold text-primary text-sm">Civic Knowledge</span>
            <span class="block text-xs text-muted mt-0.5">Government structure · constitutional principles · history of civic issues</span>
          </span>
        </label>
        <label class="flex items-start gap-3 border border-border rounded p-3 hover:border-primary cursor-pointer">
          <input type="checkbox" name="domains" value="skills" class="mt-1" />
          <span>
            <span class="block font-display font-semibold text-primary text-sm">Civic Skills</span>
            <span class="block text-xs text-muted mt-0.5">Source analysis · evidence-based argument · deliberation · communication</span>
          </span>
        </label>
        <label class="flex items-start gap-3 border border-border rounded p-3 hover:border-primary cursor-pointer">
          <input type="checkbox" name="domains" value="mindsets" class="mt-1" />
          <span>
            <span class="block font-display font-semibold text-primary text-sm">Civic Mindsets</span>
            <span class="block text-xs text-muted mt-0.5">Civic identity · responsibility · empathy · respect for diverse perspectives</span>
          </span>
        </label>
        <label class="flex items-start gap-3 border border-border rounded p-3 hover:border-primary cursor-pointer">
          <input type="checkbox" name="domains" value="experiences" class="mt-1" />
          <span>
            <span class="block font-display font-semibold text-primary text-sm">Civic Experiences</span>
            <span class="block text-xs text-muted mt-0.5">Direct action · service · community engagement · demonstrated impact</span>
          </span>
        </label>
      </div>
    </fieldset>

    <fieldset class="border border-border rounded-lg p-5">
      <legend class="px-2 text-xs uppercase tracking-widest font-display font-semibold text-primary">Advisor</legend>
      <label class="block">
        <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Faculty advisor</span>
        <input name="advisorName" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Ms. T. Maue" />
        <span class="text-xs text-muted mt-1 block">A GNPS teacher who will mentor this capstone through proposal, work, and presentation.</span>
      </label>
    </fieldset>

    <button class="bg-secondary text-white px-7 py-3 rounded font-display font-semibold uppercase tracking-wide text-sm hover:opacity-90 transition">Submit capstone topic for SCRC review</button>
    <p class="text-xs text-muted mt-2">Status moves to <em>proposed</em>. SCRC reviews capstone proposals at the next committee meeting. Do not begin work until the topic is <em>approved</em>.</p>
  </form>
{/if}
