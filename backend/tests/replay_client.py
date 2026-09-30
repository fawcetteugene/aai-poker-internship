"""Contract oracle called by frontend tests in a single Python process."""

import json
import sys

from poker.engine import settle_hand
from poker.schemas import HandInput

scenarios = json.load(sys.stdin)
for index, scenario in enumerate(scenarios):
    try:
        hand = settle_hand(HandInput(**scenario["input"]))
        assert hand.short_actions == scenario["short_actions"]
        assert len(hand.board) == scenario["revealed"]
        # The browser transcript includes the terminal "Hand ... ended" line;
        # only the server-generated winnings summary is excluded here.
        assert hand.log[:-1] == scenario["log"]
        assert sum(hand.payoffs) == 0
        assert sum(hand.final_stacks) == sum(hand.starting_stacks)
    except Exception:
        print(f"Scenario {index}: {json.dumps(scenario)}", file=sys.stderr)
        raise
print(f"{len(scenarios)} transcripts verified")
