import os
from dataclasses import asdict

import pytest
from psycopg_pool import ConnectionPool

from poker.engine import settle_hand
from poker.repository import HandRepository
from poker.schemas import HandInput


@pytest.mark.skipif(
    not os.getenv("TEST_DATABASE_URL"),
    reason="Set TEST_DATABASE_URL for PostgreSQL integration",
)
def test_postgres_round_trip_and_idempotence(payload):
    with ConnectionPool(os.environ["TEST_DATABASE_URL"]) as pool:
        repository = HandRepository(pool)
        repository.initialize()
        hand = settle_hand(HandInput(**payload))
        try:
            assert repository.save(hand)
            assert not repository.save(hand)
            assert asdict(repository.get(hand.id)) == asdict(hand)
            assert hand.id in [h.id for h in repository.list(100, 0)]
        finally:
            with pool.connection() as connection:
                connection.execute(
                    "DELETE FROM hands WHERE id = %s", (hand.id,)
                )
