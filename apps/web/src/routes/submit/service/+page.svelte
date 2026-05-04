<script lang="ts">
  import type { ActionData } from './$types';
  export let form: ActionData;
</script>

<svelte:head><title>Service-Learning Hours — GNPS Civic Readiness</title></svelte:head>

<a href="/submit" class="text-sm text-primary hover:underline">← All pathways</a>
<h1 class="font-display text-3xl text-primary mt-2 mb-1">Service-Learning Hours</h1>
<p class="text-sm text-muted mb-6">Pathway 2b · 1 point per 25 hours · 5-stage process · reflection required to earn the point</p>

{#if form?.success}
  <div class="bg-green-50 border-l-4 border-green-600 p-5 rounded mb-6 max-w-2xl">
    <p class="font-display font-semibold text-green-900 text-lg mb-1">Hours submitted</p>
    <p class="text-sm text-green-900">We've emailed <strong>{form.supervisorEmail}</strong> a confirmation link. Once they click confirm, your hours count toward the 25-hour threshold.</p>
    <p class="text-sm text-green-900 mt-2">You'll add a reflection essay once you reach 25 hours total.</p>
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
      </div>
    </fieldset>

    <fieldset class="border border-border rounded-lg p-5">
      <legend class="px-2 text-xs uppercase tracking-widest font-display font-semibold text-primary">Service activity</legend>
      <div class="space-y-4">
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Activity / organization</span>
          <input name="activityName" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Long Island Cares — food bank" />
        </label>
        <div class="grid grid-cols-2 gap-4">
          <label class="block">
            <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Date — start</span>
            <input name="dateStart" type="date" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" />
          </label>
          <label class="block">
            <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Date — end</span>
            <input name="dateEnd" type="date" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" />
          </label>
          <label class="block">
            <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Hours this submission</span>
            <input name="hours" type="number" step="0.5" min="0.5" max="200" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="8" />
          </label>
          <label class="block">
            <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Service type (NYSED-defined)</span>
            <select name="serviceType" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary bg-white">
              <option value="direct">Direct — face-to-face with people you serve</option>
              <option value="indirect">Indirect — meets a need without direct contact</option>
              <option value="advocacy">Advocacy — educating others about an issue</option>
            </select>
          </label>
        </div>
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Brief description (1–3 sentences)</span>
          <textarea name="description" rows="2" maxlength="500" class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Sorted donations, restocked shelves, staffed mobile pantry distribution at Westbury location…"></textarea>
        </label>
      </div>
    </fieldset>

    <fieldset class="border border-border rounded-lg p-5">
      <legend class="px-2 text-xs uppercase tracking-widest font-display font-semibold text-primary">Supervisor</legend>
      <p class="text-xs text-muted mb-3">We'll email your supervisor a one-click confirmation link. They confirm the hours; the link expires in 14 days. No account needed for them.</p>
      <div class="space-y-3">
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Supervisor name</span>
          <input name="supervisorName" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="J. Patel" />
        </label>
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Supervisor email</span>
          <input name="supervisorEmail" type="email" required class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="jpatel@licares.org" />
        </label>
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary">Supervisor's organization (optional)</span>
          <input name="supervisorOrg" class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="Long Island Cares Inc." />
        </label>
      </div>
    </fieldset>

    <button class="bg-secondary text-white px-7 py-3 rounded font-display font-semibold uppercase tracking-wide text-sm hover:opacity-90 transition">Submit hours</button>
    <p class="text-xs text-muted mt-2">By submitting, you confirm this information is accurate. Falsifying evidence forfeits the Seal.</p>
  </form>
{/if}
