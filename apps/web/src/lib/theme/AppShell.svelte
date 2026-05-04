<script lang="ts">
  const logoUrl = 'https://resources.finalsite.net/images/f_auto,q_auto,t_image_size_2/v1719848341/greatneckk12nyus/mapstlq0ll8etgbkht69/NewGNPSLogoRound.png';
</script>

<div class="min-h-screen flex flex-col bg-white">
  <header class="bg-primary text-white px-6 py-3 flex items-center gap-3 font-display shadow-sm">
    <img src={logoUrl} alt="GNPS" width="40" height="40" class="rounded-full bg-white p-0.5" loading="eager" />
    <div class="flex flex-col leading-tight">
      <span class="font-semibold text-[15px]">Great Neck Public Schools</span>
      <span class="text-xs opacity-80">Seal of Civic Readiness Portal</span>
    </div>
    <nav class="ml-auto flex gap-5 text-sm font-medium">
      <a href="/" class="hover:underline opacity-90 hover:opacity-100">Home</a>
      <a href="/submit" class="hover:underline opacity-90 hover:opacity-100">Submit Evidence</a>
      <a href="/about" class="hover:underline opacity-90 hover:opacity-100">About the Seal</a>
    </nav>
  </header>

  <main class="flex-1 max-w-5xl w-full mx-auto px-6 py-10">
    <slot />
  </main>

  <footer class="bg-surface border-t border-border px-6 py-5 text-xs text-muted">
    <div class="max-w-5xl mx-auto flex flex-wrap justify-between gap-3">
      <span>© Great Neck Public Schools · NYS Seal of Civic Readiness Portal · Open-source on GitHub (MIT)</span>
      <span>Questions: <a href="mailto:civicseal@greatneck.k12.ny.us" class="text-primary hover:underline">civicseal@greatneck.k12.ny.us</a></span>
    </div>
  </footer>
</div>
