import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

export default {
  content: ['./src/**/*.{html,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#204A97', dark: '#1a3d80' },
        secondary: '#FE8158',
        surface: '#f7f9fc',
        ink: '#1a1a1a',
        muted: '#555555',
        border: '#d4d8e0'
      },
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        body: ['Roboto', 'system-ui', 'sans-serif'],
        serif: ['Literata', 'Georgia', 'serif']
      }
    }
  },
  plugins: [forms]
} satisfies Config;
