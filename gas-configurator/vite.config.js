import { defineConfig, searchForWorkspaceRoot } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 4173,
    open: true,
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd())],
    },
  },
  preview: {
    port: 4173,
    open: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});
