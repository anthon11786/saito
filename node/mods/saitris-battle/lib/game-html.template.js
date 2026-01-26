module.exports = () => {
  return `
    <div class="saitris-battle">
      <div class="saitris-header">
        <div class="saitris-status status"></div>
        <div class="saitris-timer" id="saitris-timer">2:00</div>
      </div>
      <div class="saitris-boards">
        <div class="saitris-player saitris-player-local">
          <div class="saitris-side">
            <div class="saitris-panel">
              <div class="saitris-panel-title">Hold</div>
              <canvas id="saitris-hold-local" width="96" height="96"></canvas>
            </div>
            <div class="saitris-side-stats">
              <div class="saitris-stat">
                <div class="saitris-stat-label">KO</div>
                <div class="saitris-stat-value" id="saitris-knockouts-local">0</div>
              </div>
              <div class="saitris-stat">
                <div class="saitris-stat-label">Lines Sent</div>
                <div class="saitris-stat-value" id="saitris-lines-local">0</div>
              </div>
            </div>
          </div>
          <canvas id="saitris-board-local" width="240" height="480"></canvas>
          <div class="saitris-panel">
            <div class="saitris-panel-title">Next</div>
            <canvas id="saitris-queue-local" width="96" height="288"></canvas>
          </div>
        </div>
        <div class="saitris-player saitris-player-opponent">
          <div class="saitris-side">
            <div class="saitris-panel">
              <div class="saitris-panel-title">Hold</div>
              <canvas id="saitris-hold-opponent" width="96" height="96"></canvas>
            </div>
            <div class="saitris-side-stats">
              <div class="saitris-stat">
                <div class="saitris-stat-label">KO</div>
                <div class="saitris-stat-value" id="saitris-knockouts-opponent">0</div>
              </div>
              <div class="saitris-stat">
                <div class="saitris-stat-label">Lines Sent</div>
                <div class="saitris-stat-value" id="saitris-lines-opponent">0</div>
              </div>
            </div>
          </div>
          <canvas id="saitris-board-opponent" width="240" height="480"></canvas>
          <div class="saitris-panel">
            <div class="saitris-panel-title">Next</div>
            <canvas id="saitris-queue-opponent" width="96" height="288"></canvas>
          </div>
        </div>
      </div>
      <div class="saitris-controls">
        <div>Move: ← / →</div>
        <div>Rotate: ↑</div>
        <div>Soft Drop: ↓ (hold)</div>
        <div>Hard Drop: Space</div>
        <div>Hold: C</div>
      </div>
    </div>
  `;
};

