import vercelAdapter from '@sveltejs/adapter-vercel';
import nodeAdapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// SVELTE_ADAPTER=node          → self-hosted Node runtime (Docker, GNPS infra)
// SVELTE_ADAPTER unset / vercel → Vercel serverless adapter (default)
const adapter =
  process.env.SVELTE_ADAPTER === 'node'
    ? nodeAdapter()
    : vercelAdapter({ runtime: 'nodejs22.x' });

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter,
    alias: {
      $theme: 'src/lib/theme',
      $server: 'src/lib/server',
      $lib: 'src/lib'
    }
  }
};
