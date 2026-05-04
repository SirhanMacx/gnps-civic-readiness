<script lang="ts">
  import type { StaffUser } from '../../app.d.ts';
  export let user: StaffUser | null = null;

  const logoUrl =
    'https://resources.finalsite.net/images/f_auto,q_auto,t_image_size_2/v1719848341/greatneckk12nyus/mapstlq0ll8etgbkht69/NewGNPSLogoRound.png';

  function homeFor(role: StaffUser['role']): string {
    if (role === 'admin') return '/admin';
    if (role === 'scrc_member') return '/scrc';
    if (role === 'teacher') return '/teacher';
    return '/counselor';
  }
  function shortName(u: StaffUser): string {
    if (!u.fullName) return u.email;
    const first = u.fullName.split(/\s+/)[0];
    return first || u.fullName;
  }
</script>

<div class="min-h-screen flex flex-col bg-white">
  <!-- District utility bar · mirrors the slim top row on greatneck.k12.ny.us so visitors moving
       between the district site and this portal feel a continuous GNPS context. -->
  <div class="bg-primary-dark text-white text-xs">
    <div class="max-w-6xl mx-auto px-6 py-1.5 flex items-center justify-between gap-4">
      <a href="https://www.greatneck.k12.ny.us/" class="hover:underline opacity-80 hover:opacity-100" target="_blank" rel="noopener">
        ← greatneck.k12.ny.us
      </a>
      <div class="flex items-center gap-4 opacity-80">
        <a href="/about" class="hover:underline">About the Seal</a>
        <a href="mailto:civicseal@greatneck.k12.ny.us" class="hover:underline hidden sm:inline">civicseal@greatneck.k12.ny.us</a>
      </div>
    </div>
  </div>

  <!-- Main district header · matches GNPS brand chrome (navy block, round logo, district name). -->
  <header class="bg-primary text-white shadow-sm">
    <div class="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
      <a href="/" class="flex items-center gap-3 font-display group" aria-label="GNPS Civic Readiness · Home">
        <img src={logoUrl} alt="GNPS" width="48" height="48" class="rounded-full bg-white p-0.5 shadow-sm" loading="eager" />
        <div class="flex flex-col leading-tight">
          <span class="font-semibold text-[16px] group-hover:underline">Great Neck Public Schools</span>
          <span class="text-xs opacity-80">NYS Seal of Civic Readiness Portal</span>
        </div>
      </a>

      <nav class="ml-auto flex gap-5 text-sm font-display font-medium items-center" aria-label="Main">
        <a href="/" class="hover:underline opacity-90 hover:opacity-100">Home</a>
        <a href="/submit" class="hover:underline opacity-90 hover:opacity-100">Submit Evidence</a>
        <a href="/about" class="hover:underline opacity-90 hover:opacity-100 hidden sm:inline">How it Works</a>
        {#if user}
          <span class="hidden md:inline-flex items-center gap-2 opacity-90 text-xs px-3 py-1.5 rounded-full bg-white/15">
            <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>
            <a href={homeFor(user.role)} class="font-semibold hover:underline">{shortName(user)}</a>
          </span>
          <a href="/logout" class="hover:underline opacity-90 hover:opacity-100" data-testid="logout-link">Logout</a>
        {:else}
          <a href="/login" class="bg-white/15 hover:bg-white/25 px-4 py-1.5 rounded transition">Staff Login</a>
        {/if}
      </nav>
    </div>
  </header>

  <main class="flex-1 max-w-5xl w-full mx-auto px-6 py-10">
    <slot />
  </main>

  <!-- Footer matches GNPS chrome: brand strip with contact + main links. -->
  <footer class="bg-surface border-t border-border mt-12">
    <div class="max-w-6xl mx-auto px-6 py-8 grid sm:grid-cols-3 gap-6 text-sm">
      <div>
        <div class="flex items-center gap-2 mb-3">
          <img src={logoUrl} alt="" width="32" height="32" class="rounded-full bg-white p-0.5" loading="lazy" />
          <span class="font-display font-semibold text-primary">Great Neck Public Schools</span>
        </div>
        <p class="text-xs text-muted">NYS Seal of Civic Readiness Portal · Social Studies Department.</p>
      </div>
      <div>
        <p class="font-display font-semibold text-primary text-xs uppercase tracking-wider mb-2">Portal</p>
        <ul class="space-y-1.5 text-muted">
          <li><a href="/" class="hover:text-primary hover:underline">Home</a></li>
          <li><a href="/submit" class="hover:text-primary hover:underline">Submit Evidence</a></li>
          <li><a href="/about" class="hover:text-primary hover:underline">How the Seal works</a></li>
          <li><a href="/login" class="hover:text-primary hover:underline">Staff Login</a></li>
        </ul>
      </div>
      <div>
        <p class="font-display font-semibold text-primary text-xs uppercase tracking-wider mb-2">Contact</p>
        <ul class="space-y-1.5 text-muted">
          <li><a href="mailto:civicseal@greatneck.k12.ny.us" class="hover:text-primary hover:underline break-all">civicseal@greatneck.k12.ny.us</a></li>
          <li><a href="https://www.greatneck.k12.ny.us/" class="hover:text-primary hover:underline" target="_blank" rel="noopener">greatneck.k12.ny.us</a></li>
        </ul>
      </div>
    </div>
    <div class="border-t border-border">
      <div class="max-w-6xl mx-auto px-6 py-3 text-xs text-muted flex flex-wrap justify-between gap-3">
        <span>© Great Neck Public Schools · Social Studies Department</span>
        <span>Source: <a href="https://www.nysed.gov/standards-instruction/seal-civic-readiness-information" class="text-primary hover:underline" target="_blank" rel="noopener">NYSED Seal of Civic Readiness</a></span>
      </div>
    </div>
  </footer>
</div>
