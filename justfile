default:
    @just --list

dev:
    npm run dev

# Take over openapi.json from ../backend and regenerate the client (result is committed)
api:
    cp ../backend/openapi.json openapi.json
    npm run api

# Check translations against the English source
i18n:
    npm run i18n:check

# Everything CI checks
check:
    npm run lint
    npm run i18n:check
    npm run api
    git diff --exit-code src/api
    npm run build
