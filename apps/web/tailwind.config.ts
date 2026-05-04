import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

export default {
  content: ['./src/**/*.{html,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        // Extracted from live greatneck.k12.ny.us CSS custom properties.
        primary: { DEFAULT: '#204A97', dark: '#1a3d80' },
        secondary: '#FE8158',
        surface: '#f7f9fc',
        ink: '#1a1a1a',
        muted: '#555555',
        border: '#d4d8e0'
      },
      fontFamily: {
        // Matches the GNPS site exactly:
        //   --main-font:   "Open Sans"   (body text)
        //   --accent-font: "Literata"    (long-form accents, blockquotes, captions)
        //   Roboto                       (button text per the .small-button class)
        display: ['"Open Sans"', 'system-ui', 'sans-serif'],
        body: ['"Open Sans"', 'system-ui', 'sans-serif'],
        button: ['Roboto', 'system-ui', 'sans-serif'],
        serif: ['Literata', 'Georgia', 'serif']
      }
    }
  },
  plugins: [forms]
} satisfies Config;
