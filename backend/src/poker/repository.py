"""PostgreSQL repository using parameterized raw SQL, with no ORM."""

from dataclasses import asdict
from typing import Protocol

from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from poker.models import Hand


class HandStore(Protocol):
    def list(self, limit: int, offset: int) -> list[Hand]: ...

    def get(self, hand_id: str) -> Hand | None: ...

    def save(self, hand: Hand) -> bool: ...


class HandRepository:
    def __init__(self, pool: ConnectionPool):
        self.pool = pool

    def initialize(self) -> None:
        with self.pool.connection() as connection:
            connection.execute("""
                CREATE TABLE IF NOT EXISTS hands (
                    id UUID PRIMARY KEY,
                    created_at TIMESTAMPTZ NOT NULL,
                    data JSONB NOT NULL
                )
            """)
            connection.execute("""
                CREATE INDEX IF NOT EXISTS hands_created_at_idx
                ON hands (created_at DESC, id DESC)
            """)

    def list(self, limit: int = 50, offset: int = 0) -> list[Hand]:
        with self.pool.connection() as connection:
            rows = connection.execute(
                "SELECT data FROM hands ORDER BY created_at DESC, id DESC "
                "LIMIT %s OFFSET %s",
                (limit, offset),
            ).fetchall()
        return [Hand.from_dict(row[0]) for row in rows]

    def get(self, hand_id: str) -> Hand | None:
        with self.pool.connection() as connection:
            row = connection.execute(
                "SELECT data FROM hands WHERE id = %s", (hand_id,)
            ).fetchone()
        return Hand.from_dict(row[0]) if row else None

    def save(self, hand: Hand) -> bool:
        data = asdict(hand)
        data["created_at"] = hand.created_at.isoformat()
        with self.pool.connection() as connection:
            row = connection.execute(
                "INSERT INTO hands (id, created_at, data) VALUES (%s, %s, %s) "
                "ON CONFLICT (id) DO NOTHING RETURNING id",
                (hand.id, hand.created_at, Jsonb(data)),
            ).fetchone()
        return row is not None
