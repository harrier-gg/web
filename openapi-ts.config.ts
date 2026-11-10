import { defineConfig } from '@hey-api/openapi-ts';

// Erzeugt den API-Client aus openapi.json (Kopie aus dem Backend-Release). Ergebnis wird committet.
export default defineConfig({
  input: './openapi.json',
  output: 'src/api',
  plugins: ['@hey-api/client-fetch', '@tanstack/react-query'],
});
