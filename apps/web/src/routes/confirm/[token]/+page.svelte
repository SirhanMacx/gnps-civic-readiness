<script lang="ts">
  import type { PageData, ActionData } from './$types';
  export let data: PageData;
  export let form: ActionData;

  $: showSuccess = form?.confirmed === true;
  $: showDisputeAck = form?.disputed === true;
</script>

<svelte:head>
  <title>Confirm hours — GNPS Civic Readiness</title>
</svelte:head>

<div class="max-w-2xl">
  {#if data.invalid}
    <h1 class="font-display text-3xl text-primary mb-3">Link expired or invalid</h1>
    <p class="font-serif text-base leading-relaxed text-ink mb-4">
      This confirmation link could not be verified. Confirmation links expire 14 days after they're sent, and they
      stop working once the hours have been confirmed or disputed.
    </p>
    <p class="text-sm text-muted">
      If you believe this is an error, please email
      <a href="mailto:civicseal@greatneck.k12.ny.us" class="text-primary hover:underline">civicseal@greatneck.k12.ny.us</a>
      and a counselor will follow up.
    </p>
  {:else if showSuccess}
    <div class="bg-green-50 border-l-4 border-green-600 p-5 rounded mb-4">
      <h1 class="font-display text-2xl text-green-900 mb-2">Hours confirmed</h1>
      <p class="font-serif text-green-900">
        Thank you. The {data.hours} hours have been recorded toward
        <strong>{data.studentName}</strong>'s Seal of Civic Readiness.
      </p>
    </div>
    <p class="text-sm text-muted">You can close this tab.</p>
  {:else if showDisputeAck}
    <div class="bg-amber-50 border-l-4 border-amber-600 p-5 rounded mb-4">
      <h1 class="font-display text-2xl text-amber-900 mb-2">Correction recorded</h1>
      <p class="font-serif text-amber-900">
        Thank you. A school counselor will review this with the student and follow up if needed. No further action is
        required from you.
      </p>
    </div>
  {:else if data.alreadyConfirmed}
    <h1 class="font-display text-3xl text-primary mb-3">Already confirmed</h1>
    <p class="font-serif text-base leading-relaxed text-ink mb-4">
      These hours were already confirmed. Thank you — no further action is needed.
    </p>
  {:else if data.alreadyDisputed}
    <h1 class="font-display text-3xl text-primary mb-3">Correction already submitted</h1>
    <p class="font-serif text-base leading-relaxed text-ink mb-4">
      A correction has already been recorded for this submission. A school counselor will reach out if more
      information is needed.
    </p>
  {:else}
    <h1 class="font-display text-3xl text-primary mb-2">
      Please confirm {data.hours} hours
    </h1>
    <p class="text-sm text-muted mb-6">For {data.studentName}'s Seal of Civic Readiness portfolio</p>

    <div class="border border-border rounded-lg p-5 mb-6 bg-surface">
      <dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt class="text-xs uppercase tracking-wider font-display font-medium text-primary">Student</dt>
        <dd class="font-serif">{data.studentName}</dd>
        <dt class="text-xs uppercase tracking-wider font-display font-medium text-primary">Hours</dt>
        <dd class="font-serif">{data.hours}</dd>
        <dt class="text-xs uppercase tracking-wider font-display font-medium text-primary">Activity</dt>
        <dd class="font-serif">{data.organization}</dd>
        <dt class="text-xs uppercase tracking-wider font-display font-medium text-primary">Dates</dt>
        <dd class="font-serif">{data.dateRange}</dd>
      </dl>
    </div>

    <p class="font-serif text-base leading-relaxed text-ink mb-5">
      Hi {data.supervisorName ?? 'there'} — by clicking <strong>Confirm</strong> below, you're confirming that the
      student logged this time supervising under you. Confirmation takes about five seconds and helps the student
      earn the New York State Seal of Civic Readiness.
    </p>

    <form method="POST" action="?/confirm" class="inline">
      <button
        class="bg-secondary text-white px-7 py-3 rounded font-display font-semibold uppercase tracking-wide text-sm hover:opacity-90 transition"
      >
        Confirm {data.hours} hours
      </button>
    </form>

    <details class="mt-8 max-w-lg">
      <summary class="text-sm text-primary cursor-pointer hover:underline font-display font-medium">
        Hours don't match? Tell us
      </summary>
      <form method="POST" action="?/dispute" class="mt-3 space-y-3">
        <label class="block">
          <span class="text-xs uppercase tracking-wider font-display font-medium text-primary"
            >What's the correct information?</span
          >
          <textarea
            name="reason"
            rows="3"
            required
            minlength="3"
            maxlength="1000"
            class="w-full mt-1 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="e.g. Maya worked 6 hours, not 8 — only April 15 and April 22 (3 hrs each)"
          ></textarea>
        </label>
        <button
          class="border border-primary text-primary px-5 py-2 rounded font-display font-semibold uppercase tracking-wide text-sm hover:bg-primary hover:text-white transition"
        >
          Submit correction
        </button>
        {#if form?.disputed === false}
          <p class="text-sm text-red-700">
            Please tell us a few words about the discrepancy so the counselor can review.
          </p>
        {/if}
      </form>
    </details>

    <p class="text-xs text-muted mt-10">
      This link expires 14 days after it was sent. If you didn't supervise this student, you can ignore this email.
      Questions: <a href="mailto:civicseal@greatneck.k12.ny.us" class="text-primary hover:underline"
        >civicseal@greatneck.k12.ny.us</a
      >.
    </p>
  {/if}
</div>
