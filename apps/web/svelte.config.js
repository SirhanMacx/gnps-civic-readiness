import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ runtime: 'nodejs22.x' }),
    alias: {
      $theme: 'src/lib/theme',
      $server: 'src/lib/server',
      $lib: 'src/lib'
    }
  }
};
