# Six Hand

A six-player, single-page Texas Hold’em simulator built for the AAI Labs Member of Technical Staff (Software) internship exercise.

Six Hand lets one user operate all six seats through a complete no-limit Hold’em hand. The browser owns the interactive betting state, FastAPI validates and settles the completed transcript with PokerKit, and PostgreSQL stores the resulting hand history.

## Highlights

- Six-player Texas Hold’em with fixed positions, 20/40 blinds, and no ante.
- Complete action flow: fold, check, call, bet, raise, and all-in.
- Legal actions and wager bounds calculated by a pure client-side game engine.
- Live play log, community-card reveals, settlement details, and persistent hand history.
- Server-side replay and validation through PokerKit, including winnings, side pots, split pots, and chip conservation.
- REST API backed by PostgreSQL through a raw-SQL repository class.
- Responsive React interface styled with shadcn/ui and Tailwind.
- Docker Compose startup from the repository root with no setup file required.

## Run the application

Requirements: Docker and Docker Compose.

From the repository root:

```bash
docker compose up -d
```

Open the application at [http://localhost:3000](http://localhost:3000). FastAPI’s interactive documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).

Useful commands:

```bash
docker compose ps
docker compose logs backend
docker compose down
```

The PostgreSQL data is stored in the named `poker_data` volume. The services bind to loopback addresses for local development.

## How to play

1. Enter a starting stack for each player and select **Apply**.
2. Select **Start** to deal a new hand. The button becomes **Reset** after the first action.
3. Follow the highlighted seat and select a legal action. Bet and raise amounts represent the total street contribution; the plus and minus controls move in 40-chip big-blind increments.
4. The board advances automatically when a betting round closes. If no further betting is possible, the remaining board runs out automatically.
5. When the hand completes, the browser submits the transcript. The server validates it, calculates winnings, saves it, and refreshes the hand history.

Player 1 is the small blind, Player 2 is the big blind, and Player 6 is the dealer. Starting stacks must be whole numbers from 40 to 1,000,000 chips. All hole cards are visible because this is a six-seat simulator operated by one user.

## Architecture

The project is organized as a single repository with separate frontend and backend applications.

- **Frontend:** Next.js, React, TypeScript, shadcn/ui, Tailwind, and Playwright.
- **Client game engine:** `frontend/src/lib/poker.ts` contains immutable state transitions, legal-action calculation, betting-round progression, board reveals, and chip accounting.
- **API client:** `frontend/src/lib/api.ts` uses same-origin `/api/*` requests. Next.js rewrites those requests to FastAPI inside the Compose network.
- **Backend:** FastAPI validates request schemas, replays actions through PokerKit, calculates trusted payoffs, and exposes hand resources.
- **Persistence:** `backend/src/poker/repository.py` uses parameterized raw SQL and PostgreSQL JSONB. Dataclass entities represent stored hands.
- **Startup:** PostgreSQL becomes healthy before FastAPI starts; the frontend waits for the API health check.

## API

| Method | Resource | Description |
| --- | --- | --- |
| `GET` | `/health` | Readiness check with a database query. |
| `GET` | `/api/hands?limit=50&offset=0` | Returns newest completed hands first. |
| `GET` | `/api/hands/{uuid}` | Returns one saved hand or `404`. |
| `POST` | `/api/hands` | Validates, settles, and persists a completed hand. Returns `201` with `Location`. |

The server never accepts client-supplied winnings. It validates cards, action order, legal betting, completion, and chip conservation before persistence. Repeating an identical hand UUID is idempotent; reusing it for different content returns `409`.

## Verification

Run the backend and PostgreSQL integration suite through Docker:

```bash
docker compose --profile test run --build --rm tests
```

Run the frontend checks locally from `frontend/`:

```bash
npm ci
npm run typecheck
npm test
npm run test:e2e
```

The recorded verification includes:

- 23 backend tests with PostgreSQL enabled.
- 9 frontend unit and cross-language contract tests, including 250 seeded transcript replays through Python/PokerKit.
- 4 Playwright tests covering real API save/reload, all-in settlement, retry after a failed save, and mobile layout.
- Ruff, TypeScript, Prettier, Docker Compose, and API smoke checks.

See [docs/verification.md](docs/verification.md) for the detailed verification record and [docs/architecture.md](docs/architecture.md) for implementation decisions.

## Repository layout

```text
.
├── backend/
│   ├── main.py
│   ├── pyproject.toml
│   ├── poetry.lock
│   ├── src/poker/
│   │   ├── api.py
│   │   ├── engine.py
│   │   ├── models.py
│   │   ├── repository.py
│   │   └── schemas.py
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   └── lib/
│   ├── tests/
│   └── e2e/
├── docs/
│   ├── architecture.md
│   ├── verification.md
│   └── ai/
├── docker-compose.yml
└── scripts/
```

Generated dependencies, build output, test reports, and virtual environments are excluded from the submission archive. Rebuild the archive with:

```bash
python3 scripts/package_submission.py
```

## AI-use disclosure

AI assistance was used throughout design, implementation, testing, and documentation. The repository includes the visible conversation export and a tool/model disclosure in [docs/ai/](docs/ai/). The implementation, tests, and verification results should be reviewed by the applicant before submission.

## Scope

This is a local hand simulator. It does not include accounts, multiplayer networking, real-money play, tournaments, authentication, or authorization. Completed hands are durable in PostgreSQL; an unfinished browser hand is intentionally held in memory.
