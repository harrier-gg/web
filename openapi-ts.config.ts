import { defineConfig } from '@hey-api/openapi-ts';

// Generates the API client from openapi.json (copy from the backend release). The result is committed.
export default defineConfig({
  input: './openapi.json',
  output: 'src/api',
  plugins: ['@hey-api/client-fetch', '@tanstack/react-query'],
});
