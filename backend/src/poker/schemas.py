"""Strict input contracts; poker semantics are checked separately by replay."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

Card = Annotated[str, Field(pattern=r"^[2-9TJQKA][cdhs]$")]
Stack = Annotated[int, Field(strict=True, ge=40, le=1_000_000)]


class ActionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    player: Annotated[int, Field(strict=True, ge=0, le=5)]
    kind: Literal["fold", "check", "call", "bet", "raise", "allin"]
    amount: Annotated[int, Field(strict=True, ge=1, le=1_000_000)] | None = (
        None
    )

    @model_validator(mode="after")
    def amount_only_for_wagers(self) -> "ActionInput":
        if (self.kind in ("bet", "raise")) != (self.amount is not None):
            raise ValueError("Only bet and raise actions require an amount")
        return self


class HandInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    starting_stacks: Annotated[list[Stack], Field(min_length=6, max_length=6)]
    hole_cards: Annotated[
        list[Annotated[list[Card], Field(min_length=2, max_length=2)]],
        Field(min_length=6, max_length=6),
    ]
    board: Annotated[list[Card], Field(min_length=5, max_length=5)]
    actions: Annotated[list[ActionInput], Field(min_length=1, max_length=2000)]

    @model_validator(mode="after")
    def unique_cards(self) -> "HandInput":
        cards = [
            card for hole in self.hole_cards for card in hole
        ] + self.board
        if len(set(cards)) != len(cards):
            raise ValueError("Each card must appear only once")
        return self
