default:
    @just --list

dev:
    npm run dev

# openapi.json aus ../backend übernehmen und Client neu erzeugen (Ergebnis wird committet)
api:
    cp ../backend/openapi.json openapi.json
    npm run api

# Alles, was die CI prüft
check:
    npm run lint
    npm run api
    git diff --exit-code src/api
    npm run build
