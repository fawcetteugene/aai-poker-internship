# Design and walkthrough

## One hand, two responsibilities

`frontend/src/lib/poker.ts` owns live interaction. `createGame` shuffles a standard 52-card deck using Web Crypto, assigns two cards to each seat, reserves the board, and posts blinds. `legalActions` computes allowed buttons and wager bounds. `act` returns a copied state so React rendering and tests cannot accidentally mutate a previous state. UI code never determines whose turn comes next.

The game tracks each player’s remaining stack, contribution on this street, total contribution, folded status, and the wager they last faced. `pending` identifies players still required to act. A raise gives the other active players another turn; a round closes once everyone has responded. The big blind retains an option to raise after everyone calls. Postflop action starts with the first active seat left of the dealer.

Example: preflop starts with bets `[20, 40, 0, 0, 0, 0]` and Player 3 to act. If Player 3 raises **to 140**, the increase above the big blind is 100. The next full raise must be to at least 240. A player with only 170 chips may go all-in to 170, but that 30-chip increase alone does not reopen raising for someone who already acted at 140. Multiple short all-ins reopen it when the cumulative increase faced by that player reaches the last full raise.

If only one non-folded player remains, the hand ends without revealing more cards. If multiple players remain but nobody can make another contested wager, the remaining community cards are revealed and the hand ends at showdown. The UI does not guess winners or distribute side pots.

## Server authority

The browser sends its complete initial configuration and ordered actions. Pydantic rejects malformed cards, duplicates, the wrong seat count, fractional chips, unsupported actions, and surplus fields. FastAPI passes this request to `settle_hand`.

The backend creates a fresh six-seat PokerKit state with the same blinds and no ante. It deals the supplied hole cards, checks each expected actor, distinguishes checks from calls and bets from raises, and replays every action. It also tracks each player’s last wager to enforce cumulative reopening consistently with the browser; PokerKit’s global short-all-in bookkeeping can otherwise allow some extra raises. Unknown burn cards (`??`) keep burns from randomly consuming cards reserved for the client’s board.

PokerKit evaluates the best five-card hands, creates main/side pots, returns uncalled chips, distributes ties, and computes final stacks and payoffs. An unfinished or overlong transcript is rejected. Only completed, validated hands become dataclass entities. For every completed hand, the tests assert that total chips are conserved and payoffs sum to zero.

## Storage and HTTP

`HandRepository` owns every SQL query. A pooled psycopg connection supplies transactional inserts and reads. PostgreSQL stores `id`, a server timestamp, and the serialized hand snapshot in `JSONB`; a descending timestamp/UUID index supports stable newest-first ordering. Reads explicitly rebuild `Hand` and `Action` dataclasses.

The UUID is generated once per browser hand and acts as a retry identity. `INSERT ... ON CONFLICT DO NOTHING` handles concurrent duplicates atomically. An identical retry returns the original resource and timestamp. A different validated hand with that UUID gets 409. SQL uses parameters even though the exercise did not require injection protection.

Next.js proxies `/api/*` to FastAPI on the private Compose network. The browser uses same-origin requests, so a tester needs only `localhost:3000` and no CORS configuration. Database schema creation is automatic and idempotent at backend startup. Health checks enforce database → API → frontend readiness.

## Interface and recovery

The play column and history column preserve the wireframe’s layout. The extra table illustration helps identify the current player, remaining stacks, and visible board. Generated shadcn/ui buttons, inputs, cards, badges, and labels provide the UI foundations. Responsive CSS stacks history below the game on small screens.

A completed hand is automatically POSTed. The history is then fetched with GET rather than synthesized from local state. Saving errors retain the hand and expose a retry. Reset is disabled while the completed hand is unsaved. History errors and loading states are visible independently of play. Reset of an in-progress hand deliberately discards that unfinished simulation.

## Review route

Read the client engine and its tests first, then `schemas.py` and `engine.py`, then the repository and API. Finally, follow one Playwright scenario through the page and API. The randomized contract test generates 250 reproducible browser transcripts and replays them through the actual Python settlement function; it checks that both sides agree on action order, logs, and revealed cards.

Topics to be ready to explain: why a raise amount is a street total, the big blind option, a short all-in versus a full raise, when automatic runout is legal, how PokerKit handles side pots, why client winnings are ignored, how retries avoid duplicates, and why Compose needs readiness checks.

## References

- [Original exercise](https://gist.github.com/tadas-subonis/7569c1e3a3edf8316c4ab48c1b0f3356)
- [PokerKit simulation and position conventions](https://pokerkit.readthedocs.io/en/stable/simulation.html)
- [Required Python project layout](https://github.com/martynas-subonis/py-manage/tree/main/standard)
- [REST resource guidance supplied by the exercise](https://dev.tasubo.com/2021/08/quick-practical-introduction-to-restful-apis-and-interfaces.html)
- [Repository pattern guidance supplied by the exercise](https://dev.tasubo.com/2022/07/crash-course-domain-driven-design.html#repository)
- [shadcn/ui Next.js setup](https://ui.shadcn.com/docs/installation/next)
