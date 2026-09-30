from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from poker.api import create_app


class MemoryRepository:
    """A port substitute for isolated HTTP tests; SQL is tested separately."""

    def __init__(self):
        self.hands = {}

    def list(self, limit, offset):
        return sorted(
            self.hands.values(), key=lambda h: h.created_at, reverse=True
        )[offset : offset + limit]

    def get(self, hand_id):
        return self.hands.get(hand_id)

    def save(self, hand):
        if hand.id in self.hands:
            return False
        self.hands[hand.id] = hand
        return True


@pytest.fixture
def client():
    with TestClient(create_app(MemoryRepository())) as client:
        yield client


def test_create_list_get_and_retry_are_consistent(client, payload):
    response = client.post("/api/hands", json=payload)
    assert response.status_code == 201, response.text
    assert response.headers["location"] == f"/api/hands/{payload['id']}"
    result = response.json()
    assert result["payoffs"] == [-20, 20, 0, 0, 0, 0]
    assert client.get(response.headers["location"]).json() == result
    assert client.get("/api/hands").json() == [result]
    retry = client.post("/api/hands", json=payload)
    assert retry.status_code == 200
    assert retry.json() == result
    assert len(client.get("/api/hands").json()) == 1


def test_conflicting_uuid_returns_409(client, payload):
    assert client.post("/api/hands", json=payload).status_code == 201
    payload["starting_stacks"] = [2000] * 6
    assert client.post("/api/hands", json=payload).status_code == 409


def test_bad_transcript_does_not_reach_storage(client, payload):
    payload["actions"][0]["kind"] = "check"
    assert client.post("/api/hands", json=payload).status_code == 422
    assert client.get("/api/hands").json() == []


def test_resource_errors_and_pagination(client):
    assert client.get(f"/api/hands/{uuid4()}").status_code == 404
    assert client.get("/api/hands/not-a-uuid").status_code == 422
    assert client.get("/api/hands?limit=101").status_code == 422
    assert client.get("/api/hands?offset=-1").status_code == 422
    assert client.get("/health").json() == {"status": "ok"}
