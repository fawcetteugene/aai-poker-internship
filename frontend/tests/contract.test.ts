import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  act,
  createGame,
  legalActions,
  type ActionKind,
} from "../src/lib/poker";

const python = process.env.POKER_PYTHON ?? "../backend/.venv/bin/python";

test(
  "250 seeded browser transcripts replay identically through the Python server",
  { skip: !existsSync(python), timeout: 180_000 },
  () => {
    let seed = 74117;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const scenarios = [];
    for (let trial = 0; trial < 250; trial++) {
      const deck = [..."23456789TJQKA"].flatMap((r) =>
        [..."cdhs"].map((s) => r + s),
      );
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      const stacks = Array.from({ length: 6 }, () =>
        trial % 2 ? 1000 : 40 + Math.floor(random() * 960),
      );
      let game = createGame(stacks, deck);
      while (!game.complete) {
        assert.ok(
          game.input.actions.length < 400,
          `Hand ${trial} did not terminate`,
        );
        const legal = legalActions(game);
        const kinds: ActionKind[] = [
          "check",
          "call",
          "fold",
          "bet",
          "raise",
          "allin",
        ];
        const available = kinds.filter((kind) => legal[kind]);
        const kind = available[Math.floor(random() * available.length)];
        const to = Math.min(
          legal.maxTo,
          legal.minTo + Math.floor(random() * 4) * 40,
        );
        game = act(
          game,
          kind,
          kind === "bet" || kind === "raise" ? to : undefined,
        );
        assert.equal(
          game.players.reduce((sum, p) => sum + p.stack + p.contributed, 0),
          stacks.reduce((sum, x) => sum + x, 0),
        );
      }
      scenarios.push({
        input: game.input,
        short_actions: game.shortActions.join(":"),
        revealed: game.revealed,
        log: game.log,
      });
    }
    const result = spawnSync(python, ["../backend/tests/replay_client.py"], {
      input: JSON.stringify(scenarios),
      encoding: "utf8",
      timeout: 175_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    assert.equal(
      result.status,
      0,
      result.stderr || result.error?.message || result.stdout,
    );
    assert.match(result.stdout, /250 transcripts verified/);
  },
);
