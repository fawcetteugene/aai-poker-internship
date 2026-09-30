# Verification record

Date: September 30, 2026.

## Completed source checks

- Python host suite: 22 passed, with the PostgreSQL repository test skipped when no local database is configured.
- Frontend suite: 9 passed, including 250 seeded client transcripts replayed through Python/PokerKit. The transcript test checks legal completion, identical logs and board reveals, and chip conservation.
- TypeScript: `npm run typecheck` passed.
- Ruff: all checks passed, using a 79-character line limit.
- Prettier: frontend formatting check passed.

## Stack checks

- `docker compose up -d` completed with healthy PostgreSQL, FastAPI, and Next.js containers.
- `docker compose --profile test run --build --rm tests`: 23 passed, including the live PostgreSQL repository test.
- Frontend Playwright suite: 4 passed (real API save/reload, all-in settlement, retry after a failed save, and mobile viewport coverage).
- The frontend container uses Next.js dev mode with Turbopack because the managed Docker classic builder stalls during Next's production file-tracing phase. It still serves the complete application and API rewrite from the repository root.

## Test environment notes

The sandbox blocks the local communication used by the TypeScript test runner and FastAPI's synchronous test client. Both suites ran successfully outside that sandbox. This restriction is specific to the coding environment.

Starlette emits one upstream deprecation warning about the installed httpx transport for its test client. The tests pass with the locked dependencies.
