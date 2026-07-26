import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base` has to match the sub-path the site is served from. On GitHub Pages that
// is the repository name; BASE_PATH lets a fork deploy under a different name (or
// to a root domain with BASE_PATH=/) without touching source.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? (process.env.BASE_PATH ?? '/hubble/') : '/',
}))
