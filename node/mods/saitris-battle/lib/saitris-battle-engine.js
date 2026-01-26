const DEFAULT_TICK_MS = 100;
const DEFAULT_INPUT_BUFFER_TICKS = 1;
const DEFAULT_ROLLBACK_WINDOW_TICKS = 50;
const MATCH_DURATION_MS = 120000;
const MAX_HISTORY_TICKS = 200;
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BAG_PIECES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

const PIECES = {
  I: [
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1]
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3]
    ],
    [
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2]
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3]
    ]
  ],
  O: [
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1]
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1]
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1]
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1]
    ]
  ],
  T: [
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1]
    ],
    [
      [1, 0],
      [1, 1],
      [2, 1],
      [1, 2]
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [1, 2]
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, 2]
    ]
  ],
  S: [
    [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1]
    ],
    [
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2]
    ],
    [
      [1, 1],
      [2, 1],
      [0, 2],
      [1, 2]
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2]
    ]
  ],
  Z: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1]
    ],
    [
      [2, 0],
      [1, 1],
      [2, 1],
      [1, 2]
    ],
    [
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2]
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2]
    ]
  ],
  J: [
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1]
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [1, 2]
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 2]
    ],
    [
      [1, 0],
      [1, 1],
      [0, 2],
      [1, 2]
    ]
  ],
  L: [
    [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1]
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 2]
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [0, 2]
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2]
    ]
  ]
};

function hashStringToSeed(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    getState() {
      return state >>> 0;
    },
    setState(nextState) {
      state = nextState >>> 0;
    }
  };
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function createEmptyBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
}

function calculateGarbageLines(linesCleared) {
  return Math.max(0, linesCleared - 1);
}

function calculateComboBonus(comboCounter) {
  return Math.max(0, comboCounter);
}

function nextComboCounter(current, linesCleared) {
  if (linesCleared > 0) {
    return current + 1;
  }
  return -1;
}

function applyGarbageLinesWithHoles(board, holes) {
  let updated = board.map((row) => row.slice());
  for (let holeIndex of holes) {
    let garbageRow = Array(BOARD_WIDTH).fill(8);
    garbageRow[holeIndex] = 0;
    updated.shift();
    updated.push(garbageRow);
  }
  return updated;
}

function applyGarbageLines(board, count, rng) {
  let updated = board.map((row) => row.slice());
  for (let i = 0; i < count; i++) {
    let holeIndex = Math.floor(rng.next() * BOARD_WIDTH);
    let garbageRow = Array(BOARD_WIDTH).fill(8);
    garbageRow[holeIndex] = 0;
    updated.shift();
    updated.push(garbageRow);
  }
  return updated;
}

function createPlayerState(seed, garbageSeed) {
  return {
    board: createEmptyBoard(),
    active: null,
    rotation: 0,
    x: 3,
    y: 0,
    hold: null,
    canHold: true,
    nextQueue: [],
    bag: [],
    pieceRngState: seed,
    garbageRngState: garbageSeed,
    softDrop: false,
    dropCounter: 0,
    pendingGarbageHoles: [],
    linesSent: 0,
    knockouts: 0,
    comboCounter: -1
  };
}

function createInitialState({ sessionSeed, startTick }) {
  let p1Seed = hashStringToSeed(`${sessionSeed}-p1-${startTick}`);
  let p2Seed = hashStringToSeed(`${sessionSeed}-p2-${startTick}`);
  let p1GarbageSeed = hashStringToSeed(`${sessionSeed}-g1-${startTick}`);
  let p2GarbageSeed = hashStringToSeed(`${sessionSeed}-g2-${startTick}`);

  return {
    sessionSeed,
    startTick,
    tick: 0,
    matchOver: false,
    winner: null,
    reason: '',
    players: [createPlayerState(p1Seed, p1GarbageSeed), createPlayerState(p2Seed, p2GarbageSeed)]
  };
}

function getPieceCells(type, rotation) {
  return PIECES[type][rotation % 4];
}

function isValidPosition(player, type, rotation, x, y) {
  let cells = getPieceCells(type, rotation);
  for (let [dx, dy] of cells) {
    let nx = x + dx;
    let ny = y + dy;
    if (nx < 0 || nx >= BOARD_WIDTH || ny >= BOARD_HEIGHT) {
      return false;
    }
    if (ny >= 0 && player.board[ny][nx] !== 0) {
      return false;
    }
  }
  return true;
}

function lockPiece(player) {
  let cells = getPieceCells(player.active, player.rotation);
  for (let [dx, dy] of cells) {
    let nx = player.x + dx;
    let ny = player.y + dy;
    if (ny >= 0 && ny < BOARD_HEIGHT) {
      player.board[ny][nx] = BAG_PIECES.indexOf(player.active) + 1;
    }
  }
}

function clearLines(player) {
  let cleared = 0;
  player.board = player.board.filter((row) => {
    if (row.every((cell) => cell !== 0)) {
      cleared += 1;
      return false;
    }
    return true;
  });
  while (player.board.length < BOARD_HEIGHT) {
    player.board.unshift(Array(BOARD_WIDTH).fill(0));
  }
  return cleared;
}

function refillQueue(player, rng) {
  if (player.bag.length === 0) {
    let bag = BAG_PIECES.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      let j = Math.floor(rng.next() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    player.bag = bag;
  }
  while (player.nextQueue.length < 5) {
    if (player.bag.length === 0) {
      refillQueue(player, rng);
      return;
    }
    player.nextQueue.push(player.bag.shift());
  }
}

function spawnPiece(player, pieceRng, garbageRng) {
  if (player.pendingGarbageHoles.length > 0) {
    player.board = applyGarbageLinesWithHoles(player.board, player.pendingGarbageHoles);
    player.pendingGarbageHoles = [];
  }

  refillQueue(player, pieceRng);
  player.active = player.nextQueue.shift();
  player.rotation = 0;
  player.x = 3;
  player.y = 0;
  player.canHold = true;
  player.dropCounter = 0;
}

function hardDrop(player) {
  while (isValidPosition(player, player.active, player.rotation, player.x, player.y + 1)) {
    player.y += 1;
  }
}

function rotatePiece(player, direction) {
  let nextRotation = (player.rotation + direction + 4) % 4;
  if (isValidPosition(player, player.active, nextRotation, player.x, player.y)) {
    player.rotation = nextRotation;
  }
}

function movePiece(player, dx, dy) {
  if (isValidPosition(player, player.active, player.rotation, player.x + dx, player.y + dy)) {
    player.x += dx;
    player.y += dy;
    return true;
  }
  return false;
}

function holdPiece(player, pieceRng, garbageRng) {
  if (!player.canHold) {
    return;
  }
  let current = player.active;
  if (player.hold) {
    player.active = player.hold;
    player.rotation = 0;
    player.x = 3;
    player.y = 0;
    player.hold = current;
  } else {
    player.hold = current;
    player.active = null;
    spawnPiece(player, pieceRng, garbageRng);
  }
  player.canHold = false;
}

function determineWinner(state) {
  let p1 = state.players[0];
  let p2 = state.players[1];
  if (p1.knockouts !== p2.knockouts) {
    return p1.knockouts > p2.knockouts ? 0 : 1;
  }
  if (p1.linesSent !== p2.linesSent) {
    return p1.linesSent > p2.linesSent ? 0 : 1;
  }
  return null;
}

function normalizeInviteType(type) {
  if (type === 'private') {
    return 'private';
  }
  if (type === 'public') {
    return 'public';
  }
  return 'public';
}

function isStakeReady({ crypto, stake, stakeAccepted }) {
  if (!crypto) {
    return true;
  }
  if (stake === undefined || stake === null) {
    return true;
  }
  let amount = typeof stake === 'object' ? stake.min : stake;
  if (parseFloat(amount) === 0) {
    return true;
  }
  return Boolean(stakeAccepted);
}

function computeInputApplyTick({ engine, playerIndex, action, nowMs }) {
  let currentTick = engine.getCurrentTick(nowMs);
  let applyTick = currentTick + engine.inputBufferTicks;
  if (action !== 'hard_drop') {
    return applyTick;
  }
  if (!engine.inputsByTick) {
    return applyTick;
  }
  let maxQueuedTick = applyTick;
  for (let [tick, inputs] of engine.inputsByTick.entries()) {
    if (tick < maxQueuedTick) {
      continue;
    }
    if (inputs.some((input) => input.playerIndex === playerIndex)) {
      maxQueuedTick = tick + 1;
    }
  }
  return maxQueuedTick;
}

class SaitrisBattleEngine {
  constructor({
    sessionSeed,
    startTick = 0,
    tickMs = DEFAULT_TICK_MS,
    inputBufferTicks = DEFAULT_INPUT_BUFFER_TICKS,
    rollbackWindowTicks = DEFAULT_ROLLBACK_WINDOW_TICKS
  }) {
    this.tickMs = tickMs;
    this.inputBufferTicks = inputBufferTicks;
    this.rollbackWindowTicks = rollbackWindowTicks;
    this.matchDurationTicks = Math.ceil(MATCH_DURATION_MS / tickMs);
    this.state = createInitialState({ sessionSeed, startTick });
    this.inputsByTick = new Map();
    this.history = new Map();
    this.lastProcessedTick = -1;
    this.startTimeMs = null;
    this.timeOffsetMs = 0;
    this.inputKeys = new Set();
    this.garbageByTick = new Map();
    this.garbageMode = 'event';
    this.onGarbage = null;
    this.onKO = null;
    this.authoritativePlayerIndex = null;
  }

  start(startTimeMs, timeOffsetMs = 0) {
    this.startTimeMs = startTimeMs;
    this.timeOffsetMs = timeOffsetMs;
  }

  getCurrentTick(nowMs) {
    if (!this.startTimeMs) {
      return 0;
    }
    let adjustedNow = nowMs + this.timeOffsetMs;
    let elapsed = Math.max(0, adjustedNow - this.startTimeMs);
    return Math.floor(elapsed / this.tickMs);
  }

  isAuthoritativeFor(playerIndex) {
    if (this.authoritativePlayerIndex === null || this.authoritativePlayerIndex === undefined) {
      return true;
    }
    return playerIndex === this.authoritativePlayerIndex;
  }

  queueInput({ playerIndex, action, tick, seq }) {
    let dedupeKey = `${playerIndex}:${tick}:${seq}:${action}`;
    if (this.inputKeys.has(dedupeKey)) {
      return { accepted: true, reason: 'duplicate' };
    }
    if (tick < this.lastProcessedTick - this.rollbackWindowTicks) {
      return { accepted: false, reason: 'late' };
    }

    if (!this.inputsByTick.has(tick)) {
      this.inputsByTick.set(tick, []);
    }
    this.inputsByTick.get(tick).push({ playerIndex, action, seq });
    this.inputKeys.add(dedupeKey);
    if (tick <= this.lastProcessedTick) {
      this.rollbackToTick(tick);
    }
    return { accepted: true };
  }

  rollbackToTick(targetTick) {
    let snapshot = this.history.get(targetTick);
    if (!snapshot) {
      return;
    }
    let originalTick = this.lastProcessedTick;
    this.state = cloneState(snapshot);
    this.lastProcessedTick = targetTick - 1;
    this.advanceToTick(originalTick);
  }

  applyInputsForTick(tick) {
    let inputs = this.inputsByTick.get(tick) || [];
    inputs.sort((a, b) => (a.seq || 0) - (b.seq || 0));
    for (let input of inputs) {
      this.applyInput(input.playerIndex, input.action, tick);
    }
  }

  applyGarbageEvent({ sourceIndex, targetIndex, holes }) {
    let source = this.state.players[sourceIndex];
    let target = this.state.players[targetIndex];
    source.linesSent += holes.length;
    target.pendingGarbageHoles = target.pendingGarbageHoles.concat(holes);
  }

  queueGarbageEvent({ sourceIndex, targetIndex, holes, tick }) {
    if (tick === undefined || tick === null) {
      this.applyGarbageEvent({ sourceIndex, targetIndex, holes });
      return;
    }
    if (!this.garbageByTick.has(tick)) {
      this.garbageByTick.set(tick, []);
    }
    this.garbageByTick.get(tick).push({ sourceIndex, targetIndex, holes });
    if (tick <= this.lastProcessedTick) {
      this.rollbackToTick(tick);
    }
  }

  applyGarbageForTick(tick) {
    let events = this.garbageByTick.get(tick);
    if (!events) {
      return;
    }
    events.sort((a, b) => {
      let aKey = `${a.sourceIndex}:${a.targetIndex}:${a.holes.join(',')}`;
      let bKey = `${b.sourceIndex}:${b.targetIndex}:${b.holes.join(',')}`;
      if (aKey < bKey) return -1;
      if (aKey > bKey) return 1;
      return 0;
    });
    for (let evt of events) {
      this.applyGarbageEvent(evt);
    }
  }

  applyInput(playerIndex, action, currentTick) {
    let player = this.state.players[playerIndex];
    let pieceRng = createRng(player.pieceRngState);
    let garbageRng = createRng(player.garbageRngState);
    pieceRng.setState(player.pieceRngState);
    garbageRng.setState(player.garbageRngState);

    if (!player.active) {
      spawnPiece(player, pieceRng, garbageRng);
    }

    switch (action) {
    case 'move_left':
      movePiece(player, -1, 0);
      break;
    case 'move_right':
      movePiece(player, 1, 0);
      break;
    case 'rotate_ccw':
      rotatePiece(player, -1);
      break;
    case 'rotate_cw':
      rotatePiece(player, 1);
      break;
    case 'soft_drop_on':
      player.softDrop = true;
      break;
    case 'soft_drop_off':
      player.softDrop = false;
      break;
    case 'hard_drop':
      hardDrop(player);
      this.lockAndSpawn(playerIndex, pieceRng, garbageRng, currentTick);
      break;
    case 'hold':
      holdPiece(player, pieceRng, garbageRng);
      break;
    default:
      break;
    }

    player.pieceRngState = pieceRng.getState();
    player.garbageRngState = garbageRng.getState();
  }

  lockAndSpawn(playerIndex, pieceRng, garbageRng, currentTick) {
    let player = this.state.players[playerIndex];
    let opponent = this.state.players[1 - playerIndex];
    if (!player.active) {
      spawnPiece(player, pieceRng, garbageRng);
    }
    lockPiece(player);
    let cleared = clearLines(player);
    player.comboCounter = nextComboCounter(player.comboCounter, cleared);
    if (cleared > 0) {
      if (this.isAuthoritativeFor(playerIndex)) {
        let baseGarbage = calculateGarbageLines(cleared);
        let comboBonus = calculateComboBonus(player.comboCounter);
        let totalGarbage = baseGarbage + comboBonus;
        let holes = [];
        for (let i = 0; i < totalGarbage; i++) {
          holes.push(Math.floor(garbageRng.next() * BOARD_WIDTH));
        }
        if (this.garbageMode === 'event' && this.onGarbage) {
          this.onGarbage({
            sourceIndex: playerIndex,
            targetIndex: 1 - playerIndex,
            holes,
            tick: (currentTick !== undefined ? currentTick : this.state.tick) + 1
          });
        } else {
          opponent.pendingGarbageHoles = opponent.pendingGarbageHoles.concat(holes);
          player.linesSent += totalGarbage;
        }
      }
    }
    spawnPiece(player, pieceRng, garbageRng);

    if (!isValidPosition(player, player.active, player.rotation, player.x, player.y)) {
      if (this.isAuthoritativeFor(playerIndex)) {
        this.applyKOEvent({ playerIndex, opponentIndex: 1 - playerIndex });
        if (this.onKO) {
          this.onKO({
            playerIndex,
            opponentIndex: 1 - playerIndex,
            tick: currentTick !== undefined ? currentTick : this.state.tick
          });
        }
      }
    }
  }

  processTick() {
    for (let i = 0; i < this.state.players.length; i++) {
      let player = this.state.players[i];
      let pieceRng = createRng(player.pieceRngState);
      let garbageRng = createRng(player.garbageRngState);
      pieceRng.setState(player.pieceRngState);
      garbageRng.setState(player.garbageRngState);

      if (!player.active) {
        spawnPiece(player, pieceRng, garbageRng);
      }

      player.dropCounter += 1;
      let dropInterval = player.softDrop ? 2 : 10;
      if (player.dropCounter >= dropInterval) {
        let moved = movePiece(player, 0, 1);
        if (!moved) {
          this.lockAndSpawn(i, pieceRng, garbageRng, this.state.tick);
        }
        player.dropCounter = 0;
      }

      player.pieceRngState = pieceRng.getState();
      player.garbageRngState = garbageRng.getState();
    }
  }

  advanceToTick(targetTick) {
    while (this.lastProcessedTick < targetTick && !this.state.matchOver) {
      let nextTick = this.lastProcessedTick + 1;
      this.history.set(nextTick, cloneState(this.state));

      // Prune old history
      if (this.history.size > MAX_HISTORY_TICKS) {
        let oldestTick = nextTick - MAX_HISTORY_TICKS;
        this.history.delete(oldestTick);
      }

      this.applyInputsForTick(nextTick);
      this.applyGarbageForTick(nextTick);
      this.processTick();
      this.lastProcessedTick = nextTick;
      this.state.tick = nextTick;

      if (this.state.players[0].knockouts >= 3 || this.state.players[1].knockouts >= 3) {
        let winnerIndex = determineWinner(this.state);
        this.state.matchOver = true;
        this.state.winner = winnerIndex;
        this.state.reason = 'knockouts';
        break;
      }

      if (nextTick >= this.matchDurationTicks) {
        let winnerIndex = determineWinner(this.state);
        this.state.matchOver = true;
        this.state.winner = winnerIndex;
        this.state.reason = 'timer';
        break;
      }
    }
  }

  getStateChecksum() {
    let p1 = this.state.players[0];
    let p2 = this.state.players[1];
    return `${p1.knockouts},${p1.linesSent},${p1.pieceRngState},${p1.garbageRngState},${p1.active}|${p2.knockouts},${p2.linesSent},${p2.pieceRngState},${p2.garbageRngState},${p2.active}`;
  }

  applyStateSync(checksum) {
    let [p1Data, p2Data] = checksum.split('|');
    let [p1KO, p1Lines, p1PRng, p1GRng, p1Active] = p1Data.split(',');
    let [p2KO, p2Lines, p2PRng, p2GRng, p2Active] = p2Data.split(',');

    this.state.players[0].knockouts = parseInt(p1KO);
    this.state.players[0].linesSent = parseInt(p1Lines);
    this.state.players[0].pieceRngState = parseInt(p1PRng);
    this.state.players[0].garbageRngState = parseInt(p1GRng);
    this.state.players[0].active = p1Active === 'null' ? null : p1Active;

    this.state.players[1].knockouts = parseInt(p2KO);
    this.state.players[1].linesSent = parseInt(p2Lines);
    this.state.players[1].pieceRngState = parseInt(p2PRng);
    this.state.players[1].garbageRngState = parseInt(p2GRng);
    this.state.players[1].active = p2Active === 'null' ? null : p2Active;
  }

  applyKOEvent({ playerIndex, opponentIndex }) {
    let player = this.state.players[playerIndex];
    let opponent = this.state.players[opponentIndex];
    let pieceRng = createRng(player.pieceRngState);
    let garbageRng = createRng(player.garbageRngState);
    pieceRng.setState(player.pieceRngState);
    garbageRng.setState(player.garbageRngState);

    opponent.knockouts += 1;
    player.board = createEmptyBoard();
    player.pendingGarbageHoles = [];
    player.comboCounter = -1;
    spawnPiece(player, pieceRng, garbageRng);
    player.pieceRngState = pieceRng.getState();
    player.garbageRngState = garbageRng.getState();
  }

  applyFullState(state) {
    if (!state || !state.players) {
      return;
    }
    this.state = cloneState(state);
    this.lastProcessedTick = this.state.tick;
    this.history.set(this.state.tick, cloneState(this.state));

    // Drop any queued inputs/garbage that are at or before the snapshot tick.
    for (let tick of this.inputsByTick.keys()) {
      if (tick <= this.state.tick) {
        this.inputsByTick.delete(tick);
      }
    }
    for (let tick of this.garbageByTick.keys()) {
      if (tick <= this.state.tick) {
        this.garbageByTick.delete(tick);
      }
    }
  }

  applyPlayerState({ playerIndex, playerState }) {
    if (playerIndex === undefined || playerIndex === null) {
      return;
    }
    if (!playerState) {
      return;
    }
    if (!this.state.players[playerIndex]) {
      return;
    }
    this.state.players[playerIndex] = cloneState(playerState);
    this.history.set(this.state.tick, cloneState(this.state));
  }
}

module.exports = {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  DEFAULT_TICK_MS,
  DEFAULT_INPUT_BUFFER_TICKS,
  DEFAULT_ROLLBACK_WINDOW_TICKS,
  MATCH_DURATION_MS,
  BAG_PIECES,
  PIECES,
  createRng,
  cloneState,
  createEmptyBoard,
  calculateGarbageLines,
  calculateComboBonus,
  nextComboCounter,
  applyGarbageLinesWithHoles,
  applyGarbageLines,
  createInitialState,
  determineWinner,
  normalizeInviteType,
  isStakeReady,
  computeInputApplyTick,
  SaitrisBattleEngine
};

