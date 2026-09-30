"""Replay client actions through PokerKit and calculate trusted payoffs."""

from datetime import UTC, datetime

from pokerkit import Automation, NoLimitTexasHoldem

from poker.models import Action, Hand
from poker.schemas import HandInput

AUTOMATIONS = (
    Automation.ANTE_POSTING,
    Automation.BET_COLLECTION,
    Automation.BLIND_OR_STRADDLE_POSTING,
    Automation.HOLE_CARDS_SHOWING_OR_MUCKING,
    Automation.HAND_KILLING,
    Automation.CHIPS_PUSHING,
    Automation.CHIPS_PULLING,
)


class InvalidHand(ValueError):
    """The submitted transcript cannot represent a completed legal hand."""


def settle_hand(hand: HandInput) -> Hand:
    state = NoLimitTexasHoldem.create_state(
        AUTOMATIONS, True, 0, (20, 40), 40, tuple(hand.starting_stacks), 6
    )
    log = []
    short = []
    revealed = 0
    last_full_raise = 40
    acted_at: list[int | None] = [None] * 6
    for player, cards in enumerate(hand.hole_cards):
        state.deal_hole("".join(cards), player_index=player)
        log.append(f"Player {player + 1} is dealt {''.join(cards)}")
    log.extend(
        [
            "Player 6 is the dealer",
            "Player 1 posts small blind - 20 chips",
            "Player 2 posts big blind - 40 chips",
        ]
    )

    def reveal_board() -> None:
        nonlocal revealed, last_full_raise, acted_at
        while state.status and state.can_burn_card():
            # Unknown burns cannot collide with the reserved board.
            state.burn_card("??")
            count = 3 if revealed == 0 else 1
            cards = "".join(hand.board[revealed : revealed + count])
            state.deal_board(cards)
            street = {0: "Flop", 3: "Turn", 4: "River"}[revealed]
            revealed += count
            last_full_raise = 40
            acted_at = [None] * 6
            log.append(f"{street} cards dealt: {cards}")
            short.append(cards)

    try:
        reveal_board()
        for index, action in enumerate(hand.actions):
            if not state.status or state.actor_index != action.player:
                raise InvalidHand(
                    f"Action {index + 1}: wrong player or hand is over"
                )
            player = action.player
            name = f"Player {player + 1}"
            current_bet = max(state.bets)
            call = min(state.stacks[player], current_bet - state.bets[player])
            target = (
                state.stacks[player] + state.bets[player]
                if action.kind == "allin"
                else action.amount
            )
            if target is not None and target > current_bet:
                # Enforce cumulative reopening relative to this player's last
                # action. PokerKit's global short-all-in tracking is looser in
                # some sequences, particularly before the first full raise.
                previous = acted_at[player]
                if (
                    previous is not None
                    and current_bet - previous < last_full_raise
                ):
                    raise InvalidHand(
                        "A short all-in has not reopened raising"
                    )
                last_full_raise = max(last_full_raise, target - current_bet)
                acted_at[player] = target
            elif action.kind in ("call", "allin"):
                acted_at[player] = current_bet
            match action.kind:
                case "fold":
                    state.fold()
                    log.append(f"{name} folds")
                    short.append("f")
                case "check":
                    if call:
                        raise InvalidHand("Cannot check when facing a bet")
                    state.check_or_call()
                    log.append(f"{name} checks")
                    short.append("x")
                case "call":
                    if not call:
                        raise InvalidHand("Cannot call when there is no bet")
                    state.check_or_call()
                    log.append(f"{name} calls {call} chips")
                    short.append("c")
                case "bet" | "raise":
                    if (action.kind == "bet") != (max(state.bets) == 0):
                        raise InvalidHand(
                            "Use bet to open and raise over an existing bet"
                        )
                    state.complete_bet_or_raise_to(action.amount)
                    verb = "bets" if action.kind == "bet" else "raises to"
                    log.append(f"{name} {verb} {action.amount} chips")
                    short.append(f"{action.kind[0]}{action.amount}")
                case "allin":
                    chips = state.stacks[player]
                    total = chips + state.bets[player]
                    if total <= max(state.bets):
                        state.check_or_call()
                    else:
                        state.complete_bet_or_raise_to(total)
                    log.append(
                        f"{name} goes all-in for {chips} chips (to {total})"
                    )
                    short.append("allin")
            reveal_board()
        if state.status:
            raise InvalidHand("The hand is not complete")
    except (ValueError, UserWarning) as exc:
        raise InvalidHand(str(exc)) from exc

    log.append(f"Hand #{hand.id} ended")
    log.append(
        "Winnings: "
        + "; ".join(
            f"Player {i + 1}: {amount:+d}"
            for i, amount in enumerate(state.payoffs)
        )
    )
    return Hand(
        id=str(hand.id),
        created_at=datetime.now(UTC),
        starting_stacks=hand.starting_stacks,
        hole_cards=hand.hole_cards,
        board=hand.board[:revealed],
        actions=[Action(**a.model_dump()) for a in hand.actions],
        final_stacks=list(state.stacks),
        payoffs=list(state.payoffs),
        log=log,
        short_actions=":".join(short),
    )
