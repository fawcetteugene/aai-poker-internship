import pytest
from pydantic import ValidationError

from poker.engine import InvalidHand, settle_hand
from poker.schemas import HandInput


def test_everyone_folds_to_big_blind(payload):
    hand = settle_hand(HandInput(**payload))
    assert hand.payoffs == [-20, 20, 0, 0, 0, 0]
    assert hand.final_stacks == [980, 1020, 1000, 1000, 1000, 1000]
    assert hand.board == []
    assert hand.short_actions == "f:f:f:f:f"


def test_uncalled_all_in_is_returned(payload):
    payload["actions"] = [{"player": 2, "kind": "allin"}] + [
        {"player": i, "kind": "fold"} for i in [3, 4, 5, 0, 1]
    ]
    hand = settle_hand(HandInput(**payload))
    assert hand.final_stacks == [980, 960, 1060, 1000, 1000, 1000]
    assert hand.payoffs == [-20, -40, 60, 0, 0, 0]


def test_short_raise_over_blind_does_not_reopen_a_caller(payload):
    payload["starting_stacks"][3] = 50
    payload["actions"] = [
        {"player": 2, "kind": "call"},
        {"player": 3, "kind": "allin"},
        *[{"player": i, "kind": "call"} for i in [4, 5, 0, 1]],
        {"player": 2, "kind": "raise", "amount": 90},
    ]
    with pytest.raises(InvalidHand, match="not reopened"):
        settle_hand(HandInput(**payload))


def test_six_way_all_in_aces_win_and_chips_are_conserved(payload):
    payload["actions"] = [
        {"player": i, "kind": "allin"} for i in [2, 3, 4, 5, 0, 1]
    ]
    hand = settle_hand(HandInput(**payload))
    assert hand.payoffs == [5000, -1000, -1000, -1000, -1000, -1000]
    assert sum(hand.payoffs) == 0
    assert hand.board == payload["board"]


def test_checked_down_board_royal_flush_splits_the_pot(payload):
    payload["board"] = ["Th", "Jh", "Qh", "Kh", "Ah"]
    payload["actions"] = (
        [{"player": i, "kind": "call"} for i in [2, 3, 4, 5, 0]]
        + [{"player": 1, "kind": "check"}]
        + [{"player": i, "kind": "check"} for _ in range(3) for i in range(6)]
    )
    hand = settle_hand(HandInput(**payload))
    assert hand.payoffs == [0] * 6
    assert "ThJhQh" in hand.short_actions
    assert hand.final_stacks == [1000] * 6


def test_side_pots_and_uncalled_excess(payload):
    payload["starting_stacks"] = [100, 200, 300, 400, 500, 600]
    payload["actions"] = [
        {"player": i, "kind": "call" if i == 5 else "allin"}
        for i in [2, 3, 4, 5, 0, 1]
    ]
    hand = settle_hand(HandInput(**payload))
    # AA wins the 600-chip main pot; successive pairs win the side pots.
    # Player 6's unmatched final 100 is returned.
    assert hand.final_stacks == [600, 500, 400, 300, 200, 100]
    assert hand.payoffs == [500, 300, 100, -100, -300, -500]
    assert sum(hand.final_stacks) == sum(payload["starting_stacks"])


@pytest.mark.parametrize(
    "action",
    [
        {"player": 1, "kind": "call"},
        {"player": 2, "kind": "check"},
        {"player": 2, "kind": "bet", "amount": 80},
        {"player": 2, "kind": "raise", "amount": 60},
        {"player": 2, "kind": "raise", "amount": 1001},
    ],
)
def test_rejects_invalid_actions(payload, action):
    payload["actions"][0] = action
    with pytest.raises(InvalidHand):
        settle_hand(HandInput(**payload))


def test_rejects_incomplete_and_extra_actions(payload):
    payload["actions"] = payload["actions"][:-1]
    with pytest.raises(InvalidHand, match="not complete"):
        settle_hand(HandInput(**payload))
    payload["actions"] += [
        {"player": 0, "kind": "fold"},
        {"player": 1, "kind": "check"},
    ]
    with pytest.raises(InvalidHand, match="hand is over"):
        settle_hand(HandInput(**payload))


@pytest.mark.parametrize(
    "mutation", ["duplicate", "card", "float", "boolean", "players", "amount"]
)
def test_strict_input_contract(payload, mutation):
    if mutation == "duplicate":
        payload["board"][0] = "As"
    elif mutation == "card":
        payload["board"][0] = "1x"
    elif mutation == "float":
        payload["starting_stacks"][0] = 1000.5
    elif mutation == "boolean":
        payload["actions"][0]["player"] = True
    elif mutation == "players":
        payload["starting_stacks"].pop()
    else:
        payload["actions"][0]["amount"] = 40
    with pytest.raises(ValidationError):
        HandInput(**payload)
