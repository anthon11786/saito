const GameTemplate = require('../../lib/templates/gametemplate');
const htmlTemplate = require('./lib/game-html.template');
const rulesTemplate = require('./lib/rules.template');
const {
  SaitrisBattleEngine,
  DEFAULT_TICK_MS,
  DEFAULT_INPUT_BUFFER_TICKS,
  DEFAULT_ROLLBACK_WINDOW_TICKS,
  BOARD_WIDTH,
  BOARD_HEIGHT,
  PIECES,
  normalizeInviteType,
  isStakeReady,
  computeInputApplyTick
} = require('./lib/saitris-battle-engine');

class SaitrisBattle extends GameTemplate {
  constructor(app) {
    super(app);
    this.app = app;
    this.name = 'Saitris Battle';
    this.slug = 'saitris-battle';
    this.title = 'Saitris Battle';
    this.description =
      'Real-time two-player Saitris battle with garbage lines, knockouts, and optional staking.';
    this.categories = 'Games Arcade Realtime';
    this.minPlayers = 2;
    this.maxPlayers = 2;
    this.can_bet = 1;
    this.useHUD = 0;
    this.useClock = 0;
    this.disable_chat_popup = true;

    this.engine = null;
    this.renderTimer = null;
    this.matchStarted = false;
    this.matchEnded = false;
    this.inputSeq = 0;
    this.softDropActive = false;
    this.heldDirection = null;
    this.moveRepeatTimeout = null;
    this.moveRepeatInterval = null;
    this.dasDelayMs = 150;
    this.arrIntervalMs = 50;
    this.garbageKeys = new Set();
    this.koKeys = new Set();
    this.readyRetryTimer = null;
    this.lastStateSyncTick = -1;
    this.stateSyncIntervalTicks = 10;
    this.lastLocalInputTick = -1;
    this.lastPlayerStateSyncTick = -1;

    this.localBoardCanvas = null;
    this.opponentBoardCanvas = null;
    this.localHoldCanvas = null;
    this.localQueueCanvas = null;
    this.opponentHoldCanvas = null;
    this.opponentQueueCanvas = null;

    return this;
  }

  async initialize(app) {
    await super.initialize(app);
    if (app.BROWSER) {
      this.styles.push(`/${this.returnSlug()}/saitris-battle.css`);
    }
  }

  returnGameRulesHTML() {
    return rulesTemplate();
  }

  async render(app) {
    if (!this.browser_active || this.initialize_game_run) {
      return;
    }

    await this.injectGameHTML(htmlTemplate());
    await super.render(app);
    this.game_move_notification = null;

    this.menu.addMenuOption('game-game', 'Game');
    this.menu.addSubMenuOption('game-game', {
      text: 'How to Play',
      id: 'game-intro',
      class: 'game-intro',
      callback: (app, game_mod) => {
        game_mod.menu.hideSubMenus();
        game_mod.overlay.show(game_mod.returnGameRulesHTML());
      }
    });
    this.menu.addChatMenu();
    this.menu.render();

    this.cacheCanvasRefs();
    this.updateStatus('Waiting for opponent to join...');
    this.sendReadyIfNeeded();

    if (this.game?.state?.startTime) {
      this.maybeStartMatch();
    }

    this.attachInputHandlers();
  }

  cacheCanvasRefs() {
    this.localBoardCanvas = document.getElementById('saitris-board-local');
    this.opponentBoardCanvas = document.getElementById('saitris-board-opponent');
    this.localHoldCanvas = document.getElementById('saitris-hold-local');
    this.localQueueCanvas = document.getElementById('saitris-queue-local');
    this.opponentHoldCanvas = document.getElementById('saitris-hold-opponent');
    this.opponentQueueCanvas = document.getElementById('saitris-queue-opponent');
  }

  sendReadyIfNeeded() {
    if (this.game?.state?.readySent || this.matchStarted || this.matchEnded) {
      this.clearReadyRetryTimer();
      return;
    }
    if (!this.gameBrowserActive()) {
      this.scheduleReadyRetry();
      return;
    }
    if (this.game.player <= 0) {
      this.scheduleReadyRetry();
      return;
    }
    if (!this.game.players || this.game.players.length < this.maxPlayers) {
      this.scheduleReadyRetry();
      return;
    }
    this.game.state.readySent = true;
    this.clearReadyRetryTimer();
    this.game.turn = [`TB_READY\t${this.game.player}`];
    this.sendGameMoveTransaction('game', {});
  }

  scheduleReadyRetry() {
    if (this.readyRetryTimer) {
      return;
    }
    this.readyRetryTimer = setTimeout(() => {
      this.readyRetryTimer = null;
      this.sendReadyIfNeeded();
    }, 1000);
  }

  clearReadyRetryTimer() {
    if (!this.readyRetryTimer) {
      return;
    }
    clearTimeout(this.readyRetryTimer);
    this.readyRetryTimer = null;
  }

  initializeGame(game_id) {
    if (this.game.initializing) {
      this.game.state = this.game.state || {};
      this.game.state.sessionSeed = this.game.dice;
      this.game.state.startTick = 0;
      this.game.state.tickMs = DEFAULT_TICK_MS;
      this.game.state.inputBufferTicks = DEFAULT_INPUT_BUFFER_TICKS;
      this.game.state.rollbackWindowTicks = DEFAULT_ROLLBACK_WINDOW_TICKS;
      this.game.state.startTime = this.game.state.startTime || null;
      this.game.state.readyPlayers = this.game.state.readyPlayers || {};
      this.game.state.readySent = this.game.state.readySent || false;
      this.game.state.inviteType = normalizeInviteType(
        this.game?.invitation_type || this.game?.options?.invitation_type
      );

      if (this.game.options?.crypto) {
        this.game.crypto = this.game.options.crypto;
        this.game.stake =
          this.game.options.stake !== undefined ? this.game.options.stake : 0;
      }

      if (isStakeReady({
        crypto: this.game.crypto,
        stake: this.game.stake,
        stakeAccepted: this.game.state.stakeAccepted
      })) {
        this.game.state.stakeAccepted = true;
      }

      this.game.queue.push('SETUP');
      this.game.queue.push('READY');
    }
  }

  async initializeGameStake(ticker, stake) {
    await super.initializeGameStake(ticker, stake);
    this.game.state.stakeAccepted = true;
    if (this.gameBrowserActive()) {
      this.updateStatus('Stake accepted. Preparing match...');
      this.maybeStartMatch();
    }
  }

  attachInputHandlers() {
    if (!this.gameBrowserActive()) {
      return;
    }

    this.keydownHandler = (event) => {
      if (!this.matchStarted || this.matchEnded) {
        return;
      }

      const key = event.code;
      if (
        event.repeat &&
        (key === 'Space' || key === 'KeyC' || key === 'ArrowLeft' || key === 'ArrowRight')
      ) {
        return;
      }
      if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(key) ||
        ['KeyA', 'KeyD', 'KeyC', 'KeyQ', 'KeyE'].includes(key)
      ) {
        event.preventDefault();
      }

      if (key === 'ArrowLeft') {
        this.startMoveRepeat('left');
      } else if (key === 'ArrowRight') {
        this.startMoveRepeat('right');
      } else if (key === 'ArrowUp' || key === 'KeyQ') {
        this.queueLocalInput('rotate_ccw');
      } else if (key === 'KeyE') {
        this.queueLocalInput('rotate_cw');
      } else if (key === 'ArrowDown') {
        if (!this.softDropActive) {
          this.softDropActive = true;
          this.queueLocalInput('soft_drop_on');
        }
      } else if (key === 'Space') {
        this.clearMoveRepeatTimers();
        if (this.softDropActive) {
          this.softDropActive = false;
          this.queueLocalInput('soft_drop_off');
        }
        this.queueLocalInput('hard_drop');
      } else if (key === 'KeyC') {
        this.queueLocalInput('hold');
      }
    };

    this.keyupHandler = (event) => {
      if (!this.matchStarted || this.matchEnded) {
        return;
      }
      if (event.code === 'ArrowDown' && this.softDropActive) {
        this.softDropActive = false;
        this.queueLocalInput('soft_drop_off');
      }
      if (event.code === 'ArrowLeft') {
        this.stopMoveRepeat('left');
      }
      if (event.code === 'ArrowRight') {
        this.stopMoveRepeat('right');
      }
    };

    document.addEventListener('keydown', this.keydownHandler);
    document.addEventListener('keyup', this.keyupHandler);
  }

  removeEvents() {
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
    }
    if (this.keyupHandler) {
      document.removeEventListener('keyup', this.keyupHandler);
    }
    this.clearMoveRepeatTimers();
    this.clearReadyRetryTimer();
  }

  clearMoveRepeatTimers() {
    if (this.moveRepeatTimeout) {
      clearTimeout(this.moveRepeatTimeout);
      this.moveRepeatTimeout = null;
    }
    if (this.moveRepeatInterval) {
      clearInterval(this.moveRepeatInterval);
      this.moveRepeatInterval = null;
    }
    this.heldDirection = null;
  }

  startMoveRepeat(direction) {
    if (this.heldDirection === direction) {
      return;
    }
    this.clearMoveRepeatTimers();
    this.heldDirection = direction;
    this.queueLocalInput(direction === 'left' ? 'move_left' : 'move_right');

    this.moveRepeatTimeout = setTimeout(() => {
      this.moveRepeatInterval = setInterval(() => {
        if (this.heldDirection === direction) {
          this.queueLocalInput(direction === 'left' ? 'move_left' : 'move_right');
        }
      }, this.arrIntervalMs);
    }, this.dasDelayMs);
  }

  stopMoveRepeat(direction) {
    if (this.heldDirection !== direction) {
      return;
    }
    this.clearMoveRepeatTimers();
  }

  queueLocalInput(action) {
    if (!this.engine || this.game.player === 0) {
      return;
    }
    let now = Date.now();
    let applyTick = computeInputApplyTick({
      engine: this.engine,
      playerIndex: this.game.player - 1,
      action,
      nowMs: now
    });
    let seq = this.inputSeq++;
    this.engine.queueInput({
      playerIndex: this.game.player - 1,
      action,
      tick: applyTick,
      seq
    });
    if (applyTick > this.lastLocalInputTick) {
      this.lastLocalInputTick = applyTick;
    }

    this.engine.advanceToTick(this.engine.getCurrentTick(now));
    let checksum = this.engine.getStateChecksum();
    this.game.turn = [
      `INPUT\t${this.game.player}\t${applyTick}\t${action}\t${seq}\t${checksum}`
    ];
    this.sendGameMoveTransaction('game', {});
  }

  queueGarbageEvent({ sourceIndex, targetIndex, holes, tick }) {
    let key = `${sourceIndex}:${targetIndex}:${tick}:${holes.join(',')}`;
    if (this.garbageKeys.has(key)) {
      return;
    }
    this.garbageKeys.add(key);

    if (this.engine) {
      this.engine.queueGarbageEvent({ sourceIndex, targetIndex, holes, tick });
    }

    let checksum = this.engine.getStateChecksum();
    this.game.turn = [
      `GARBAGE\t${sourceIndex + 1}\t${targetIndex + 1}\t${tick}\t${holes.join(',')}\t${checksum}`
    ];
    this.sendGameMoveTransaction('game', {});
  }

  applyGarbageEventFromNetwork({ sourceIndex, targetIndex, holes, tick }) {
    let key = `${sourceIndex}:${targetIndex}:${tick}:${holes.join(',')}`;
    if (this.garbageKeys.has(key)) {
      return;
    }
    this.garbageKeys.add(key);
    if (this.engine) {
      this.engine.queueGarbageEvent({ sourceIndex, targetIndex, holes, tick });
    }
  }

  maybeStartMatch() {
    if (this.matchStarted || !this.game?.state?.startTime) {
      return;
    }
    if (this.game?.state?.awaitingSync) {
      return;
    }
    if (!isStakeReady({
      crypto: this.game.crypto,
      stake: this.game.stake,
      stakeAccepted: this.game.state.stakeAccepted
    })) {
      this.updateStatus('Waiting for stake acceptance...');
      return;
    }
    this.startMatch();
  }

  startMatch() {
    let { sessionSeed, startTick, tickMs, inputBufferTicks, rollbackWindowTicks } =
      this.game.state;
    this.engine = new SaitrisBattleEngine({
      sessionSeed,
      startTick,
      tickMs,
      inputBufferTicks,
      rollbackWindowTicks
    });
    this.engine.authoritativePlayerIndex = this.getLocalPlayerIndex();
    this.engine.start(this.game.state.startTime, this.game.state.timeOffsetMs || 0);
    this.engine.garbageMode = 'event';
    this.engine.onGarbage = (evt) => this.queueGarbageEvent(evt);
    this.engine.onKO = (evt) => this.queueKOEvent(evt);
    this.matchStarted = true;
    this.updateStatus('Match in progress...');
    this.startRenderLoop();
  }

  queueKOEvent({ playerIndex, opponentIndex, tick }) {
    let key = `${playerIndex}:${opponentIndex}:${tick}`;
    if (this.koKeys.has(key)) {
      return;
    }
    this.koKeys.add(key);
    let checksum = this.engine.getStateChecksum();
    this.game.turn = [
      `KO\t${playerIndex + 1}\t${opponentIndex + 1}\t${tick}\t${checksum}`
    ];
    this.sendGameMoveTransaction('game', {});
  }

  sendStateSync() {
    if (!this.engine || this.matchEnded) {
      return;
    }
    if (this.game.player !== 1) {
      return;
    }
    let tick = this.engine.state.tick;
    if (tick === this.lastStateSyncTick) {
      return;
    }
    let payload = encodeURIComponent(JSON.stringify(this.engine.state));
    let checksum = this.engine.getStateChecksum();
    this.game.turn = [`STATE\t${tick}\t${payload}\t${checksum}`];
    this.sendGameMoveTransaction('game', {});
    this.lastStateSyncTick = tick;
  }

  sendPlayerStateSync() {
    if (!this.engine || this.matchEnded) {
      return;
    }
    if (this.game.player === 0) {
      return;
    }
    let tick = this.engine.state.tick;
    if (tick - this.lastPlayerStateSyncTick < this.stateSyncIntervalTicks) {
      return;
    }
    let playerIndex = this.getLocalPlayerIndex();
    let playerState = this.engine.state.players[playerIndex];
    if (!playerState) {
      return;
    }
    let payload = encodeURIComponent(JSON.stringify(playerState));
    this.game.turn = [`PSTATE\t${playerIndex + 1}\t${tick}\t${payload}`];
    this.sendGameMoveTransaction('game', {});
    this.lastPlayerStateSyncTick = tick;
  }

  startRenderLoop() {
    if (this.renderTimer) {
      clearInterval(this.renderTimer);
    }
    this.renderTimer = setInterval(() => {
      if (!this.engine || this.matchEnded) {
        return;
      }
      let now = Date.now();
      let targetTick = this.engine.getCurrentTick(now);
      this.engine.advanceToTick(targetTick);
      this.renderState();
      this.sendPlayerStateSync();

      if (this.engine.state.matchOver) {
        this.handleMatchEnd();
      }
    }, 50);
  }

  async handleMatchEnd() {
    if (this.matchEnded) {
      return;
    }
    this.matchEnded = true;
    clearInterval(this.renderTimer);

    let winnerIndex = this.engine.state.winner;
    let reason = this.engine.state.reason;
    if (winnerIndex === null) {
      this.updateStatus('Match ended in a draw.');
    } else if (winnerIndex === this.game.player - 1) {
      this.updateStatus('You win!');
    } else {
      this.updateStatus('You lose.');
    }

    let winners = winnerIndex === null ? [] : [this.game.players[winnerIndex]];
    let senderIndex = winnerIndex === null ? 0 : winnerIndex;
    if (this.game.player === senderIndex + 1) {
      await this.sendGameOverTransaction(winners, reason);
    }
  }

  renderState() {
    if (!this.gameBrowserActive() || !this.engine) {
      return;
    }
    this.updateTimerDisplay();
    this.renderBoards();
    this.renderPanels();
  }

  updateTimerDisplay() {
    let timerElement = document.getElementById('saitris-timer');
    if (!timerElement || !this.engine?.startTimeMs) {
      return;
    }
    let nowMs = Date.now() + (this.engine.timeOffsetMs || 0);
    let elapsedMs = Math.max(0, nowMs - this.engine.startTimeMs);
    let remaining = Math.max(0, 120000 - elapsedMs);
    let seconds = Math.floor(remaining / 1000);
    let minutes = Math.floor(seconds / 60);
    let secs = (seconds % 60).toString().padStart(2, '0');
    timerElement.textContent = `${minutes}:${secs}`;
  }

  renderBoards() {
    if (!this.localBoardCanvas || !this.opponentBoardCanvas) {
      return;
    }
    let localIndex = this.getLocalPlayerIndex();
    let opponentIndex = localIndex === 0 ? 1 : 0;
    let localPlayer = this.engine.state.players[localIndex];
    let opponentPlayer = this.engine.state.players[opponentIndex];
    this.drawBoard(this.localBoardCanvas, localPlayer, true);
    this.drawBoard(this.opponentBoardCanvas, opponentPlayer, false);
  }

  renderPanels() {
    let localIndex = this.getLocalPlayerIndex();
    let opponentIndex = localIndex === 0 ? 1 : 0;
    let localPlayer = this.engine.state.players[localIndex];
    let opponentPlayer = this.engine.state.players[opponentIndex];

    let localKOs = document.getElementById('saitris-knockouts-local');
    let opponentKOs = document.getElementById('saitris-knockouts-opponent');
    let localLines = document.getElementById('saitris-lines-local');
    let opponentLines = document.getElementById('saitris-lines-opponent');

    if (localKOs) localKOs.textContent = localPlayer.knockouts.toString();
    if (opponentKOs) opponentKOs.textContent = opponentPlayer.knockouts.toString();
    if (localLines) localLines.textContent = localPlayer.linesSent.toString();
    if (opponentLines) opponentLines.textContent = opponentPlayer.linesSent.toString();

    this.drawMini(this.localHoldCanvas, localPlayer.hold);
    this.drawMini(this.opponentHoldCanvas, opponentPlayer.hold);
    this.drawQueue(this.localQueueCanvas, localPlayer.nextQueue);
    this.drawQueue(this.opponentQueueCanvas, opponentPlayer.nextQueue);
  }

  getLocalPlayerIndex() {
    if (this.game.player > 0) {
      return this.game.player - 1;
    }
    return 0;
  }

  drawBoard(canvas, player, showGhost) {
    let ctx = canvas.getContext('2d');
    let cellSize = canvas.width / BOARD_WIDTH;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f1114';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        let cell = player.board[y][x];
        if (cell !== 0) {
          this.drawCell(ctx, x, y, cellSize, this.colorForCell(cell), 1);
        }
      }
    }

    if (player.active) {
      let ghostOffset = 0;
      if (showGhost) {
        while (
          this.isValidPiecePlacement(
            player,
            player.active,
            player.rotation,
            player.x,
            player.y + ghostOffset + 1
          )
        ) {
          ghostOffset += 1;
        }
        this.drawPiece(
          ctx,
          player.active,
          player.rotation,
          player.x,
          player.y + ghostOffset,
          cellSize,
          'rgba(255,255,255,0.15)'
        );
      }

      this.drawPiece(
        ctx,
        player.active,
        player.rotation,
        player.x,
        player.y,
        cellSize,
        this.colorForPiece(player.active)
      );
    }
  }

  drawPiece(ctx, type, rotation, x, y, cellSize, color) {
    let cells = PIECES[type][rotation % 4];
    for (let [dx, dy] of cells) {
      let nx = x + dx;
      let ny = y + dy;
      if (ny >= 0) {
        this.drawCell(ctx, nx, ny, cellSize, color, 1);
      }
    }
  }

  drawCell(ctx, x, y, cellSize, color, alpha) {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
    ctx.globalAlpha = 1;
  }

  drawMini(canvas, piece) {
    if (!canvas) {
      return;
    }
    let ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f1114';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!piece) {
      return;
    }

    let cells = PIECES[piece][0];
    let minX = 4, minY = 4, maxX = 0, maxY = 0;
    for (let [dx, dy] of cells) {
      minX = Math.min(minX, dx);
      minY = Math.min(minY, dy);
      maxX = Math.max(maxX, dx);
      maxY = Math.max(maxY, dy);
    }
    let w = maxX - minX + 1;
    let h = maxY - minY + 1;
    let cellSize = canvas.width / 4;
    let x = (4 - w) / 2 - minX;
    let y = (4 - h) / 2 - minY;

    this.drawPiece(ctx, piece, 0, x, y, cellSize, this.colorForPiece(piece));
  }

  drawQueue(canvas, queue) {
    if (!canvas) {
      return;
    }
    let ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f1114';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let cellSize = canvas.width / 4;
    queue.slice(0, 3).forEach((piece, idx) => {
      let cells = PIECES[piece][0];
      let minX = 4, minY = 4, maxX = 0, maxY = 0;
      for (let [dx, dy] of cells) {
        minX = Math.min(minX, dx);
        minY = Math.min(minY, dy);
        maxX = Math.max(maxX, dx);
        maxY = Math.max(maxY, dy);
      }
      let w = maxX - minX + 1;
      let h = maxY - minY + 1;
      let x = (4 - w) / 2 - minX;
      let y = (4 - h) / 2 - minY + idx * 4;

      this.drawPiece(ctx, piece, 0, x, y, cellSize, this.colorForPiece(piece));
    });
  }

  isValidPiecePlacement(player, type, rotation, x, y) {
    let cells = PIECES[type][rotation % 4];
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

  colorForCell(cell) {
    return [
      '#000000',
      '#00f0f0',
      '#f0f000',
      '#a000f0',
      '#00f000',
      '#f00000',
      '#0000f0',
      '#f0a000',
      '#888888'
    ][cell];
  }

  colorForPiece(type) {
    switch (type) {
    case 'I':
      return '#00f0f0';
    case 'O':
      return '#f0f000';
    case 'T':
      return '#a000f0';
    case 'S':
      return '#00f000';
    case 'Z':
      return '#f00000';
    case 'J':
      return '#0000f0';
    case 'L':
      return '#f0a000';
    default:
      return '#ffffff';
    }
  }

  async handleGameLoop() {
    if (this.game.queue.length === 0) {
      return 0;
    }

    let gqe = this.game.queue.length - 1;
    let mv = this.game.queue[gqe].split('\t');

    if (mv[0] === 'SETUP') {
      this.game.queue.splice(gqe, 1);
      this.sendReadyIfNeeded();
      return 1;
    }

    if (mv[0] === 'TB_READY') {
      this.game.queue.splice(gqe, 1);
      let readyPlayer = parseInt(mv[1], 10);
      this.game.state.readyPlayers[readyPlayer] = true;
      if (
        this.game.player === 1 &&
        !this.game.state.startTime &&
        this.gameBrowserActive()
      ) {
        let readyCount = Object.keys(this.game.state.readyPlayers).length;
        if (readyCount >= this.maxPlayers) {
          if (
            !isStakeReady({
              crypto: this.game.crypto,
              stake: this.game.stake,
              stakeAccepted: this.game.state.stakeAccepted
            })
          ) {
            this.proposeGameStake(this.game.crypto, this.game.stake);
          }
          let hostNow = Date.now();
          let startTime = hostNow + 3000;
          this.game.turn = [
            `START\t${startTime}\t${this.game.state.sessionSeed}\t${hostNow}`
          ];
          this.sendGameMoveTransaction('game', {});
        }
      }
      return 1;
    }

    if (mv[0] === 'START') {
      this.game.queue.splice(gqe, 1);
      let hostStartTime = parseInt(mv[1], 10);
      this.game.state.sessionSeed = mv[2];
      this.game.state.hostStartTime = hostStartTime;
      this.game.state.startTime = hostStartTime;
      if (this.game.player === 1) {
        this.game.state.timeOffsetMs = 0;
        this.game.state.awaitingSync = false;
      } else {
        this.game.state.awaitingSync = true;
        let clientSentAt = Date.now();
        this.game.turn = [`SYNC\t${clientSentAt}`];
        this.sendGameMoveTransaction('game', {});
      }
      if (this.gameBrowserActive()) {
        this.updateStatus('Match starting...');
        this.maybeStartMatch();
      }
      return 1;
    }

    if (mv[0] === 'SYNC') {
      this.game.queue.splice(gqe, 1);
      if (this.game.player === 1) {
        let clientSentAt = parseInt(mv[1], 10);
        let hostNow = Date.now();
        this.game.turn = [`SYNC_ACK\t${clientSentAt}\t${hostNow}`];
        this.sendGameMoveTransaction('game', {});
      }
      return 1;
    }

    if (mv[0] === 'SYNC_ACK') {
      this.game.queue.splice(gqe, 1);
      if (this.game.player !== 1 && this.game.state.awaitingSync) {
        let clientSentAt = parseInt(mv[1], 10);
        let hostNow = parseInt(mv[2], 10);
        let clientReceiveAt = Date.now();
        let estimatedClientNow = (clientSentAt + clientReceiveAt) / 2;
        this.game.state.timeOffsetMs = hostNow - estimatedClientNow;
        this.game.state.awaitingSync = false;
        if (this.gameBrowserActive()) {
          this.maybeStartMatch();
        }
      }
      return 1;
    }

    if (mv[0] === 'STATE') {
      this.game.queue.splice(gqe, 1);
      if (!this.engine) {
        return 1;
      }
      let snapshotTick = parseInt(mv[1], 10);
      let payload = mv[2];
      let snapshotChecksum = mv[3];
      if (Number.isNaN(snapshotTick) || !payload) {
        return 1;
      }
      if (snapshotTick < this.engine.lastProcessedTick - this.engine.rollbackWindowTicks) {
        return 1;
      }
      if (snapshotChecksum) {
        let localChecksum = this.engine.getStateChecksum();
        if (snapshotChecksum === localChecksum) {
          return 1;
        }
      }
      if (snapshotTick < this.lastLocalInputTick) {
        return 1;
      }
      try {
        let decoded = decodeURIComponent(payload);
        let snapshot = JSON.parse(decoded);
        this.engine.applyFullState(snapshot);
        let now = Date.now();
        let targetTick = this.engine.getCurrentTick(now);
        this.engine.advanceToTick(targetTick);
        this.renderState();
      } catch (err) {
        console.warn('SaitrisBattle: failed to apply state sync', err);
      }
      return 1;
    }

    if (mv[0] === 'PSTATE') {
      this.game.queue.splice(gqe, 1);
      if (!this.engine) {
        return 1;
      }
      let playerIndex = parseInt(mv[1], 10) - 1;
      let snapshotTick = parseInt(mv[2], 10);
      let payload = mv[3];
      if (Number.isNaN(playerIndex) || Number.isNaN(snapshotTick) || !payload) {
        return 1;
      }
      if (playerIndex === this.getLocalPlayerIndex()) {
        return 1;
      }
      if (snapshotTick < this.engine.lastProcessedTick - this.engine.rollbackWindowTicks) {
        return 1;
      }
      try {
        let decoded = decodeURIComponent(payload);
        let playerState = JSON.parse(decoded);
        this.engine.applyPlayerState({ playerIndex, playerState });
      } catch (err) {
        console.warn('SaitrisBattle: failed to apply player state sync', err);
      }
      return 1;
    }

    if (mv[0] === 'INPUT') {
      this.game.queue.splice(gqe, 1);
      if (!this.engine) {
        return 1;
      }
      let playerIndex = parseInt(mv[1], 10) - 1;
      let tick = parseInt(mv[2], 10);
      let action = mv[3];
      let seq = parseInt(mv[4], 10);
      let checksum = mv[5];

      this.engine.queueInput({ playerIndex, action, tick, seq });

      if (checksum && playerIndex !== this.game.player - 1) {
        let localChecksum = this.engine.getStateChecksum();
        if (checksum !== localChecksum) {
          if (playerIndex === 0) {
            this.engine.applyStateSync(checksum);
          } else if (this.game.player === 1) {
            this.sendStateSync();
          }
        }
      }
      return 1;
    }

    if (mv[0] === 'GARBAGE') {
      this.game.queue.splice(gqe, 1);
      if (!this.engine) {
        return 1;
      }
      let sourceIndex = parseInt(mv[1], 10) - 1;
      let targetIndex = parseInt(mv[2], 10) - 1;
      let tick = parseInt(mv[3], 10);
      let holes = mv[4] ? mv[4].split(',').map((n) => parseInt(n, 10)) : [];
      let checksum = mv[5];

      this.applyGarbageEventFromNetwork({ sourceIndex, targetIndex, holes, tick });

      if (checksum && sourceIndex !== this.game.player - 1) {
        let localChecksum = this.engine.getStateChecksum();
        if (checksum !== localChecksum) {
          if (sourceIndex === 0) {
            this.engine.applyStateSync(checksum);
          } else if (this.game.player === 1) {
            this.sendStateSync();
          }
        }
      }
      return 1;
    }

    if (mv[0] === 'KO') {
      this.game.queue.splice(gqe, 1);
      if (!this.engine) {
        return 1;
      }
      let playerIndex = parseInt(mv[1], 10) - 1;
      let opponentIndex = parseInt(mv[2], 10) - 1;
      let tick = parseInt(mv[3], 10);
      let checksum = mv[4];
      let key = `${playerIndex}:${opponentIndex}:${tick}`;
      if (!this.koKeys.has(key)) {
        this.koKeys.add(key);
        this.engine.applyKOEvent({ playerIndex, opponentIndex });
      }

      if (checksum && playerIndex !== this.game.player - 1) {
        let localChecksum = this.engine.getStateChecksum();
        if (checksum !== localChecksum) {
          if (playerIndex === 0) {
            this.engine.applyStateSync(checksum);
          } else if (this.game.player === 1) {
            this.sendStateSync();
          }
        }
      }
      return 1;
    }

    return 0;
  }
}

module.exports = SaitrisBattle;

