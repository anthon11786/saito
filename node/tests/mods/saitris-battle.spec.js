const {
  createEmptyBoard,
  calculateGarbageLines,
  calculateComboBonus,
  nextComboCounter,
  applyGarbageLines,
  applyGarbageLinesWithHoles,
  createRng,
  createInitialState,
  determineWinner,
  normalizeInviteType,
  isStakeReady,
  computeInputApplyTick,
  SaitrisBattleEngine
} = require('../../mods/saitris-battle/lib/saitris-battle-engine');

describe('saitris-battle engine', () => {
  test('garbage lines follow n-1 rule', () => {
    expect(calculateGarbageLines(2)).toBe(1);
    expect(calculateGarbageLines(4)).toBe(3);
  });

  test('combo counter increments on clears and resets on non-clear', () => {
    let combo = -1;
    combo = nextComboCounter(combo, 1);
    expect(combo).toBe(0);
    expect(calculateComboBonus(combo)).toBe(0);

    combo = nextComboCounter(combo, 1);
    expect(combo).toBe(1);
    expect(calculateComboBonus(combo)).toBe(1);

    combo = nextComboCounter(combo, 0);
    expect(combo).toBe(-1);
    expect(calculateComboBonus(combo)).toBe(0);
  });

  test('garbage events apply consistent holes and update lines sent', () => {
    let engine = new SaitrisBattleEngine({ sessionSeed: 'seed' });
    engine.applyGarbageEvent({ sourceIndex: 0, targetIndex: 1, holes: [1, 3, 5] });
    expect(engine.state.players[0].linesSent).toBe(3);
    let board = createEmptyBoard();
    let updated = applyGarbageLinesWithHoles(board, [1, 3, 5]);
    expect(updated[19].filter((cell) => cell === 0).length).toBe(1);
  });

  test('garbage lines insert single hole at bottom', () => {
    let board = createEmptyBoard();
    let rng = createRng(42);
    let updated = applyGarbageLines(board, 2, rng);

    expect(updated.length).toBe(20);
    let bottomRow = updated[19];
    let holeCount = bottomRow.filter((cell) => cell === 0).length;
    expect(holeCount).toBe(1);
  });

  test('knockout logic determines winner by knockouts', () => {
    let state = createInitialState({ sessionSeed: 'seed', startTick: 0 });
    state.players[0].knockouts = 3;
    expect(determineWinner(state)).toBe(0);
  });

  test('stake readiness gating', () => {
    expect(isStakeReady({ crypto: 'SAITO', stake: 2, stakeAccepted: false })).toBe(false);
    expect(isStakeReady({ crypto: 'SAITO', stake: 2, stakeAccepted: true })).toBe(true);
    expect(isStakeReady({ crypto: 'SAITO', stake: 0, stakeAccepted: false })).toBe(true);
  });

  test('invite-only match creation uses private invite type', () => {
    expect(normalizeInviteType('private')).toBe('private');
  });

  test('engine advances ticks and ends match on timer', () => {
    let engine = new SaitrisBattleEngine({ sessionSeed: 'seed', tickMs: 100, startTick: 0 });
    engine.start(Date.now() - 120000);
    engine.advanceToTick(engine.getCurrentTick(Date.now()));
    expect(engine.state.matchOver).toBe(true);
    expect(['timer', 'knockouts']).toContain(engine.state.reason);
  });
});

describe('saitris-battle solo', () => {
  test('solo engine builds a single player and keeps 2p seeds untouched', () => {
    let solo = createInitialState({ sessionSeed: 'seed', startTick: 0, playerCount: 1 });
    let versus = createInitialState({ sessionSeed: 'seed', startTick: 0 });

    expect(solo.players.length).toBe(1);
    expect(versus.players.length).toBe(2);
    expect(solo.players[0].pieceRngState).toBe(versus.players[0].pieceRngState);
  });

  test('solo run ends on top out, never on knockouts', () => {
    let engine = new SaitrisBattleEngine({ sessionSeed: 'seed', playerCount: 1 });
    let player = engine.state.players[0];

    // fill every cell but the last column, so nothing clears and no spawn fits
    player.board = player.board.map((row) => row.map((cell, x) => (x === 9 ? 0 : 7)));
    player.active = null;

    engine.start(Date.now());
    engine.advanceToTick(15);

    expect(engine.state.matchOver).toBe(true);
    expect(engine.state.reason).toBe('topout');
    expect(engine.state.players[0].knockouts).toBe(0);
  });

  test('solo clears count as lines sent with no opponent to garbage', () => {
    let engine = new SaitrisBattleEngine({ sessionSeed: 'seed', playerCount: 1 });
    let emitted = 0;
    engine.onGarbage = () => { emitted += 1; };

    let player = engine.state.players[0];
    // rows 18 and 19 full except columns 4 and 5, which an O piece fills exactly
    for (let y of [18, 19]) {
      player.board[y] = player.board[y].map((cell, x) => (x === 4 || x === 5 ? 0 : 7));
    }
    player.active = 'O';
    player.rotation = 0;
    player.x = 3;
    player.y = 18;

    engine.lockAndSpawn(0, createRng(1), createRng(2), 0);

    expect(emitted).toBe(0);
    expect(engine.state.players[0].linesSent).toBeGreaterThan(0);
  });

  test('checksum round-trips for both player counts', () => {
    for (let playerCount of [1, 2]) {
      let engine = new SaitrisBattleEngine({ sessionSeed: 'seed', playerCount });
      let checksum = engine.getStateChecksum();
      expect(checksum.split('|').length).toBe(playerCount);

      engine.state.players[0].linesSent = 41;
      engine.applyStateSync(checksum);
      expect(engine.state.players[0].linesSent).toBe(0);
    }
  });
});

describe('saitris-battle inputs', () => {
  test('hard drop queues after pending movement inputs', () => {
    let engine = {
      inputBufferTicks: 1,
      inputsByTick: new Map([[12, [{ playerIndex: 0, action: 'move_left', seq: 0 }]]]),
      getCurrentTick: () => 10
    };

    let applyTick = computeInputApplyTick({
      engine,
      playerIndex: 0,
      action: 'hard_drop',
      nowMs: 1234
    });

    expect(applyTick).toBe(13);
  });
});

