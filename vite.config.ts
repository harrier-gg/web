import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// Same hash as in the gateway (apps/gateway/src/openapi.ts): the API shape without the version number.
// If it differs from GET /api/v1/meta, this frontend does not match the backend.
const spec = JSON.parse(readFileSync(new URL('./openapi.json', import.meta.url), 'utf8'));
const contract = createHash('sha256')
  .update(JSON.stringify({ paths: spec.paths, components: spec.components }))
  .digest('hex')
  .slice(0, 16);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __API_CONTRACT__: JSON.stringify(contract) },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:8080', ws: true } }, // ws: live consoles
  },
});
