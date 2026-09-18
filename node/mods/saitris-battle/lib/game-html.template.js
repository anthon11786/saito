module.exports = () => {
  return `
    <div class="saitris-battle">
      <div class="saitris-hud">
        <div class="saitris-status status"></div>
        <div class="saitris-timer" id="saitris-timer">2:00</div>
      </div>
      <div class="saitris-boards">
        <section class="saitris-player saitris-player-local" aria-label="Your board">
          <div class="saitris-side">
            <div class="saitris-panel">
              <div class="saitris-panel-title">Hold</div>
              <canvas id="saitris-hold-local" width="80" height="80"></canvas>
            </div>
            <div class="saitris-side-stats">
              <div class="saitris-stat saitris-stat-ko">
                <div class="saitris-stat-label">KO</div>
                <div class="saitris-stat-value" id="saitris-knockouts-local">0</div>
              </div>
              <div class="saitris-stat">
                <div class="saitris-stat-label">Score</div>
                <div class="saitris-stat-value" id="saitris-score-local">0</div>
              </div>
              <div class="saitris-stat">
                <div class="saitris-stat-label">Lines</div>
                <div class="saitris-stat-value" id="saitris-lines-local">0</div>
              </div>
            </div>
          </div>
          <div class="saitris-well">
            <canvas id="saitris-board-local" width="300" height="600"></canvas>
          </div>
          <div class="saitris-panel saitris-panel-next">
            <div class="saitris-panel-title">Next</div>
            <canvas id="saitris-queue-local" width="80" height="240"></canvas>
          </div>
        </section>
        <section class="saitris-player saitris-player-opponent" aria-label="Opponent board">
          <div class="saitris-side">
            <div class="saitris-panel">
              <div class="saitris-panel-title">Hold</div>
              <canvas id="saitris-hold-opponent" width="80" height="80"></canvas>
            </div>
            <div class="saitris-side-stats">
              <div class="saitris-stat saitris-stat-ko">
                <div class="saitris-stat-label">KO</div>
                <div class="saitris-stat-value" id="saitris-knockouts-opponent">0</div>
              </div>
              <div class="saitris-stat">
                <div class="saitris-stat-label">Lines</div>
                <div class="saitris-stat-value" id="saitris-lines-opponent">0</div>
              </div>
            </div>
          </div>
          <div class="saitris-well">
            <canvas id="saitris-board-opponent" width="300" height="600"></canvas>
          </div>
          <div class="saitris-panel saitris-panel-next">
            <div class="saitris-panel-title">Next</div>
            <canvas id="saitris-queue-opponent" width="80" height="240"></canvas>
          </div>
        </section>
      </div>
      <div class="saitris-controls">
        <span><kbd>←</kbd><kbd>→</kbd> move</span>
        <span><kbd>↑</kbd> rotate</span>
        <span><kbd>↓</kbd> soft</span>
        <span><kbd>space</kbd> hard</span>
        <span><kbd>C</kbd> hold</span>
      </div>
    </div>
  `;
};
