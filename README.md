# Harrier Web

Panel-Frontend: React 19, Vite, TanStack Query, Tailwind 4. Der API-Client in `src/api` ist aus `openapi.json` generiert (hey-api).

## Entwickeln

```bash
npm install
just dev     # http://localhost:5173, /api wird an das Gateway auf :8080 weitergeleitet
```

| Befehl | Zweck |
|---|---|
| `just api` | `openapi.json` aus `../backend` übernehmen und Client neu erzeugen (wird committet) |
| `just check` | Alles, was die CI prüft |

Das Web vergleicht beim Start seinen Contract-Hash (aus `openapi.json`) mit `GET /api/v1/meta` und warnt, wenn Frontend und Backend nicht zusammenpassen.

Hinweis: `typescript` ist auf Version 6 fixiert, weil der Client-Generator die JavaScript-API von TypeScript braucht, die es in TypeScript 7 nicht mehr gibt.
