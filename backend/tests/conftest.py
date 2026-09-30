from uuid import uuid4

import pytest


@pytest.fixture
def payload():
    return {
        "id": str(uuid4()),
        "starting_stacks": [1000] * 6,
        "hole_cards": [
            ["As", "Ad"],
            ["Ks", "Kd"],
            ["Qs", "Qd"],
            ["Js", "Jd"],
            ["Ts", "Td"],
            ["9s", "9d"],
        ],
        "board": ["2c", "3c", "4h", "6s", "8d"],
        "actions": [{"player": i, "kind": "fold"} for i in [2, 3, 4, 5, 0]],
    }
