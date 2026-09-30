import { test } from "node:test";
import assert from "node:assert/strict";
import { act, createGame, legalActions, shuffledDeck } from "../src/lib/poker";

test("blinds, six seats, unique cards, and first legal actions", () => {
  const game = createGame();
  assert.equal(game.actor, 2);
  assert.deepEqual(
    game.players.map((p) => p.stack),
    [980, 960, 1000, 1000, 1000, 1000],
  );
  assert.equal(
    new Set([...game.input.hole_cards.flat(), ...game.input.board]).size,
    17,
  );
  assert.equal(legalActions(game).check, false);
  assert.equal(legalActions(game).bet, false);
  assert.equal(legalActions(game).callAmount, 40);
  assert.equal(legalActions(game).minTo, 80);
  assert.equal(shuffledDeck().length, 52);
});

test("folding to the big blind completes without revealing the board", () => {
  let game = createGame();
  for (let i = 0; i < 5; i++) game = act(game, "fold");
  assert.equal(game.complete, true);
  assert.equal(game.actor, null);
  assert.equal(game.revealed, 0);
  assert.equal(legalActions(game).allin, false);
  assert.throws(() => act(game, "check"));
});

test("a check-down preserves the big blind option and plays all four streets", () => {
  let game = createGame();
  for (let i = 0; i < 5; i++) game = act(game, "call");
  assert.equal(game.actor, 1);
  assert.equal(game.street, 0);
  assert.equal(legalActions(game).call, false);
  assert.equal(legalActions(game).fold, false);
  game = act(game, "check");
  assert.equal(game.street, 1);
  assert.equal(game.actor, 0);
  for (let i = 0; i < 18; i++) game = act(game, "check");
  assert.equal(game.complete, true);
  assert.equal(game.revealed, 5);
  assert.equal(game.input.actions.length, 24);
  assert.deepEqual(
    game.players.map((p) => p.contributed),
    Array(6).fill(40),
  );
});

test("minimum raise tracks the last full increase, and transitions are immutable", () => {
  const original = createGame();
  const raised = act(original, "raise", 140);
  assert.equal(original.players[2].stack, 1000);
  assert.equal(legalActions(raised).minTo, 240);
  assert.throws(() => act(raised, "raise", 180));
  assert.throws(() => act(original, "check"));
  assert.throws(() => act(original, "bet", 80));
  assert.throws(() => act(original, "raise", 1001));
});

test("a short all-in does not reopen a previously completed raise", () => {
  let game = createGame([1000, 1000, 1000, 100, 1000, 1000]);
  game = act(game, "raise", 80);
  game = act(game, "allin");
  for (let i = 0; i < 4; i++) game = act(game, "call");
  assert.equal(game.actor, 2);
  assert.equal(legalActions(game).callAmount, 20);
  assert.equal(legalActions(game).raise, false);
  assert.equal(legalActions(game).allin, false);
  game = act(game, "call");
  assert.equal(game.street, 1);
});

test("cumulative short all-ins reopen a full raise", () => {
  let game = createGame([1000, 1000, 1000, 100, 120, 1000]);
  game = act(game, "raise", 80);
  game = act(game, "allin");
  game = act(game, "allin");
  for (let i = 0; i < 3; i++) game = act(game, "call");
  assert.equal(game.actor, 2);
  assert.equal(legalActions(game).raise, true);
  assert.equal(legalActions(game).minTo, 160);
});

test("all-ins run out automatically and retain total chip accounting", () => {
  let game = createGame([100, 200, 300, 400, 500, 600]);
  while (!game.complete) {
    const legal = legalActions(game);
    game = act(game, legal.allin ? "allin" : legal.call ? "call" : "check");
  }
  assert.equal(game.revealed, 5);
  assert.equal(
    game.players.reduce((n, p) => n + p.stack + p.contributed, 0),
    2100,
  );
});

test("invalid stacks and duplicated cards are rejected", () => {
  assert.throws(() => createGame(Array(6).fill(39)));
  assert.throws(() => createGame(Array(6).fill(100.5)));
  assert.throws(() => createGame(Array(5).fill(1000)));
  assert.throws(() => createGame(Array(6).fill(1000), Array(52).fill("As")));
});
