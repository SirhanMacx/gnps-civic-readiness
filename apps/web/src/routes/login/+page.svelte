<script lang="ts">
  import { enhance } from '$app/forms';
  /** @type {{ data: { error: string | null; next: string | null }, form: { success?: boolean; email?: string; error?: string } | null }} */
  export let data;
  /** @type {{ success?: boolean; email?: string; error?: string } | null} */
  export let form;

  let submitting = false;
  let email = '';

  function errorMessage(code: string | null): string | null {
    if (!code) return null;
    if (code === 'no_role') {
      return "You signed in, but your email isn’t on the staff roster yet. Ask your portal admin to invite you.";
    }
    if (code === 'invalid_link') {
      return 'That sign-in link is invalid or has already been used. Request a new one below.';
    }
    if (code === 'expired') {
      return 'That sign-in link expired. Magic links last 1 hour — request a new one below.';
    }
    return 'Something went wrong with sign-in. Please try again.';
  }
</script>

<svelte:head>
  <title>Staff Sign-In · GNPS Civic Readiness Portal</title>
</svelte:head>

<section class="max-w-md mx-auto py-8">
  <p class="text-xs uppercase tracking-widest text-secondary font-display font-semibold mb-2">Staff Sign-In</p>
  <h1 class="font-display text-3xl font-bold text-primary mb-3 leading-tight">Sign in to the GNPS Civic Readiness Portal</h1>
  <p class="text-sm text-muted mb-6 leading-relaxed">
    For Great Neck counselors, Civic Readiness Committee members, and admins. Enter your district email — we'll send a one-time sign-in link.
  </p>

  {#if errorMessage(data.error)}
    <div class="border-l-4 border-red-500 bg-red-50 px-4 py-3 mb-5 text-sm text-red-900 rounded">
      {errorMessage(data.error)}
    </div>
  {/if}

  {#if form?.success}
    <div class="border-l-4 border-secondary bg-orange-50 px-5 py-4 mb-4 rounded">
      <p class="font-display font-semibold text-primary mb-1">Check your email.</p>
      <p class="text-sm text-ink leading-relaxed">
        If <span class="font-mono">{form.email}</span> matches a staff account, a sign-in link is on its way. The link expires in 1 hour.
      </p>
      <p class="text-xs text-muted mt-2">
        Don't see it? Check spam, or wait a minute and try again.
      </p>
    </div>
  {:else}
    <form
      method="POST"
      class="space-y-4"
      use:enhance={() => {
        submitting = true;
        return async ({ update }) => {
          await update({ reset: false });
          submitting = false;
        };
      }}
    >
      {#if data.next}
        <input type="hidden" name="next" value={data.next} />
      {/if}

      <label class="block">
        <span class="block text-sm font-display font-semibold text-primary mb-1">Email</span>
        <input
          type="email"
          name="email"
          autocomplete="email"
          required
          bind:value={email}
          placeholder="counselor@greatneck.k12.ny.us"
          class="block w-full border border-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </label>

      {#if form?.error}
        <p class="text-sm text-red-700">{form.error}</p>
      {/if}

      <button
        type="submit"
        disabled={submitting}
        class="w-full bg-secondary text-white py-3 rounded font-display font-semibold uppercase tracking-wide text-sm hover:opacity-90 disabled:opacity-50 transition"
      >
        {submitting ? 'Sending…' : 'Send sign-in link'}
      </button>
    </form>

    <p class="text-xs text-muted mt-5 leading-relaxed">
      Magic links expire in 1 hour and can only be used once. No password needed.
    </p>
  {/if}

  <hr class="my-8 border-border" />

  <p class="text-xs text-muted">
    Are you a student or supervisor? You don't need to sign in to <a href="/submit" class="text-primary hover:underline">submit evidence</a> or confirm hours — just use the link from your email.
  </p>
</section>
