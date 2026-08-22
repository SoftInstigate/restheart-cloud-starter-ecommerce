import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The kit packages are consumed through `npm link` while they are unpublished
// (see README, "Local kit development"). Three settings that link needs:
//
// - `dedupe`: a linked package resolves its own imports from *its* real path,
//   so `react` would resolve to the kit monorepo's copy (19.x) instead of this
//   app's (18.x). Two Reacts in one tree means "Invalid hook call" on the first
//   hook the kit runs. Forcing a single copy is the fix.
// - `optimizeDeps.exclude`: pre-bundling a symlinked dep snapshots it, so kit
//   rebuilds would not show up until the Vite cache was cleared by hand.
// - `server.fs.allow`: the linked sources live outside this project root, and
//   Vite refuses to serve those by default.
//
// All three become dead weight once the kit is published — drop them then.
const LINKED_KIT = ['@restheart-cloud/kit', '@restheart-cloud/kit-react'];

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  optimizeDeps: {
    exclude: LINKED_KIT,
  },
  server: {
    fs: {
      // The kit monorepo sits next to this project.
      allow: ['..'],
    },
  },
});
