# Harrier Web

Panel frontend: React 19, Vite, TanStack Query, Tailwind 4, available in **English and German**. The API client in `src/api` is generated from `openapi.json` (hey-api).

## Development

```bash
npm install
just dev     # http://localhost:5173, /api is proxied to the gateway on :8080
```

| Command | Purpose |
|---|---|
| `just api` | Take over `openapi.json` from `../backend` and regenerate the client (committed) |
| `just i18n` | Check the translations against the English source |
| `just check` | Everything CI checks |

On start, the web app compares its contract hash (from `openapi.json`) with `GET /api/v1/meta` and warns if frontend and backend do not match.

## Translations

English is the source of truth ([ADR 0003](https://github.com/harrier-gg/.github/blob/main/adr/0003-internationalization.md)).

1. Add the text to `src/locales/en.json` and use it with `t('section.key')`. Keys are type-checked against `en.json`.
2. Add the German text with the same key and the same `{{placeholders}}` to `src/locales/de.json`.
3. `just i18n` fails for stale keys or mismatching placeholders and warns about missing translations (the UI falls back to English).

A new language is one more file in `src/locales/` plus an entry in `LANGUAGES` (`src/i18n.ts`).

Note: `typescript` is pinned to version 6 because the client generator needs the TypeScript JavaScript API, which TypeScript 7 no longer has.

See the [contributing guide](https://github.com/harrier-gg/.github/blob/main/CONTRIBUTING.md) for branches, PRs and releases.
