<script lang="ts">
  import { applyAction, enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types.js';

  export let data: PageData;
  export let form: ActionData;

  let dragHover = false;
  let fileInput: HTMLInputElement;
  let parsing = false;
  let committing = false;
  let committed: any = null;

  // Reset committed state if form returns a new parse.
  $: if (form && 'parsed' in form && form.parsed) committed = null;

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    dragHover = true;
  }
  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    dragHover = false;
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragHover = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0 && fileInput) {
      const dt = new DataTransfer();
      dt.items.add(files[0]);
      fileInput.files = dt.files;
      fileInput.form?.requestSubmit();
    }
  }
</script>

<svelte:head>
  <title>Import IC CSV · Admin · GNPS</title>
</svelte:head>

<section class="py-8">
  <p class="text-xs uppercase tracking-widest text-secondary font-display font-semibold mb-2">
    Admin
  </p>
  <h1 class="font-display text-3xl font-bold text-primary mb-2">Import Infinite Campus CSV</h1>
  <p class="text-sm text-muted mb-6 leading-relaxed max-w-3xl">
    Upload the CSV exported from Infinite Campus. The portal validates each row,
    shows a diff against existing data, and asks you to confirm before any writes.
    Course rows whose code is not in the catalog are skipped with a warning —
    add them via Course Catalog and re-import.
  </p>

  <div class="text-xs text-muted mb-6">
    Course catalog currently holds {data.catalogCount} courses.
    <a href="/admin/courses" class="text-primary hover:underline">Manage catalog →</a>
  </div>

  {#if !committed && (!form || !('committed' in form) || !form.committed)}
    <!-- Step 1: upload -->
    <form
      method="POST"
      action="?/parse"
      enctype="multipart/form-data"
      use:enhance={() => {
        parsing = true;
        return async ({ result }) => {
          parsing = false;
          await applyAction(result);
        };
      }}
    >
      <div
        class="rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors
               {dragHover ? 'border-secondary bg-secondary/10' : 'border-border bg-surface'}"
        on:dragover={onDragOver}
        on:dragleave={onDragLeave}
        on:drop={onDrop}
        role="region"
        aria-label="CSV drop zone"
      >
        <p class="font-display font-semibold text-primary mb-2">Drop CSV here</p>
        <p class="text-xs text-muted mb-4">or pick a file:</p>
        <input
          bind:this={fileInput}
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          class="block mx-auto text-sm"
        />
        <button
          type="submit"
          class="mt-4 rounded-md bg-primary text-white px-5 py-2 font-display font-semibold
                 hover:bg-primary-dark disabled:opacity-50"
          disabled={parsing}
        >
          {parsing ? 'Parsing…' : 'Parse + preview'}
        </button>
      </div>
    </form>

    {#if form && 'parseError' in form && form.parseError}
      <p class="mt-4 text-sm text-red-600">{form.parseError}</p>
    {/if}

    {#if form && 'parsed' in form && form.parsed}
      {@const parsed = form.parsed}
      <!-- Step 2: review + commit -->
      <div class="mt-8 border border-border rounded-lg bg-white">
        <div class="px-6 py-4 border-b border-border">
          <h2 class="font-display text-lg font-bold text-primary">
            Step 2 — Review diff
          </h2>
          <p class="text-xs text-muted mt-1">
            Filename: <code>{parsed.filename}</code> · {parsed.bytes.toLocaleString()} bytes
          </p>
        </div>
        <div class="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p class="text-xs uppercase text-muted font-display font-semibold">Parsed rows</p>
            <p class="font-display text-2xl text-primary">{parsed.rows.length}</p>
          </div>
          <div>
            <p class="text-xs uppercase text-muted font-display font-semibold">Errors</p>
            <p class="font-display text-2xl {parsed.errors.length > 0 ? 'text-red-600' : 'text-primary'}">
              {parsed.errors.length}
            </p>
          </div>
          {#if parsed.preview}
            <div>
              <p class="text-xs uppercase text-muted font-display font-semibold">New</p>
              <p class="font-display text-2xl text-secondary">{parsed.preview.newCount}</p>
            </div>
            <div>
              <p class="text-xs uppercase text-muted font-display font-semibold">Updated</p>
              <p class="font-display text-2xl text-primary">{parsed.preview.updatedCount}</p>
            </div>
          {/if}
        </div>

        {#if parsed.errors.length > 0}
          <div class="px-6 pb-4">
            <h3 class="font-display font-semibold text-red-600 mb-2 text-sm">
              Row errors ({parsed.errors.length})
            </h3>
            <ul class="text-xs text-red-600 max-h-40 overflow-y-auto">
              {#each parsed.errors as err (err.row + err.reason)}
                <li>row {err.row}: {err.reason}</li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if parsed.previewError}
          <div class="px-6 pb-4">
            <p class="text-xs text-red-600">Preview failed: {parsed.previewError}</p>
          </div>
        {/if}

        {#if parsed.preview && parsed.rows.length > 0}
          <div class="px-6 pb-4 text-xs text-muted">
            By kind:
            <strong>course</strong> {parsed.preview.byKind.course} ·
            <strong>regents</strong> {parsed.preview.byKind.regents} ·
            <strong>demographic</strong> {parsed.preview.byKind.demographic}
          </div>
        {/if}

        {#if parsed.rows.length > 0}
          <form
            method="POST"
            action="?/commit"
            class="px-6 py-4 border-t border-border flex justify-between items-center bg-surface"
            use:enhance={() => {
              committing = true;
              return async ({ result }) => {
                committing = false;
                await applyAction(result);
                if (result.type === 'success' && (result.data as any)?.committed) {
                  committed = (result.data as any).committed;
                }
              };
            }}
          >
            <p class="text-xs text-muted">
              Confirm to commit {parsed.rows.length} rows. Audit log will record this import.
            </p>
            <input type="hidden" name="rows" value={JSON.stringify(parsed.rows)} />
            <button
              type="submit"
              class="rounded-md bg-secondary text-white px-5 py-2 font-display font-semibold
                     hover:opacity-90 disabled:opacity-50"
              disabled={committing}
            >
              {committing ? 'Committing…' : 'Commit import'}
            </button>
          </form>
        {/if}
      </div>
    {/if}
  {:else}
    {@const result = committed ?? (form && 'committed' in form ? form.committed : null)}
    {#if result}
      <!-- Post-commit summary -->
      <div class="mt-4 rounded-lg border border-green-300 bg-green-50 px-6 py-5">
        <h2 class="font-display text-lg font-bold text-primary mb-3">Import committed.</h2>
        <ul class="text-sm space-y-1">
          <li>Students upserted: <strong>{result.imported.students.upserted}</strong></li>
          <li>
            Course enrollments upserted: <strong>{result.imported.courseEnrollment.upserted}</strong>
            {#if result.imported.courseEnrollment.missingCourse > 0}
              <span class="text-red-700">
                · {result.imported.courseEnrollment.missingCourse} skipped (course not in catalog)
              </span>
            {/if}
          </li>
          <li>
            Regents scores upserted: <strong>{result.imported.regentsScores.upserted}</strong>
          </li>
          {#if result.auditLogId}
            <li class="text-xs text-muted mt-2">audit_log id: {result.auditLogId}</li>
          {/if}
          {#if result.warnings.length > 0}
            <li class="mt-2 text-xs text-red-700">
              Warnings:
              <ul class="list-disc pl-5 mt-1">
                {#each result.warnings as w (w)}
                  <li>{w}</li>
                {/each}
              </ul>
            </li>
          {/if}
        </ul>
        <div class="mt-4 flex gap-2 text-sm">
          <a
            href="/admin"
            class="rounded-md bg-primary text-white px-4 py-2 font-display font-semibold hover:bg-primary-dark"
          >
            Back to roster
          </a>
          <a
            href="/admin/import"
            class="rounded-md border border-border bg-white px-4 py-2 font-display font-semibold text-primary hover:bg-surface"
          >
            Import another
          </a>
        </div>
      </div>
    {/if}
  {/if}

  {#if data.recentImports.length > 0}
    <div class="mt-8 text-xs text-muted">
      <h3 class="font-display font-semibold text-primary mb-2 text-sm">Recent imports</h3>
      <ul class="bg-white border border-border rounded-lg divide-y divide-border">
        {#each data.recentImports as imp (imp.id)}
          <li class="px-4 py-2 flex justify-between gap-3">
            <span>{imp.occurredAt.slice(0, 10)} · {imp.rows} rows</span>
            <span>students {imp.studentsUpserted} · enrollments {imp.courseEnrollmentUpserted} · regents {imp.regentsScoresUpserted}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>
