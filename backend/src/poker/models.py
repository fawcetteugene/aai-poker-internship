"""Dataclass persistence entities, independent of HTTP and SQL."""

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Action:
    player: int
    kind: str
    amount: int | None = None


@dataclass(frozen=True)
class Hand:
    id: str
    created_at: datetime
    starting_stacks: list[int]
    hole_cards: list[list[str]]
    board: list[str]
    actions: list[Action]
    final_stacks: list[int]
    payoffs: list[int]
    log: list[str]
    short_actions: str

    @classmethod
    def from_dict(cls, data: dict) -> "Hand":
        data = dict(data)
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        data["actions"] = [Action(**action) for action in data["actions"]]
        return cls(**data)
