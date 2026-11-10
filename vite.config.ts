import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// Gleicher Hash wie im Gateway (apps/gateway/src/openapi.ts): API-Form ohne Versionsnummer.
// Stimmt er nicht mit GET /api/v1/meta überein, passt dieses Frontend nicht zum Backend.
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
    proxy: { '/api': 'http://localhost:8080' },
  },
});
