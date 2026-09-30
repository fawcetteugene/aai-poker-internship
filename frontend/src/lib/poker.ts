/** Pure client-side betting engine. UI and networking are intentionally separate. */
export const BIG_BLIND = 40;
export const POSITIONS = ["SB", "BB", "UTG", "HJ", "CO", "D"] as const;
export const STREETS = ["Preflop", "Flop", "Turn", "River"] as const;
export type ActionKind = "fold" | "check" | "call" | "bet" | "raise" | "allin";
export type Action = { player: number; kind: ActionKind; amount?: number };
export type HandInput = {
  id: string;
  starting_stacks: number[];
  hole_cards: string[][];
  board: string[];
  actions: Action[];
};
export type SavedHand = HandInput & {
  created_at: string;
  final_stacks: number[];
  payoffs: number[];
  log: string[];
  short_actions: string;
};
export type Player = {
  stack: number;
  bet: number;
  contributed: number;
  folded: boolean;
  // null means the player has not yet faced a wager on this street.
  actedAt: number | null;
};
export type Game = {
  input: HandInput;
  players: Player[];
  street: number;
  revealed: number;
  currentBet: number;
  minRaise: number;
  pending: number[];
  actor: number | null;
  complete: boolean;
  log: string[];
  shortActions: string[];
};

export function shuffledDeck(): string[] {
  const deck = [..."23456789TJQKA"].flatMap((rank) =>
    [..."cdhs"].map((suit) => rank + suit),
  );
  // Rejection sampling avoids modulo bias in Fisher–Yates.
  for (let i = deck.length - 1; i > 0; i--) {
    const bound = Math.floor(0x100000000 / (i + 1)) * (i + 1);
    let random: number;
    do {
      random = crypto.getRandomValues(new Uint32Array(1))[0];
    } while (random >= bound);
    const j = random % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function createGame(
  stacks: number[] = Array(6).fill(1000),
  deck = shuffledDeck(),
  id = crypto.randomUUID(),
): Game {
  if (
    stacks.length !== 6 ||
    stacks.some((s) => !Number.isInteger(s) || s < 40 || s > 1_000_000)
  ) {
    throw new Error(
      "Each of the six stacks must be a whole number from 40 to 1,000,000.",
    );
  }
  if (
    deck.length < 17 ||
    new Set(deck).size !== deck.length ||
    deck.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c))
  ) {
    throw new Error("The deck must contain at least 17 distinct valid cards.");
  }
  const hole_cards = Array.from({ length: 6 }, (_, i) => [
    deck[i],
    deck[i + 6],
  ]);
  const players = stacks.map((stack, i) => {
    const blind = i === 0 ? 20 : i === 1 ? 40 : 0;
    return {
      stack: stack - blind,
      bet: blind,
      contributed: blind,
      folded: false,
      actedAt: null,
    };
  });
  return {
    input: {
      id,
      starting_stacks: [...stacks],
      hole_cards,
      board: deck.slice(12, 17),
      actions: [],
    },
    players,
    street: 0,
    revealed: 0,
    currentBet: 40,
    minRaise: 40,
    pending: [2, 3, 4, 5, 0, 1].filter((i) => players[i].stack > 0),
    actor: 2,
    complete: false,
    log: [
      ...hole_cards.map(
        (cards, i) => `Player ${i + 1} is dealt ${cards.join("")}`,
      ),
      "Player 6 is the dealer",
      "Player 1 posts small blind - 20 chips",
      "Player 2 posts big blind - 40 chips",
    ],
    shortActions: [],
  };
}

export function legalActions(game: Game) {
  const inactive = {
    fold: false,
    check: false,
    call: false,
    bet: false,
    raise: false,
    allin: false,
    callAmount: 0,
    minTo: 0,
    maxTo: 0,
  };
  if (game.complete || game.actor === null) return inactive;
  const player = game.players[game.actor];
  const owed = Math.max(0, game.currentBet - player.bet);
  const maxTo = player.bet + player.stack;
  const reopened =
    player.actedAt === null ||
    game.currentBet - player.actedAt >= game.minRaise;
  const opponentCanCall = game.players.some(
    (p, i) =>
      i !== game.actor && !p.folded && p.stack + p.bet > game.currentBet,
  );
  const canRaise = reopened && opponentCanCall && maxTo > game.currentBet;
  return {
    fold: owed > 0,
    check: owed === 0,
    call: owed > 0,
    bet: game.currentBet === 0 && canRaise,
    raise: game.currentBet > 0 && canRaise,
    allin: maxTo <= game.currentBet || canRaise,
    callAmount: Math.min(owed, player.stack),
    minTo: Math.min(maxTo, game.currentBet + game.minRaise),
    maxTo,
  };
}

function revealNext(game: Game) {
  game.street += 1;
  const next = game.street === 1 ? 3 : game.revealed + 1;
  const cards = game.input.board.slice(game.revealed, next).join("");
  game.revealed = next;
  game.log.push(`${STREETS[game.street]} cards dealt: ${cards}`);
  game.shortActions.push(cards);
}

function finish(game: Game, showdown: boolean) {
  if (showdown) while (game.street < 3) revealNext(game);
  game.complete = true;
  game.actor = null;
  game.pending = [];
  game.log.push(`Hand #${game.input.id} ended`);
}

function advance(game: Game, previousActor: number) {
  const alive = game.players
    .map((p, i) => (!p.folded ? i : -1))
    .filter((i) => i >= 0);
  if (alive.length === 1) {
    finish(game, false);
    return;
  }
  const active = alive.filter((i) => game.players[i].stack > 0);
  game.pending = game.pending.filter((i) => active.includes(i));
  // Once nobody can respond to a new wager, run the remaining board automatically.
  if (
    active.length === 0 ||
    (active.length === 1 && game.players[active[0]].bet >= game.currentBet)
  ) {
    finish(game, true);
    return;
  }
  if (!game.pending.length) {
    if (game.street === 3) {
      finish(game, true);
      return;
    }
    revealNext(game);
    game.currentBet = 0;
    game.minRaise = BIG_BLIND;
    game.players.forEach((p) => {
      p.bet = 0;
      p.actedAt = null;
    });
    game.pending = active;
    game.actor = active[0];
    return;
  }
  for (let offset = 1; offset <= 6; offset++) {
    const candidate = (previousActor + offset) % 6;
    if (game.pending.includes(candidate)) {
      game.actor = candidate;
      return;
    }
  }
  throw new Error("No player is available to act.");
}

export function act(source: Game, kind: ActionKind, amount?: number): Game {
  const legal = legalActions(source);
  if (!legal[kind] || source.actor === null)
    throw new Error(`Cannot ${kind} now.`);
  if (kind === "bet" || kind === "raise") {
    if (
      !Number.isInteger(amount) ||
      amount! < legal.minTo ||
      amount! > legal.maxTo
    ) {
      throw new Error(
        `Wager must be between ${legal.minTo} and ${legal.maxTo} chips.`,
      );
    }
  } else if (amount !== undefined) {
    throw new Error("Only bet and raise actions accept an amount.");
  }
  const game: Game = structuredClone(source);
  const actor = game.actor!;
  const player = game.players[actor];
  const name = `Player ${actor + 1}`;
  game.pending = game.pending.filter((i) => i !== actor);
  const commit = (chips: number) => {
    player.stack -= chips;
    player.bet += chips;
    player.contributed += chips;
  };
  if (kind === "fold") {
    player.folded = true;
    game.log.push(`${name} folds`);
    game.shortActions.push("f");
  } else if (kind === "check") {
    // A check does not give up the right to raise an opening short all-in.
    game.log.push(`${name} checks`);
    game.shortActions.push("x");
  } else {
    const chips =
      kind === "call"
        ? legal.callAmount
        : kind === "allin"
          ? player.stack
          : amount! - player.bet;
    commit(chips);
    if (player.bet > game.currentBet) {
      const increase = player.bet - game.currentBet;
      if (increase >= game.minRaise) game.minRaise = increase;
      game.currentBet = player.bet;
      game.pending = game.players
        .map((p, i) => (!p.folded && p.stack > 0 && i !== actor ? i : -1))
        .filter((i) => i >= 0);
    }
    player.actedAt = game.currentBet;
    if (kind === "call") {
      game.log.push(`${name} calls ${chips} chips`);
      game.shortActions.push("c");
    } else if (kind === "allin") {
      game.log.push(
        `${name} goes all-in for ${chips} chips (to ${player.bet})`,
      );
      game.shortActions.push("allin");
    } else {
      game.log.push(
        `${name} ${kind === "bet" ? "bets" : "raises to"} ${amount} chips`,
      );
      game.shortActions.push(`${kind[0]}${amount}`);
    }
  }
  game.input.actions.push({
    player: actor,
    kind,
    ...(amount !== undefined ? { amount } : {}),
  });
  advance(game, actor);
  return game;
}
