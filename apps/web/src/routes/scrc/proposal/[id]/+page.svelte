<script lang="ts">
  import type { PageData, ActionData } from './$types.js';
  export let data: PageData;
  export let form: ActionData;

  $: submission = data.submission;
  $: rubric = data.rubric;
  $: evidence = data.evidence;

  const PATHWAY_LABEL: Record<string, string> = {
    research_project: 'Research Project (1e)',
    hs_civic_project: 'HS Civic Project (2a)',
    hs_capstone: 'HS Capstone (2f)',
    ms_capstone: 'MS Capstone'
  };

  const STATUS_LABEL: Record<string, string> = {
    proposed: 'Pending topic review',
    topic_approved: 'Topic approved · in progress',
    in_progress: 'In progress',
    submitted: 'Awaiting final scoring',
    scored: 'Scored',
    awarded: 'Awarded',
    rejected: 'Rejected',
    revoked: 'Revoked'
  };

  function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
</script>

<svelte:head>
  <title>Review {submission.studentFullName} · SCRC</title>
</svelte:head>

<section class="py-8 max-w-4xl">
  <a href="/scrc" class="text-xs uppercase tracking-widest text-secondary font-display font-semibold mb-2 inline-block hover:underline">
    ← Back to queue
  </a>
  <h1 class="font-display text-3xl font-bold text-primary mt-1 mb-1">
    {submission.studentFullName}
  </h1>
  <p class="text-sm text-muted mb-2">
    Student #{submission.studentId} · class of {submission.gradYear} ·
    <span class="font-semibold text-ink">{PATHWAY_LABEL[submission.pathwayType] ?? submission.pathwayType}</span>
  </p>
  <p class="text-xs uppercase tracking-wider text-secondary font-display font-semibold mb-6">
    {STATUS_LABEL[submission.status] ?? submission.status}
  </p>

  {#if form?.error}
    <div class="border-l-4 border-red-500 bg-red-50 px-4 py-3 mb-4 rounded">
      <p class="text-sm text-red-800 font-semibold">{form.error}</p>
    </div>
  {/if}

  <!-- Proposal data — always shown (this is the input to both topic review and final scoring) -->
  <div class="border border-border rounded-lg bg-surface px-6 py-5 mb-6">
    <h2 class="font-display text-xl font-bold text-primary mb-3">Proposal</h2>
    <dl class="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
      <div class="sm:col-span-3">
        <dt class="text-xs uppercase tracking-wider text-muted font-semibold">Issue identified</dt>
        <dd class="mt-1 text-ink whitespace-pre-wrap">{submission.issueIdentified ?? '—'}</dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wider text-muted font-semibold">Scope</dt>
        <dd class="mt-1 text-ink capitalize">{submission.scope ?? '—'}</dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wider text-muted font-semibold">Advisor</dt>
        <dd class="mt-1 text-ink">{submission.advisorName ?? '—'}</dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wider text-muted font-semibold">Domain tags</dt>
        <dd class="mt-1 text-ink capitalize">
          {#if submission.domainTags.length > 0}{submission.domainTags.join(', ')}{:else}—{/if}
        </dd>
      </div>
      <div class="sm:col-span-3">
        <dt class="text-xs uppercase tracking-wider text-muted font-semibold">Civic-experience plan</dt>
        <dd class="mt-1 text-ink whitespace-pre-wrap">
          {(submission.proposalData.civic_experience_plan as string | undefined) ?? '—'}
        </dd>
      </div>
      <div>
        <dt class="text-xs uppercase tracking-wider text-muted font-semibold">Proposed</dt>
        <dd class="mt-1 text-ink">{fmtDate(submission.proposedAt)}</dd>
      </div>
      {#if submission.topicApprovedAt}
        <div>
          <dt class="text-xs uppercase tracking-wider text-muted font-semibold">Topic approved</dt>
          <dd class="mt-1 text-ink">{fmtDate(submission.topicApprovedAt)}</dd>
        </div>
      {/if}
      {#if submission.submittedAt}
        <div>
          <dt class="text-xs uppercase tracking-wider text-muted font-semibold">Final submission</dt>
          <dd class="mt-1 text-ink">{fmtDate(submission.submittedAt)}</dd>
        </div>
      {/if}
    </dl>
    {#if submission.notes}
      <div class="mt-4 border-t border-border pt-3">
        <dt class="text-xs uppercase tracking-wider text-muted font-semibold">Latest committee note</dt>
        <dd class="mt-1 text-ink text-sm whitespace-pre-wrap">{submission.notes}</dd>
      </div>
    {/if}
  </div>

  {#if submission.status === 'proposed'}
    <!-- Topic review interface -->
    <div class="border border-border rounded-lg bg-white px-6 py-5 mb-6">
      <h2 class="font-display text-xl font-bold text-primary mb-1">Topic review</h2>
      <p class="text-sm text-muted mb-4">
        Per <span class="font-semibold">{rubric.appendix}</span>, verify the proposal addresses each
        essential element before approving. Approving moves the student to <em>in progress</em>;
        the rubric below is used after they submit completed evidence.
      </p>

      <ul class="text-sm text-ink space-y-2 mb-5 pl-5 list-disc">
        {#each rubric.criteria as c}
          <li>
            <span class="font-semibold text-primary">{c.label}</span>
            <span class="text-muted"> — {c.description}</span>
          </li>
        {/each}
      </ul>

      <form method="POST" action="?/approve" class="mb-3 border-t border-border pt-4">
        <label class="block text-xs uppercase tracking-wider text-muted font-semibold mb-1" for="approve-notes">
          Optional comment to the student / counselor
        </label>
        <textarea
          id="approve-notes"
          name="notes"
          rows="2"
          class="w-full rounded-md border-border focus:border-secondary focus:ring-secondary text-sm"
          placeholder="(optional)"
        ></textarea>
        <button
          type="submit"
          class="mt-2 inline-flex items-center justify-center px-5 py-2 rounded-md bg-primary text-white font-display font-semibold text-sm hover:bg-primary-dark"
        >
          Approve topic
        </button>
      </form>

      <details class="mt-4 border-t border-border pt-4">
        <summary class="cursor-pointer font-display font-semibold text-primary text-sm">
          Request revisions
        </summary>
        <form method="POST" action="?/request_revisions" class="mt-3">
          <label class="block text-xs uppercase tracking-wider text-muted font-semibold mb-1" for="rev-notes">
            What does the student need to revise?
          </label>
          <textarea
            id="rev-notes"
            name="notes"
            rows="3"
            required
            minlength="5"
            class="w-full rounded-md border-border focus:border-secondary focus:ring-secondary text-sm"
          ></textarea>
          <button
            type="submit"
            class="mt-2 inline-flex items-center justify-center px-5 py-2 rounded-md border border-secondary text-secondary font-display font-semibold text-sm hover:bg-secondary hover:text-white"
          >
            Send revision request
          </button>
        </form>
      </details>

      <details class="mt-4 border-t border-border pt-4">
        <summary class="cursor-pointer font-display font-semibold text-red-700 text-sm">
          Reject topic
        </summary>
        <form method="POST" action="?/reject" class="mt-3">
          <label class="block text-xs uppercase tracking-wider text-muted font-semibold mb-1" for="rej-reason">
            Reason for rejection (sent to student)
          </label>
          <textarea
            id="rej-reason"
            name="reason"
            rows="3"
            required
            minlength="5"
            class="w-full rounded-md border-border focus:border-red-500 focus:ring-red-500 text-sm"
          ></textarea>
          <button
            type="submit"
            class="mt-2 inline-flex items-center justify-center px-5 py-2 rounded-md bg-red-600 text-white font-display font-semibold text-sm hover:bg-red-700"
          >
            Reject topic
          </button>
        </form>
      </details>
    </div>
  {:else if submission.status === 'submitted'}
    <!-- Final scoring interface -->
    <div class="border border-border rounded-lg bg-white px-6 py-5 mb-6">
      <h2 class="font-display text-xl font-bold text-primary mb-1">
        Score against {rubric.appendix}
      </h2>
      <p class="text-sm text-muted mb-4">
        Score each criterion from 1 (emerging) to {rubric.scaleMax} (exemplary). Maximum NYSED award
        for this pathway is <span class="font-semibold text-primary">{rubric.maxPoints} pt{rubric.maxPoints === 1 ? '' : 's'}</span>;
        actual award scales proportionally with your scores.
      </p>

      {#if evidence.length > 0}
        <div class="mb-5 border-l-4 border-primary bg-surface px-4 py-3 rounded-r">
          <p class="text-xs uppercase tracking-wider text-muted font-semibold mb-1">Evidence files</p>
          <ul class="text-sm space-y-1">
            {#each evidence as f}
              <li>
                {#if f.signedUrl}
                  <a href={f.signedUrl} target="_blank" rel="noopener" class="text-primary underline hover:text-primary-dark">
                    {f.filename}
                  </a>
                {:else}
                  <span class="text-muted">{f.filename}</span>
                  {#if f.warning}
                    <span class="text-xs text-red-700"> · {f.warning}</span>
                  {/if}
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      {:else}
        <div class="mb-5 border-l-4 border-amber-400 bg-amber-50 px-4 py-3 rounded-r text-sm text-amber-900">
          No evidence files attached. The student may have linked work elsewhere — confirm with
          the counselor before scoring.
        </div>
      {/if}

      <form method="POST" action="?/score">
        <div class="grid grid-cols-1 gap-4 mb-4">
          {#each rubric.criteria as c}
            <fieldset class="border border-border rounded-md px-4 py-3">
              <legend class="font-display font-semibold text-primary px-1 text-sm">
                {c.label}
              </legend>
              <p class="text-xs text-muted mb-2">{c.description}</p>
              <div class="flex flex-wrap gap-3">
                {#each Array.from({ length: rubric.scaleMax }, (_, i) => i + 1) as n}
                  <label class="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="score__{c.key}"
                      value={n}
                      required
                      class="text-secondary focus:ring-secondary"
                    />
                    <span class="text-sm">{n}</span>
                  </label>
                {/each}
              </div>
            </fieldset>
          {/each}
        </div>

        <label class="block text-xs uppercase tracking-wider text-muted font-semibold mb-1" for="score-notes">
          Reviewer comment
        </label>
        <textarea
          id="score-notes"
          name="notes"
          rows="3"
          class="w-full rounded-md border-border focus:border-secondary focus:ring-secondary text-sm"
          placeholder="Optional: highlights, things student should iterate on for future work."
        ></textarea>

        <button
          type="submit"
          class="mt-3 inline-flex items-center justify-center px-5 py-2 rounded-md bg-secondary text-white font-display font-semibold text-sm hover:opacity-90"
        >
          Submit score
        </button>
      </form>
    </div>
  {:else if submission.status === 'scored' || submission.status === 'awarded'}
    <!-- Read-only completed view -->
    <div class="border border-border rounded-lg bg-white px-6 py-5 mb-6">
      <h2 class="font-display text-xl font-bold text-primary mb-1">Score on file</h2>
      <p class="text-sm text-muted mb-4">
        Scored {fmtDate(submission.scoredAt)} ·
        <span class="font-semibold text-primary">
          {submission.pointsAwarded ?? 0} / {rubric.maxPoints} pts
        </span>
      </p>
      <ul class="text-sm space-y-1 pl-5 list-disc">
        {#each rubric.criteria as c}
          <li>
            <span class="font-semibold text-ink">{c.label}:</span>
            <span class="text-primary">{submission.rubricScores[c.key] ?? '—'} / {rubric.scaleMax}</span>
          </li>
        {/each}
      </ul>
    </div>
  {:else}
    <div class="border border-border rounded-lg bg-surface px-6 py-5">
      <p class="text-sm text-muted">
        This submission is currently <span class="font-semibold text-ink">{STATUS_LABEL[submission.status] ?? submission.status}</span>.
        No SCRC action is needed at this stage.
      </p>
    </div>
  {/if}
</section>
