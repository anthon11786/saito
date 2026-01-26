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
} = require('../mods/saitris-battle/lib/saitris-battle-engine');

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

