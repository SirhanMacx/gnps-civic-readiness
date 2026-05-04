<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types.js';

  export let data: PageData;
  export let form: ActionData;

  // Track which course row is in edit mode.
  let editingId: number | null = null;
  function startEdit(id: number) {
    editingId = id;
  }
  function cancelEdit() {
    editingId = null;
  }

  // SCRC-only approve button.
  $: isScrc = data.user?.role === 'scrc_member';
</script>

<svelte:head>
  <title>Course Catalog · Admin · GNPS</title>
</svelte:head>

<section class="py-8">
  <p class="text-xs uppercase tracking-widest text-secondary font-display font-semibold mb-2">
    Admin
  </p>
  <h1 class="font-display text-3xl font-bold text-primary mb-2">Course Catalog</h1>
  <p class="text-sm text-muted mb-6 leading-relaxed max-w-3xl">
    Catalog courses drive 1a (4-credit gate), 1d (advanced SS), and 2c (civic
    elective) eligibility. SCRC committee members approve courses to mark them
    as officially counting toward the Seal.
  </p>

  {#if form && 'addError' in form && form.addError}
    <p class="mb-3 text-sm text-red-600">Add failed: {form.addError}</p>
  {/if}
  {#if form && 'editError' in form && form.editError}
    <p class="mb-3 text-sm text-red-600">Edit failed: {form.editError}</p>
  {/if}
  {#if form && 'approveError' in form && form.approveError}
    <p class="mb-3 text-sm text-red-600">Approve failed: {form.approveError}</p>
  {/if}

  <!-- Add new course -->
  <form
    method="POST"
    action="?/add"
    class="mb-6 rounded-lg border border-border bg-white px-4 py-4"
    use:enhance
  >
    <h2 class="font-display font-semibold text-primary text-sm mb-3">Add new course</h2>
    <div class="grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm">
      <input
        name="courseCode"
        placeholder="Code, e.g. SS_GLOBAL_II"
        required
        class="rounded-md border border-border px-3 py-2"
      />
      <input
        name="title"
        placeholder="Title"
        required
        class="rounded-md border border-border px-3 py-2 col-span-2"
      />
      <input
        name="credits"
        type="number"
        step="0.5"
        min="0"
        max="10"
        value="1"
        placeholder="Credits"
        class="rounded-md border border-border px-3 py-2"
      />
      <input
        name="countsFor"
        placeholder="counts_for: 1a,1d,2c"
        class="rounded-md border border-border px-3 py-2"
      />
    </div>
    <div class="mt-3">
      <button
        type="submit"
        class="rounded-md bg-primary text-white px-4 py-2 text-sm font-display font-semibold hover:bg-primary-dark"
      >
        Add course
      </button>
    </div>
  </form>

  <!-- Catalog table -->
  <div class="overflow-x-auto rounded-lg border border-border bg-white">
    <table class="min-w-full text-sm">
      <thead class="bg-surface text-xs uppercase tracking-widest text-muted">
        <tr>
          <th class="text-left px-4 py-3 font-display font-semibold">Code</th>
          <th class="text-left px-4 py-3 font-display font-semibold">Title</th>
          <th class="text-left px-4 py-3 font-display font-semibold">Counts for</th>
          <th class="text-right px-4 py-3 font-display font-semibold">Credits</th>
          <th class="text-left px-4 py-3 font-display font-semibold">SCRC</th>
          <th class="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border">
        {#each data.courses as c (c.id)}
          {#if editingId === c.id}
            <tr>
              <td colspan="6" class="px-4 py-3 bg-surface">
                <form
                  method="POST"
                  action="?/edit"
                  class="grid grid-cols-1 sm:grid-cols-6 gap-2 text-xs items-end"
                  use:enhance={() => async ({ update }) => {
                    await update();
                    editingId = null;
                  }}
                >
                  <input type="hidden" name="courseId" value={c.id} />
                  <label class="flex flex-col">
                    <span class="text-muted uppercase tracking-widest mb-1">Code</span>
                    <input
                      name="courseCode"
                      value={c.courseCode}
                      class="rounded-md border border-border px-3 py-2"
                    />
                  </label>
                  <label class="flex flex-col col-span-2">
                    <span class="text-muted uppercase tracking-widest mb-1">Title</span>
                    <input
                      name="title"
                      value={c.title}
                      class="rounded-md border border-border px-3 py-2"
                    />
                  </label>
                  <label class="flex flex-col">
                    <span class="text-muted uppercase tracking-widest mb-1">Credits</span>
                    <input
                      name="credits"
                      type="number"
                      step="0.5"
                      min="0"
                      max="10"
                      value={c.credits}
                      class="rounded-md border border-border px-3 py-2"
                    />
                  </label>
                  <label class="flex flex-col">
                    <span class="text-muted uppercase tracking-widest mb-1">Counts for</span>
                    <input
                      name="countsFor"
                      value={c.countsFor.join(',')}
                      class="rounded-md border border-border px-3 py-2"
                    />
                  </label>
                  <div class="flex gap-2">
                    <button
                      type="submit"
                      class="rounded-md bg-primary text-white px-3 py-2 font-display font-semibold hover:bg-primary-dark"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      class="rounded-md border border-border bg-white px-3 py-2 text-primary hover:bg-surface"
                      on:click={cancelEdit}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </td>
            </tr>
          {:else}
            <tr>
              <td class="px-4 py-2 font-mono text-xs">{c.courseCode}</td>
              <td class="px-4 py-2">{c.title}</td>
              <td class="px-4 py-2">
                {#each c.countsFor as cf (cf)}
                  <span
                    class="inline-block mr-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5"
                  >
                    {cf}
                  </span>
                {/each}
              </td>
              <td class="px-4 py-2 text-right tabular-nums">{c.credits.toFixed(1)}</td>
              <td class="px-4 py-2">
                {#if c.scrcApproved}
                  <span
                    class="inline-block rounded-full bg-primary text-white text-xs px-2 py-0.5"
                  >
                    Approved
                  </span>
                {:else}
                  <span class="text-muted text-xs">Pending</span>
                {/if}
              </td>
              <td class="px-4 py-2 text-right">
                <button
                  type="button"
                  class="text-primary hover:underline text-xs mr-3"
                  on:click={() => startEdit(c.id)}
                >
                  Edit
                </button>
                {#if !c.scrcApproved}
                  <form method="POST" action="?/approve" class="inline" use:enhance>
                    <input type="hidden" name="courseId" value={c.id} />
                    <button
                      type="submit"
                      class="text-secondary hover:underline text-xs disabled:text-muted
                             disabled:hover:no-underline disabled:cursor-not-allowed"
                      disabled={!isScrc}
                      title={isScrc
                        ? 'Approve as SCRC committee member'
                        : 'Only SCRC committee members can approve courses'}
                    >
                      Approve
                    </button>
                  </form>
                {/if}
              </td>
            </tr>
          {/if}
        {/each}
        {#if data.courses.length === 0}
          <tr>
            <td colspan="6" class="px-4 py-8 text-center text-muted">
              No courses yet. Add one above.
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>

  <p class="mt-4 text-xs text-muted">
    Approve permission requires the SCRC role. Admins can add and edit courses,
    but the approval audit signature must come from a committee member.
  </p>
</section>
