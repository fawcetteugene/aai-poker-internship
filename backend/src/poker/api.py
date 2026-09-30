"""REST hand resources and application lifecycle."""

import logging
import os
from contextlib import asynccontextmanager
from dataclasses import asdict
from uuid import UUID

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse
from psycopg import OperationalError
from psycopg_pool import ConnectionPool, PoolTimeout

from poker.engine import InvalidHand, settle_hand
from poker.models import Hand
from poker.repository import HandRepository, HandStore
from poker.schemas import HandInput


def create_app(repository: HandStore | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if repository is not None:
            app.state.repository = repository
            yield
            return
        pool = ConnectionPool(
            os.environ.get(
                "DATABASE_URL", "postgresql://poker:poker@localhost:5432/poker"
            ),
            min_size=1,
            max_size=10,
            timeout=5,
            open=False,
        )
        pool.open(wait=True, timeout=30)
        try:
            repo = HandRepository(pool)
            repo.initialize()
            app.state.repository = repo
            app.state.pool = pool
            yield
        finally:
            pool.close()

    app = FastAPI(title="AAI Poker API", version="0.1.0", lifespan=lifespan)

    @app.exception_handler(OperationalError)
    @app.exception_handler(PoolTimeout)
    async def database_unavailable(request: Request, exc: Exception):
        logging.getLogger(__name__).error(
            "Database unavailable: %s", type(exc).__name__
        )
        return JSONResponse(
            status_code=503, content={"detail": "Database unavailable"}
        )

    @app.get("/health")
    def health():
        if hasattr(app.state, "pool"):
            with app.state.pool.connection() as connection:
                connection.execute("SELECT 1")
        return {"status": "ok"}

    @app.get("/api/hands", response_model=list[Hand])
    def list_hands(
        limit: int = Query(default=50, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
    ):
        return app.state.repository.list(limit, offset)

    @app.get("/api/hands/{hand_id}", response_model=Hand)
    def get_hand(hand_id: UUID):
        hand = app.state.repository.get(str(hand_id))
        if hand is None:
            raise HTTPException(404, "Hand not found")
        return hand

    @app.post("/api/hands", response_model=Hand, status_code=201)
    def post_hand(data: HandInput, response: Response):
        try:
            hand = settle_hand(data)
        except InvalidHand as exc:
            raise HTTPException(422, str(exc)) from exc
        inserted = app.state.repository.save(hand)
        if not inserted:
            previous = app.state.repository.get(hand.id)
            old, new = asdict(previous), asdict(hand)
            old.pop("created_at")
            new.pop("created_at")
            if old != new:
                raise HTTPException(
                    409, "A different hand already uses this UUID"
                )
            response.status_code = 200
            hand = previous
        response.headers["Location"] = f"/api/hands/{hand.id}"
        return hand

    return app


app = create_app()
