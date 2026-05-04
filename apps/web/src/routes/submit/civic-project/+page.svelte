<script lang="ts">
  import type { ActionData } from './$types';
  export let form: ActionData;
</script>

<svelte:head><title>High School Civic Project — GNPS Civic Readiness</title></svelte:head>

<a href="/submit" class="text-sm text-primary hover:underline">← All pathways</a>
<h1 class="font-display text-3xl text-primary mt-2 mb-1">High School Civic Project</h1>
<p class="text-sm text-muted mb-6">Pathway 2a · 1.5 pt · max 2 instances · SCRC pre-approves topic before you do the work</p>

{#if form?.success}
  <div class="bg-green-50 border-l-4 border-green-600 p-5 rounded mb-6 max-w-2xl">
    <p class="font-display font-semibold text-green-900 text-lg mb-1">Topic proposal submitted — awaiting SCRC committee review</p>
    <p class="text-sm text-green-900">Submission #{form.submissionId} is now in the SCRC queue. You'll get an email once a committee member approves the topic. <strong>Do not begin the project until the topic is approved.</strong></p>
    <a href="/submit" class="inline-block mt-3 text-sm text-green-900 underline">Submit more evidence →</a>
  </div>
{:else}
  {#if form?.error}
    <div class="bg-red-50 border-l-4 border-red-600 p-4 rounded mb-4 max-w-2xl">
      <p class="font-display font-semibold text-red-900">There was a problem</p>
      <p class="text-sm text-red-900 mt-1">{form.error}</p>
    </div>
  {/if}

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
      <legend class="px-2 text-xs uppercase tracking-widest font-display font-semibold text-primary">Topic</legend>
      <div class="space-y-4">
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Civic issue you've identified</span>
          <textarea name="issueIdentified" rows="3" minlength="30" maxlength="2000" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="What community problem, policy gap, or civic question are you addressing? Why does it matter?"></textarea>
          <span class="text-xs text-muted mt-1 block">Minimum 30 characters. Be specific — vague topics get sent back for revision.</span>
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
      <legend class="px-2 text-xs uppercase tracking-widest font-display font-semibold text-primary">Civic-experience plan</legend>
      <label class="block">
        <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">How will you take action and influence positive change?</span>
        <textarea name="civicExperiencePlan" rows="6" minlength="30" maxlength="3000" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Describe the civic experience: who you'll engage with, what you'll create or do, how you'll measure impact, and how you'll present results to the SCRC."></textarea>
        <span class="text-xs text-muted mt-1 block">Minimum 30 characters. Should map to NYSED civic-readiness essential elements.</span>
      </label>
    </fieldset>

    <fieldset class="border border-border rounded-lg p-5">
      <legend class="px-2 text-xs uppercase tracking-widest font-display font-semibold text-primary">Civic-readiness domains</legend>
      <p class="text-xs text-muted mb-3">Select every NYSED civic-readiness domain this project will demonstrate (at least one required).</p>
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
        <span class="text-xs text-muted mt-1 block">A GNPS teacher or counselor who has agreed to mentor you through this project.</span>
      </label>
    </fieldset>

    <button class="bg-secondary text-white px-7 py-3 rounded font-display font-semibold uppercase tracking-wide text-sm hover:opacity-90 transition">Submit topic for SCRC review</button>
    <p class="text-xs text-muted mt-2">Status moves to <em>proposed</em>. The SCRC committee will review at its next meeting. Do not begin work until the topic is <em>approved</em>.</p>
  </form>
{/if}
