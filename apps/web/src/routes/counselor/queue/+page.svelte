<script lang="ts">
  import type { PageData, ActionData } from './$types.js';
  import type { ApprovalQueueItem } from '$server/approvals.js';

  export let data: PageData;
  export let form: ActionData;

  // Track which item's reflection is expanded ("show more")
  let reflectionExpanded: Record<number, boolean> = {};
  // Track which item's "Request revision" or "Decline" form is open
  let openAction: Record<number, 'approve' | 'revise' | 'decline' | null> = {};

  function toggleReflection(id: number) {
    reflectionExpanded = { ...reflectionExpanded, [id]: !reflectionExpanded[id] };
  }
  function setOpen(id: number, kind: 'approve' | 'revise' | 'decline' | null) {
    openAction = { ...openAction, [id]: kind };
  }

  function fmtDate(s: string | null): string {
    if (!s) return ' · ';
    try {
      return new Date(s).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return s;
    }
  }

  function pathwayLabel(p: string): string {
    return p.replace(/_/g, ' ');
  }

  function statusPill(status: string): { cls: string; label: string } {
    if (status === 'scored') {
      return {
        cls: 'bg-blue-50 text-blue-900 border-blue-200',
        label: 'SCRC scored · awaiting your confirm',
      };
    }
    return {
      cls: 'bg-yellow-50 text-yellow-900 border-yellow-200',
      label: 'Submitted',
    };
  }

  // Cast form once to a permissive shape · SvelteKit's generated ActionData
  // union narrows aggressively across the three actions; we just want to
  // surface the optional success/error/action fields.
  type FormShape = {
    submissionId?: number;
    success?: boolean;
    error?: string;
    action?: 'approve' | 'revise' | 'decline';
  };

  function feedbackFor(item: ApprovalQueueItem): {
    kind: 'success' | 'error';
    msg: string;
  } | null {
    const f = form as FormShape | null;
    if (!f) return null;
    if (f.submissionId !== item.submissionId) return null;
    if (f.success) {
      if (f.action === 'approve') return { kind: 'success', msg: 'Approved · awarded' };
      if (f.action === 'revise') return { kind: 'success', msg: 'Sent back for revision' };
      if (f.action === 'decline') return { kind: 'success', msg: 'Declined' };
    }
    if (f.error) {
      return { kind: 'error', msg: String(f.error) };
    }
    return null;
  }
</script>

<svelte:head>
  <title>Approval Queue · GNPS Civic Readiness Portal</title>
</svelte:head>

<section class="py-4 mb-4">
  <a href="/counselor" class="text-sm text-primary hover:underline">← Back to roster</a>
  <p class="text-xs uppercase tracking-widest text-secondary font-display font-semibold mt-2 mb-1">
    Counselor Workspace
  </p>
  <h1 class="font-display text-3xl font-bold text-primary">Approval queue</h1>
  <p class="text-sm text-muted mt-1">
    {data.items.length} item{data.items.length === 1 ? '' : 's'} awaiting review.
    Confirm point awards on submitted reflections and SCRC-scored projects.
  </p>
</section>

{#if data.items.length === 0}
  <div class="border border-border rounded-lg bg-surface px-6 py-12 text-center">
    <p class="font-display font-semibold text-lg text-primary mb-1">Queue is clear</p>
    <p class="text-sm text-muted">
      No submissions are currently awaiting your review.
    </p>
  </div>
{:else}
  <ul class="space-y-4">
    {#each data.items as item (item.submissionId)}
      {@const pill = statusPill(item.status)}
      {@const fb = feedbackFor(item)}
      <li class="border border-border rounded-lg bg-white overflow-hidden">
        <header class="px-5 py-4 border-b border-border bg-surface flex flex-wrap items-start justify-between gap-3">
          <div>
            <a
              href={`/counselor/student/${item.studentId}`}
              class="font-display font-bold text-lg text-primary hover:underline"
            >
              {item.studentLastName}, {item.studentFirstName}
            </a>
            <p class="text-xs text-muted font-mono mt-0.5">
              {item.studentId} · Class of {item.gradYear}
            </p>
          </div>
          <div class="flex flex-col items-end gap-1">
            <span class={`text-[10px] uppercase tracking-widest font-display font-semibold px-2 py-1 rounded border ${pill.cls}`}>
              {pill.label}
            </span>
            <span class="text-xs text-muted">
              {item.submittedAt
                ? `Submitted ${fmtDate(item.submittedAt)}`
                : item.scoredAt
                ? `Scored ${fmtDate(item.scoredAt)}`
                : ''}
            </span>
          </div>
        </header>

        <div class="px-5 py-4 space-y-3">
          <p class="text-sm text-ink">
            <span class="font-display font-semibold text-primary capitalize">
              {pathwayLabel(item.pathwayType)}
            </span>
            <span class="text-muted"> · </span>
            <span class="text-ink">{item.claim}</span>
          </p>

          {#if item.hoursTotal !== null}
            <div class="text-sm">
              <span class="font-display font-semibold text-primary">Supervisor confirmation:</span>
              {#if item.hoursConfirmed}
                <span class="text-green-900">
                  All {item.hoursTotal} hrs confirmed
                </span>
              {:else}
                <span class="text-yellow-900">Some hours still pending supervisor confirmation</span>
              {/if}
            </div>
          {/if}

          {#if item.domainTags.length > 0}
            <div class="flex flex-wrap gap-1.5">
              {#each item.domainTags as t}
                <span class="text-[10px] uppercase tracking-widest font-display font-medium px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  {t}
                </span>
              {/each}
            </div>
          {/if}

          {#if item.reflectionExcerpt}
            <div class="border-l-4 border-secondary pl-4 py-1 bg-secondary/5 rounded-r">
              <p class="text-xs uppercase tracking-widest font-display font-semibold text-secondary mb-1">
                Reflection
              </p>
              <p class="text-sm text-ink whitespace-pre-line">
                {reflectionExpanded[item.submissionId] || !item.reflectionTruncated
                  ? item.reflectionExcerpt
                  : item.reflectionExcerpt}
                {#if item.reflectionTruncated && !reflectionExpanded[item.submissionId]}
                  <span class="text-muted">…</span>
                {/if}
              </p>
              {#if item.reflectionTruncated}
                <button
                  type="button"
                  on:click={() => toggleReflection(item.submissionId)}
                  class="text-xs text-primary hover:underline mt-1"
                >
                  {reflectionExpanded[item.submissionId] ? 'Show less' : 'Show more'}
                </button>
              {/if}
            </div>
          {/if}

          {#if item.evidenceFiles.length > 0}
            <div>
              <p class="text-xs uppercase tracking-widest font-display font-semibold text-primary mb-1">
                Evidence files
              </p>
              <ul class="text-sm space-y-1">
                {#each item.evidenceFiles as f}
                  <li class="text-ink">
                    · <span class="font-mono text-xs">{f.filename}</span>
                    <span class="text-xs text-muted">({f.kind.replace(/_/g, ' ')})</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if fb}
            <div
              class={`px-3 py-2 rounded text-sm ${fb.kind === 'success' ? 'bg-green-50 border border-green-200 text-green-900' : 'bg-red-50 border border-red-200 text-red-900'}`}
            >
              {fb.msg}
            </div>
          {/if}

          <!-- Action buttons -->
          <div class="flex flex-wrap gap-2 pt-2 border-t border-border">
            <button
              type="button"
              on:click={() => setOpen(item.submissionId, openAction[item.submissionId] === 'approve' ? null : 'approve')}
              class="btn btn-primary"
            >
              Approve · award {item.defaultPoints} pt{item.defaultPoints === 1 ? '' : 's'}
            </button>
            <button
              type="button"
              on:click={() => setOpen(item.submissionId, openAction[item.submissionId] === 'revise' ? null : 'revise')}
              class="btn btn-secondary"
            >
              Request revision
            </button>
            <button
              type="button"
              on:click={() => setOpen(item.submissionId, openAction[item.submissionId] === 'decline' ? null : 'decline')}
              class="btn bg-transparent text-red-700 border-red-300 hover:bg-red-50"
            >
              Decline
            </button>
          </div>

          <!-- Approve form -->
          {#if openAction[item.submissionId] === 'approve'}
            <form method="POST" action="?/approve" class="border border-border rounded p-4 bg-surface space-y-3">
              <input type="hidden" name="submissionId" value={item.submissionId} />
              <label class="block">
                <span class="text-xs uppercase tracking-wider font-display font-medium text-primary block mb-1">
                  Points to award
                  {#if item.capMaxPoints !== null}
                    <span class="text-muted normal-case">(this pathway caps at {item.capMaxPoints} pts cumulative)</span>
                  {/if}
                </span>
                <input
                  name="points"
                  type="number"
                  step="0.5"
                  min="0"
                  required
                  value={item.defaultPoints}
                  class="w-32 px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary bg-white"
                />
              </label>
              <label class="block">
                <span class="text-xs uppercase tracking-wider font-display font-medium text-primary block mb-1">
                  Notes (optional)
                </span>
                <textarea
                  name="notes"
                  rows="2"
                  class="w-full px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary bg-white"
                ></textarea>
              </label>
              <div class="flex gap-2">
                <button
                  type="submit"
                  class="btn btn-primary"
                >
                  Confirm award
                </button>
                <button
                  type="button"
                  on:click={() => setOpen(item.submissionId, null)}
                  class="text-xs text-muted hover:underline"
                >
                  Cancel
                </button>
              </div>
            </form>
          {/if}

          <!-- Revise form -->
          {#if openAction[item.submissionId] === 'revise'}
            <form method="POST" action="?/revise" class="border border-border rounded p-4 bg-surface space-y-3">
              <input type="hidden" name="submissionId" value={item.submissionId} />
              <label class="block">
                <span class="text-xs uppercase tracking-wider font-display font-medium text-primary block mb-1">
                  What does the student need to revise?
                </span>
                <textarea
                  name="notes"
                  rows="3"
                  required
                  placeholder="Reflection should address all 5 NYSED stages · please expand on stage 4 (Implementation)…"
                  class="w-full px-3 py-2 border border-border rounded text-sm focus:border-primary focus:ring-1 focus:ring-primary bg-white"
                ></textarea>
              </label>
              <div class="flex gap-2">
                <button
                  type="submit"
                  class="btn btn-primary"
                >
                  Send back for revision
                </button>
                <button
                  type="button"
                  on:click={() => setOpen(item.submissionId, null)}
                  class="text-xs text-muted hover:underline"
                >
                  Cancel
                </button>
              </div>
            </form>
          {/if}

          <!-- Decline form -->
          {#if openAction[item.submissionId] === 'decline'}
            <form method="POST" action="?/decline" class="border border-red-200 rounded p-4 bg-red-50 space-y-3">
              <input type="hidden" name="submissionId" value={item.submissionId} />
              <label class="block">
                <span class="text-xs uppercase tracking-wider font-display font-medium text-red-900 block mb-1">
                  Reason for decline
                </span>
                <textarea
                  name="reason"
                  rows="3"
                  required
                  placeholder="This activity does not meet NYSED criteria for the pathway because…"
                  class="w-full px-3 py-2 border border-red-300 rounded text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 bg-white"
                ></textarea>
              </label>
              <div class="flex gap-2">
                <button
                  type="submit"
                  class="btn bg-red-700 text-white border-red-700 hover:bg-red-800"
                >
                  Decline submission
                </button>
                <button
                  type="button"
                  on:click={() => setOpen(item.submissionId, null)}
                  class="text-xs text-red-900 hover:underline"
                >
                  Cancel
                </button>
              </div>
            </form>
          {/if}
        </div>
      </li>
    {/each}
  </ul>
{/if}
