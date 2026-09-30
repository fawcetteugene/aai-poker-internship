# Six Hand — AAI Labs poker exercise

A single-page, six-player no-limit Texas Hold’em simulator. One user controls all six seats. The browser runs the hand; FastAPI replays the completed transcript with PokerKit, calculates winnings, and saves it to PostgreSQL.

## Run

From the repository root, with Docker and Docker Compose installed:

```bash
docker compose up -d
```

Open **http://localhost:3000**. The first run builds the images and downloads dependencies. No environment file, database setup, or other configuration is required. Health checks order startup so the database and API are ready before the frontend starts. API documentation is at http://localhost:8000/docs.

```bash
docker compose ps                 # all three application services should be healthy
docker compose logs backend       # inspect API startup or errors
docker compose down               # stop; saved hands remain in the named volume
```

The database password in Compose is a local development default. Services are exposed on loopback only; PostgreSQL is internal to the Compose network.

## Play

1. Choose a starting stack for all six players and click **Apply**. If a hand is in progress, Apply starts it again with the new stack.
2. Click **Start** to deal. The first action changes this button to **Reset**.
3. Act for the highlighted player. Illegal actions are disabled. The amount input is the **total street contribution** for a bet/raise; the minus and plus buttons change it by exactly 40 chips. All-in handles the remaining stack, including amounts outside that increment.
4. The board advances when a betting round closes. When no further betting is possible, the remaining board runs out automatically.
5. A completed hand is automatically validated and saved. The history panel fetches saved hands from the API and survives refreshes. A failed save offers **Retry save** and keeps Reset disabled until saving succeeds.

Each independent hand has fixed positions: Player 1 is small blind (20), Player 2 is big blind (40), Player 6 is dealer. There is no ante or rake. All players’ hole cards are visible because this is a simulator for one user controlling every seat. Reset deals a fresh deck and restores the configured stacks. Starting stacks must be whole numbers from 40 to 1,000,000.

## Repository

```text
frontend/
  src/lib/poker.ts          Pure, immutable client betting engine
  src/lib/api.ts            REST client
  src/components/           React interface and generated shadcn/ui components
  tests/                    Betting rules and cross-language transcript tests
  e2e/                      Playwright tests against the real Compose stack
backend/
  main.py                   Development entry point
  pyproject.toml            Poetry project definition
  poetry.lock               Locked Python dependencies
  src/poker/
    models.py               Dataclass persistence entities
    schemas.py              Strict request validation
    engine.py               PokerKit replay and settlement
    repository.py           Parameterized raw SQL and dataclass reconstruction
    api.py                  FastAPI routes and connection-pool lifecycle
  tests/                    Domain, HTTP, and PostgreSQL integration tests
docs/
  architecture.md           Design decisions and code walkthrough
  verification.md           Recorded validation results
  ai/                       AI disclosure and conversation export
  reference/                Original private exercise and wireframe
```

The backend follows the requested template’s `main.py`, `src/`, `tests/`, `pyproject.toml`, and Dockerfile layout, with a named package inside `src/`. The referenced template currently uses uv; this submission uses **Poetry**, as explicitly required by the exercise. The frontend uses Next.js, React, TypeScript, Tailwind, and shadcn/ui components generated from the official registry.

## Verification

Backend tests, including a real PostgreSQL repository test, run entirely through Docker:

```bash
docker compose --profile test run --build --rm tests
```

For frontend unit/contract tests and browser tests, install Node.js 24 and Python 3.12 with Poetry:

```bash
cd backend
poetry install
poetry run pytest
poetry run ruff check src tests main.py
cd ../frontend
npm ci
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
```

The browser tests expect the Compose stack on port 3000. Set `PLAYWRIGHT_BASE_URL` to test another local URL. The cross-language test uses `backend/.venv/bin/python`; set `POKER_PYTHON` if Poetry created its environment elsewhere. It explicitly skips when that interpreter is absent. The isolated backend suite skips the PostgreSQL test unless `TEST_DATABASE_URL` is set; the Compose test service sets it automatically.

Tests cover turn order, blinds, legal actions, minimum raises, short/cumulative all-ins, all-in runouts, showdown, side pots, split pots, uncalled wagers, invalid transcripts, idempotent saves, HTTP errors, real SQL persistence, and browser save/reload behavior. See [the recorded results](docs/verification.md).

## API

| Method | Resource | Behavior |
| --- | --- | --- |
| GET | `/health` | Readiness, including a database query |
| GET | `/api/hands?limit=50&offset=0` | Newest completed hands first; limit 1–100 |
| GET | `/api/hands/{uuid}` | One hand; 404 when absent |
| POST | `/api/hands` | Validate, settle, and persist a completed hand; 201 + Location |

The POST body contains `id`, six `starting_stacks`, six pairs of `hole_cards`, five reserved `board` cards, and ordered `actions`. An action has a zero-based `player`, a `kind` (`fold`, `check`, `call`, `bet`, `raise`, `allin`), and an `amount` only for bet/raise. The server never accepts client-supplied winnings. Unrevealed board cards are omitted from saved history. Repeating an identical completed hand UUID returns the original hand with 200; reusing it for different content returns 409. Invalid hands return 422 and are never saved.

## Scope and tradeoffs

- This is a local hand simulator, with no accounts, multiplayer, real-money play, or tournaments.
- Fixed positions make each independent reset easy to inspect. Dealer rotation and stack carryover between hands are outside this exercise.
- Live hands are in browser memory. Refreshing discards an unfinished hand; completed hands are durable in PostgreSQL.
- History stores immutable, validated dataclass snapshots in PostgreSQL JSONB. Raw SQL controls inserts, uniqueness, ordering, and pagination. This avoids many relational tables for data that is always read as a complete hand.
- Client-side dealing is intentional for the required browser simulation. The server validates card uniqueness and legality; it does not claim to verify randomness or prevent a user from choosing their own valid cards.

## Submission materials

The exercise and solution are private application materials. The confirmed deadline is **Wednesday, October 7, 2026**. AI use is recorded in [docs/ai/README.md](docs/ai/README.md). Review the walkthrough and conversation record before submitting; the exercise expects the applicant to understand the implementation.

To produce a ZIP containing the complete local Git repository and source, excluding dependencies, generated builds, and test reports:

```bash
python3 scripts/package_submission.py
```

No email is sent and no repository is published by this project.
