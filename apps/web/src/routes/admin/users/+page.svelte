<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types.js';

  export let data: PageData;
  export let form: ActionData;

  function formatDate(s: string | null): string {
    if (!s) return ' · ';
    return s.length >= 10 ? s.slice(0, 10) : s;
  }
  function roleLabel(r: string): string {
    if (r === 'counselor') return 'Counselor';
    if (r === 'scrc_member') return 'SCRC Member';
    if (r === 'teacher') return 'Teacher';
    if (r === 'admin') return 'Admin';
    return r;
  }
</script>

<svelte:head>
  <title>Staff · Admin · GNPS</title>
</svelte:head>

<section class="py-8">
  <p class="text-xs uppercase tracking-widest text-secondary font-display font-semibold mb-2">
    Admin
  </p>
  <h1 class="font-display text-3xl font-bold text-primary mb-2">Staff</h1>
  <p class="text-sm text-muted mb-6 leading-relaxed max-w-3xl">
    Counselors, SCRC committee members, teachers, and admins. Provisioning a
    staff member creates their portal account; they then request a one-time
    sign-in link from <code>/login</code>.
  </p>

  {#if form && 'invited' in form && form.invited}
    <div class="mb-4 rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm">
      Provisioned <strong>{form.invited.email}</strong> as
      {roleLabel(form.invited.role as string)}. They can request a one-time sign-in link from <code>/login</code>.
      {#if form.invited.warning}
        <span class="text-yellow-700 block text-xs mt-1">⚠ {form.invited.warning}</span>
      {/if}
    </div>
  {/if}
  {#if form && 'inviteError' in form && form.inviteError}
    <p class="mb-3 text-sm text-red-600">Provision failed: {form.inviteError}</p>
  {/if}
  {#if form && 'roleError' in form && form.roleError}
    <p class="mb-3 text-sm text-red-600">Role update failed: {form.roleError}</p>
  {/if}
  {#if form && 'removeError' in form && form.removeError}
    <p class="mb-3 text-sm text-red-600">Remove failed: {form.removeError}</p>
  {/if}

  <!-- Invite form -->
  <form
    method="POST"
    action="?/invite"
    class="mb-6 rounded-lg border border-border bg-white px-4 py-4"
    use:enhance
  >
    <h2 class="font-display font-semibold text-primary text-sm mb-3">Provision a staff member</h2>
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
      <input
        name="email"
        type="email"
        placeholder="email@greatneck.k12.ny.us"
        required
        class="rounded-md border border-border px-3 py-2 col-span-2"
      />
      <input
        name="fullName"
        placeholder="Full name"
        required
        class="rounded-md border border-border px-3 py-2"
      />
      <select name="role" class="rounded-md border border-border bg-white px-3 py-2">
        <option value="counselor">Counselor</option>
        <option value="scrc_member">SCRC Member</option>
        <option value="teacher">Teacher</option>
        <option value="admin">Admin</option>
      </select>
    </div>
    <div class="mt-3">
      <button
        type="submit"
        class="rounded-md bg-primary text-white px-4 py-2 text-sm font-display font-semibold hover:bg-primary-dark"
      >
        Provision access
      </button>
    </div>
  </form>

  <!-- Staff table -->
  <div class="overflow-x-auto rounded-lg border border-border bg-white">
    <table class="min-w-full text-sm">
      <thead class="bg-surface text-xs uppercase tracking-widest text-muted">
        <tr>
          <th class="text-left px-4 py-3 font-display font-semibold">Email</th>
          <th class="text-left px-4 py-3 font-display font-semibold">Name</th>
          <th class="text-left px-4 py-3 font-display font-semibold">Role</th>
          <th class="text-left px-4 py-3 font-display font-semibold">Created</th>
          <th class="text-left px-4 py-3 font-display font-semibold">Last login</th>
          <th class="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border">
        {#each data.staff as s (s.id)}
          <tr>
            <td class="px-4 py-2">{s.email}</td>
            <td class="px-4 py-2">{s.fullName}</td>
            <td class="px-4 py-2">
              <form method="POST" action="?/updateRole" class="flex gap-1" use:enhance>
                <input type="hidden" name="userId" value={s.id} />
                <select
                  name="newRole"
                  value={s.role}
                  class="rounded-md border border-border bg-white px-2 py-1 text-xs"
                  on:change={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
                >
                  <option value="counselor">Counselor</option>
                  <option value="scrc_member">SCRC Member</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </form>
            </td>
            <td class="px-4 py-2 text-xs text-muted">{formatDate(s.createdAt)}</td>
            <td class="px-4 py-2 text-xs text-muted">{formatDate(s.lastLoginAt)}</td>
            <td class="px-4 py-2 text-right">
              <form
                method="POST"
                action="?/remove"
                class="inline"
                use:enhance={({ cancel }) => {
                  const ok = confirm(
                    `Remove ${s.email}? Audit log will record this action; the user can be re-invited later.`
                  );
                  if (!ok) cancel();
                }}
              >
                <input type="hidden" name="userId" value={s.id} />
                <button
                  type="submit"
                  class="text-red-600 hover:underline text-xs disabled:text-muted disabled:cursor-not-allowed"
                  disabled={s.id === data.user?.id}
                  title={s.id === data.user?.id ? 'You cannot remove your own account' : 'Remove staff'}
                >
                  Remove
                </button>
              </form>
            </td>
          </tr>
        {/each}
        {#if data.staff.length === 0}
          <tr>
            <td colspan="6" class="px-4 py-8 text-center text-muted">
              No staff yet. Invite one above.
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</section>
