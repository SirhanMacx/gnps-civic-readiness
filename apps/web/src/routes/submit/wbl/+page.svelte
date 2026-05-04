<script lang="ts">
  import type { ActionData } from './$types';
  export let form: ActionData;
</script>

<svelte:head><title>WBL / Extra-curricular Hours — GNPS Civic Readiness</title></svelte:head>

<a href="/submit" class="text-sm text-primary hover:underline">← All pathways</a>
<h1 class="font-display text-3xl text-primary mt-2 mb-1">Extra-curricular / Work-Based Learning Hours</h1>
<p class="text-sm text-muted mb-6">Pathway 2e · 40+ hours required for 0.5 point · application-of-knowledge essay required at threshold</p>

{#if form?.success}
  <div class="bg-green-50 border-l-4 border-green-600 p-5 rounded mb-6 max-w-2xl">
    <p class="font-display font-semibold text-green-900 text-lg mb-1">Hours submitted</p>
    <p class="text-sm text-green-900">We've emailed <strong>{form.supervisorEmail}</strong> a confirmation link. Once they confirm, your <strong>{form.hours}</strong> hour(s) count toward the 40-hour Pathway 2e threshold.</p>
    <p class="text-sm text-green-900 mt-2">When you reach 40 hours, you'll add a short application-of-knowledge essay before the 0.5 point is awarded.</p>
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
      <legend class="px-2 text-xs uppercase tracking-widest font-display font-semibold text-primary">Activity</legend>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label class="block">
            <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Activity / role</span>
            <input name="activityName" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Model UN secretariat · Robotics build team · Summer internship" />
          </label>
          <label class="block">
            <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Organization</span>
            <input name="organization" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="GNS · Stony Brook ASE Lab · Town of North Hempstead" />
          </label>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <label class="block">
            <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Date — start</span>
            <input name="dateStart" type="date" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" />
          </label>
          <label class="block">
            <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Date — end</span>
            <input name="dateEnd" type="date" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" />
          </label>
          <label class="block col-span-2">
            <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Hours this submission</span>
            <input name="hours" type="number" step="0.5" min="0.5" max="500" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="6" />
            <span class="text-xs text-muted mt-1 block">Submit individual blocks of hours over time. The 40-hour threshold for Pathway 2e accumulates across all confirmed submissions.</span>
          </label>
        </div>
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Description (1–2 short paragraphs)</span>
          <textarea name="description" rows="5" minlength="20" maxlength="1500" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Describe what you did, the responsibilities you held, and what civic-readiness skills, knowledge, or mindsets you developed."></textarea>
        </label>
      </div>
    </fieldset>

    <fieldset class="border border-border rounded-lg p-5">
      <legend class="px-2 text-xs uppercase tracking-widest font-display font-semibold text-primary">Supervisor</legend>
      <p class="text-xs text-muted mb-3">We'll email your supervisor a one-click confirmation link. They confirm the hours; the link expires in 14 days. No account needed for them.</p>
      <div class="space-y-3">
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Supervisor name</span>
          <input name="supervisorName" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Coach R. Rivera" />
        </label>
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Supervisor email</span>
          <input name="supervisorEmail" type="email" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="rrivera@greatneck.k12.ny.us" />
        </label>
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Supervisor's organization (optional)</span>
          <input name="supervisorOrg" class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="GNS Athletics · Town clerk's office" />
        </label>
      </div>
    </fieldset>

    <button class="bg-secondary text-white px-7 py-3 rounded font-display font-semibold uppercase tracking-wide text-sm hover:opacity-90 transition">Submit hours</button>
    <p class="text-xs text-muted mt-2">By submitting, you confirm this information is accurate. Falsifying evidence forfeits the Seal.</p>
  </form>
{/if}
