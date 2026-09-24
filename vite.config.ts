import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Production-only CSP: blocks every network connection so photos can never leave the device (FR-001).
// Not applied in dev, where Vite's hot reload needs a websocket.
const CSP =
  "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; " +
  "connect-src 'none'; object-src 'none'";

function cspPlugin(): Plugin {
  return {
    name: 'splitframe-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), cspPlugin()],
  // Fixed port for dev and preview; fail instead of silently switching if it's taken.
  server: { port: 5175, strictPort: true },
  preview: { port: 5175, strictPort: true },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
