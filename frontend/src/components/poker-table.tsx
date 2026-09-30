"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  History,
  Minus,
  Plus,
  RotateCcw,
  Spade,
  Wifi,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listHands, saveHand } from "@/lib/api";
import {
  act,
  createGame,
  legalActions,
  POSITIONS,
  STREETS,
  type ActionKind,
  type Game,
  type SavedHand,
} from "@/lib/poker";
import { cn } from "@/lib/utils";

const suits: Record<string, string> = { c: "♣", d: "♦", h: "♥", s: "♠" };
const chips = (value: number) => value.toLocaleString("en-US");
const signed = (value: number) => `${value > 0 ? "+" : ""}${chips(value)}`;
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";

function PlayingCard({
  value,
  small = false,
}: {
  value?: string;
  small?: boolean;
}) {
  return (
    <span
      aria-label={value ?? "Undealt card"}
      className={cn(
        "playing-card",
        small && "playing-card-small",
        !value && "card-back",
        value && /[dh]$/.test(value) && "red-card",
      )}
    >
      {value ? (
        <>
          <b>{value[0] === "T" ? "10" : value[0]}</b>
          <span>{suits[value[1]]}</span>
        </>
      ) : (
        <Spade size={small ? 14 : 20} strokeWidth={1.3} />
      )}
    </span>
  );
}

function HistoryHand({ hand }: { hand: SavedHand }) {
  return (
    <article className="history-hand" data-testid="history-hand">
      <p
        className="hand-uuid"
        title={new Date(hand.created_at).toLocaleString()}
      >
        Hand #{hand.id}
      </p>
      <p>
        <strong>Stacks</strong>{" "}
        {new Set(hand.starting_stacks).size === 1
          ? chips(hand.starting_stacks[0])
          : hand.starting_stacks.join(" / ")}{" "}
        · Dealer: Player 6 · SB: Player 1 · BB: Player 2
      </p>
      <p>
        <strong>Hands</strong>{" "}
        {hand.hole_cards
          .map((cards, i) => `P${i + 1}: ${cards.join("")}`)
          .join(" · ")}
      </p>
      <p className="action-sequence">
        <strong>Actions</strong> {hand.short_actions}
      </p>
      <p className="winnings">
        <strong>Winnings</strong>{" "}
        {hand.payoffs.map((payoff, i) => (
          <span
            key={i}
            className={payoff > 0 ? "positive" : payoff < 0 ? "negative" : ""}
          >
            P{i + 1}: {signed(payoff)}{" "}
          </span>
        ))}
      </p>
    </article>
  );
}

export function PokerTable() {
  const [game, setGame] = useState<Game | null>(null);
  const [stack, setStack] = useState("1000");
  const [appliedStack, setAppliedStack] = useState(1000);
  const [amount, setAmount] = useState(80);
  const [history, setHistory] = useState<SavedHand[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedHand | null>(null);
  const [help, setHelp] = useState(false);
  const attempted = useRef<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const legal = game ? legalActions(game) : null;
  const wager = legal
    ? Math.min(legal.maxTo, Math.max(legal.minTo, amount))
    : 40;
  const unsaved = Boolean(game?.complete && saved?.id !== game.input.id);

  const refreshHistory = useCallback(async (offset = 0) => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const hands = await listHands(offset);
      setHistory((previous) =>
        offset
          ? [
              ...previous,
              ...hands.filter((h) => !previous.some((p) => p.id === h.id)),
            ]
          : hands,
      );
      setMore(hands.length === 20);
    } catch (error) {
      setHistoryError(message(error));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);
  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [game?.log.length, saved]);

  const persist = useCallback(
    async (completed: Game) => {
      setSaving(true);
      setSaveError("");
      try {
        const result = await saveHand(completed.input);
        setSaved(result);
        // History is deliberately re-fetched from the REST resource after saving.
        await refreshHistory();
      } catch (error) {
        setSaveError(message(error));
      } finally {
        setSaving(false);
      }
    },
    [refreshHistory],
  );

  useEffect(() => {
    if (game?.complete && attempted.current !== game.input.id) {
      attempted.current = game.input.id;
      void persist(game);
    }
  }, [game, persist]);

  const start = (size = appliedStack) => {
    setError("");
    setSaved(null);
    setSaveError("");
    setAmount(80);
    setGame(createGame(Array(6).fill(size)));
  };
  const applyStacks = () => {
    const value = Number(stack);
    if (!Number.isInteger(value) || value < 40 || value > 1_000_000) {
      setError("Enter a whole number from 40 to 1,000,000 chips.");
      return;
    }
    setAppliedStack(value);
    setError("");
    if (game) start(value);
  };
  const takeAction = (kind: ActionKind) => {
    if (!game) return;
    try {
      const next = act(
        game,
        kind,
        kind === "bet" || kind === "raise" ? wager : undefined,
      );
      setGame(next);
      const nextLegal = legalActions(next);
      setAmount(nextLegal.minTo);
      setError("");
    } catch (error) {
      setError(message(error));
    }
  };

  return (
    <main className="app-shell">
      <header className="site-header">
        <a href="/" className="brand">
          <span className="brand-symbol">
            <Spade size={23} fill="currentColor" />
          </span>
          <span>
            SIX HAND<span className="brand-caption">THE POKER SANDBOX</span>
          </span>
        </a>
        <div className="header-meta">
          <span className="desktop-text">A hand at a time.</span>
          <Badge variant="outline">
            <span className="live-dot" />
            6-max Hold’em
          </Badge>
        </div>
      </header>

      <div className="page-title">
        <div>
          <span className="eyebrow">TEXAS HOLD’EM / NO LIMIT</span>
          <h1>Every hand tells a story.</h1>
          <p>Play all six seats. Follow the action. See how it ends.</p>
        </div>
        <Button
          variant="ghost"
          className="help-button"
          onClick={() => setHelp(!help)}
          aria-expanded={help}
        >
          <CircleHelp size={17} />
          How to play
        </Button>
      </div>
      {help && (
        <div className="help-panel">
          <strong>You control every player.</strong> Start a hand, then choose
          an action for the highlighted seat. Blinds are 20 / 40 with no ante.
          Bet and raise amounts are the total chips committed on that street.
          The ± controls move by 40 chips. When betting ends, the hand is
          validated, settled, and saved automatically. Reset deals a fresh hand
          with all six stacks restored.
        </div>
      )}

      <div className="workspace">
        <section className="play-column" aria-label="Poker table">
          <Card className="setup-card">
            <CardContent className="setup-content">
              <div className="stack-control">
                <Label htmlFor="starting-stack">
                  Starting stack <span>per player</span>
                </Label>
                <div className="stack-input">
                  <Input
                    id="starting-stack"
                    type="number"
                    min={40}
                    max={1000000}
                    step={40}
                    value={stack}
                    onChange={(e) => setStack(e.target.value)}
                    disabled={saving || unsaved}
                  />
                  <Button
                    variant="outline"
                    onClick={applyStacks}
                    disabled={saving || unsaved}
                  >
                    Apply
                  </Button>
                </div>
              </div>
              <span className="blind-note">
                SMALL / BIG BLIND
                <strong>
                  20 / 40 <span>chips</span>
                </strong>
              </span>
              <Button
                onClick={() => start()}
                disabled={saving || unsaved}
                className="start-button"
              >
                <RotateCcw size={15} />
                {game?.input.actions.length ? "Reset" : "Start"}
              </Button>
            </CardContent>
          </Card>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <div className="table-area">
            <div className="table-topline">
              <Badge className="table-badge" variant="outline">
                {game
                  ? game.complete
                    ? "HAND COMPLETE"
                    : STREETS[game.street].toUpperCase()
                  : "READY TO DEAL"}
              </Badge>
              <span>
                TABLE 01 <span className="table-live-dot" />
              </span>
            </div>
            <div className="seats">
              {Array.from({ length: 6 }, (_, i) => {
                const player = game?.players[i];
                const active = game?.actor === i;
                const payoff =
                  saved?.id === game?.input.id ? saved?.payoffs[i] : null;
                return (
                  <div
                    key={i}
                    className={cn(
                      "seat",
                      active && "active-seat",
                      player?.folded && "folded-seat",
                    )}
                    data-testid={`player-${i + 1}`}
                  >
                    <div className="seat-heading">
                      <span className="seat-avatar">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>
                        Player {i + 1}
                        <small>
                          {player?.folded
                            ? "Folded"
                            : active
                              ? "Your action"
                              : player?.stack === 0
                                ? "All-in"
                                : ""}
                        </small>
                      </span>
                      <span
                        className={cn("position", i === 5 && "dealer-position")}
                      >
                        {POSITIONS[i]}
                      </span>
                    </div>
                    <div className="hole-cards">
                      <PlayingCard small value={game?.input.hole_cards[i][0]} />
                      <PlayingCard small value={game?.input.hole_cards[i][1]} />
                      <div className="seat-stack">
                        {chips(
                          saved?.id === game?.input.id && saved
                            ? saved.final_stacks[i]
                            : (player?.stack ?? appliedStack),
                        )}
                        <span>
                          {payoff !== null && payoff !== undefined
                            ? signed(payoff) + " net"
                            : "chips"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="board-area">
              <span className="board-label">COMMUNITY CARDS</span>
              <div className="community-cards">
                {Array.from({ length: 5 }, (_, i) => (
                  <PlayingCard
                    key={i}
                    value={
                      game && i < game.revealed
                        ? game.input.board[i]
                        : undefined
                    }
                  />
                ))}
              </div>
              <div className="pot">
                <span>TOTAL COMMITTED</span>
                <strong>
                  {chips(
                    game?.players.reduce((sum, p) => sum + p.contributed, 0) ??
                      0,
                  )}{" "}
                  <small>chips</small>
                </strong>
              </div>
            </div>
            <div className="table-caption">
              <Spade size={13} />
              {game
                ? game.complete
                  ? "That’s a wrap. Deal another story."
                  : `Player ${game.actor! + 1} to act · ${legal?.callAmount ? `${legal.callAmount} chips to call` : "You can check"}`
                : "Six seats. A fresh deck. Your next move."}
            </div>
          </div>

          <Card className="log-card">
            <CardContent className="log-content">
              <div className="section-heading">
                <h2>
                  <span className="small-line" />
                  Play log
                </h2>
                <span>{game?.input.actions.length ?? 0} actions</span>
              </div>
              <div
                className="play-log"
                ref={logRef}
                role="log"
                aria-label="Live play log"
                aria-live="polite"
              >
                {game ? (
                  (saved?.id === game.input.id ? saved.log : game.log).map(
                    (line, i) => (
                      <div
                        key={i}
                        className={cn(
                          "log-line",
                          /cards dealt|ended|Winnings/.test(line) &&
                            "log-highlight",
                        )}
                      >
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        <p>{line}</p>
                      </div>
                    ),
                  )
                ) : (
                  <div className="log-empty">
                    <ArrowDown size={18} />
                    <p>
                      Your hand starts here.
                      <span>Press Start to deal the cards.</span>
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="action-panel">
            <div className="action-heading">
              <span>
                {game && !game.complete ? (
                  <>
                    <span className="live-dot" />
                    PLAYER {game.actor! + 1} TO ACT
                  </>
                ) : (
                  "MAKE YOUR MOVE"
                )}
              </span>
              <span>All amounts in chips</span>
            </div>
            <div className="action-buttons">
              <Button
                variant="outline"
                onClick={() => takeAction("fold")}
                disabled={!legal?.fold}
              >
                Fold
              </Button>
              <Button
                variant="outline"
                onClick={() => takeAction("check")}
                disabled={!legal?.check}
              >
                Check
              </Button>
              <Button
                variant="secondary"
                onClick={() => takeAction("call")}
                disabled={!legal?.call}
              >
                Call{legal?.call ? ` ${legal.callAmount}` : ""}
              </Button>
              <div className="wager-control">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Decrease wager by 40"
                  onClick={() => setAmount(wager - 40)}
                  disabled={
                    !legal ||
                    !(legal.bet || legal.raise) ||
                    wager - 40 < legal.minTo
                  }
                >
                  <Minus size={14} />
                </Button>
                <Input
                  type="number"
                  aria-label="Bet or raise total"
                  min={legal?.minTo ?? 40}
                  max={legal?.maxTo ?? 1000}
                  value={wager || 40}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isFinite(value)) setAmount(Math.trunc(value));
                  }}
                  disabled={!legal?.bet && !legal?.raise}
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Increase wager by 40"
                  onClick={() => setAmount(wager + 40)}
                  disabled={
                    !legal ||
                    !(legal.bet || legal.raise) ||
                    wager + 40 > legal.maxTo
                  }
                >
                  <Plus size={14} />
                </Button>
              </div>
              <Button onClick={() => takeAction("bet")} disabled={!legal?.bet}>
                Bet {wager || 40}
              </Button>
              <Button
                onClick={() => takeAction("raise")}
                disabled={!legal?.raise}
              >
                Raise to {wager || 80}
              </Button>
              <Button
                variant="outline"
                className="allin-button"
                onClick={() => takeAction("allin")}
                disabled={!legal?.allin}
              >
                All-in
                <ArrowUpRight size={14} />
              </Button>
            </div>
            <p className="action-hint">
              {legal?.raise
                ? `Minimum raise to ${legal.minTo}. Raise amounts include chips already committed this round.`
                : legal?.bet
                  ? `Minimum bet ${legal.minTo}.`
                  : "Available actions follow the current player’s stack and the betting round."}
            </p>
          </div>
          <div
            aria-live="polite"
            className={cn("save-status", saveError && "error-message")}
          >
            {saving ? (
              "Validating and saving hand…"
            ) : saveError ? (
              <>
                {saveError}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => game && void persist(game)}
                >
                  Retry save
                </Button>
              </>
            ) : saved ? (
              <>
                <Check size={15} />
                Hand saved. Winnings are shown at each seat.
              </>
            ) : (
              <>
                <Wifi size={14} />
                Completed hands are saved automatically.
              </>
            )}
          </div>
        </section>

        <aside className="history-column" aria-label="Saved hand history">
          <div className="history-heading">
            <div>
              <span className="eyebrow">THE RECORD</span>
              <h2>
                Hand history <span>{history.length}</span>
              </h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Refresh hand history"
              disabled={historyLoading}
              onClick={() => void refreshHistory()}
            >
              <RotateCcw size={16} />
            </Button>
          </div>
          <p className="history-description">
            Every finished hand, kept for the next look.
          </p>
          {historyError && (
            <div role="alert" className="error-message">
              {historyError}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshHistory()}
              >
                Retry history
              </Button>
            </div>
          )}
          {historyLoading && !history.length ? (
            <p className="history-loading">Loading hands…</p>
          ) : history.length ? (
            <div className="history-list">
              {history.map((hand) => (
                <HistoryHand hand={hand} key={hand.id} />
              ))}
            </div>
          ) : (
            !historyError && (
              <div className="history-empty">
                <div className="history-empty-icon">
                  <History size={26} strokeWidth={1.3} />
                </div>
                <h3>A clean slate.</h3>
                <p>
                  Finish your first hand and
                  <br />
                  it will find a home here.
                </p>
                <div className="empty-card-stack">
                  <span />
                  <span />
                  <span>
                    <Spade size={21} />
                  </span>
                </div>
              </div>
            )
          )}
          {more && (
            <Button
              className="load-more"
              variant="outline"
              onClick={() => void refreshHistory(history.length)}
              disabled={historyLoading}
            >
              Load more
              <ChevronDown size={15} />
            </Button>
          )}
          <div className="history-footer">
            <span className="live-dot" /> Saved hands survive a refresh.
          </div>
        </aside>
      </div>
      <footer className="site-footer">
        <span>
          SIX HAND <span> / </span> BUILT FOR THE LOVE OF THE GAME
        </span>
        <span>
          6 PLAYERS <span>·</span> NO ANTE <span>·</span> 20 / 40 BLINDS
        </span>
      </footer>
    </main>
  );
}
