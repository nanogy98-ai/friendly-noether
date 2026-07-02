/**
 * Quantum Connect Four - Game Logic Engine
 */

// Sound Controller using Web Audio API
class SoundController {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }
  
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  
  playDrop(row) {
    if (!this.enabled) return;
    this.init();
    
    const now = this.ctx.currentTime;
    const dropDuration = 0.12 + (row * 0.06); 

    // --- LAYER 1: THE SLIDE (NOISE) ---
    const bufferSize = this.ctx.sampleRate * 0.3;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(2500, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + dropDuration);

    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    // --- LAYER 2: THE IMPACT (PITCH-SWEPT OSCILLATOR) ---
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(3000, now + dropDuration);
    osc.frequency.exponentialRampToValueAtTime(600, now + dropDuration + 0.015);

    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.setValueAtTime(0.8, now + dropDuration);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + dropDuration + 0.04);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);

    // --- LAYER 3: THE PLASTIC SNAP (NOISE BURST) ---
    const clackBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
    const clackOutput = clackBuffer.getChannelData(0);
    for (let i = 0; i < clackBuffer.length; i++) {
        clackOutput[i] = Math.random() * 2 - 1;
    }
    
    const clackNode = this.ctx.createBufferSource();
    clackNode.buffer = clackBuffer;

    const clackFilter = this.ctx.createBiquadFilter();
    clackFilter.type = 'bandpass';
    clackFilter.frequency.setValueAtTime(1500, now);

    const clackGain = this.ctx.createGain();
    clackGain.gain.setValueAtTime(0, now);
    clackGain.gain.setValueAtTime(0.7, now + dropDuration);
    clackGain.gain.exponentialRampToValueAtTime(0.01, now + dropDuration + 0.03);

    clackNode.connect(clackFilter);
    clackFilter.connect(clackGain);
    clackGain.connect(this.ctx.destination);

    noiseNode.start(now);
    osc.start(now + dropDuration);
    osc.stop(now + dropDuration + 0.05);
    clackNode.start(now + dropDuration);
  }
  
  playWin() {
    if (!this.enabled) return;
    this.init();
    
    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.09 + 0.35);
      
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.4);
    });
  }
  
  playClick() {
    if (!this.enabled) return;
    this.init();
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(750, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(250, this.ctx.currentTime + 0.03);
    
    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.03);
    
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.03);
  }
}

// Confetti Particle Celebration Effect
class ConfettiController {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.active = false;
    this.colors = ['#ff3b30', '#ffd60a', '#0088ff', '#34c759', '#af52de'];
    
    window.addEventListener('resize', () => {
      if (this.active) this.resize();
    });
  }
  
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  
  start() {
    this.active = true;
    this.resize();
    this.particles = [];
    for (let i = 0; i < 150; i++) {
      this.particles.push(this.createParticle());
    }
    this.loop();
  }
  
  stop() {
    this.active = false;
  }
  
  createParticle() {
    return {
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height - this.canvas.height,
      r: Math.random() * 6 + 4,
      color: this.colors[Math.floor(Math.random() * this.colors.length)],
      tilt: Math.random() * 10 - 5,
      tiltAngleIncremental: Math.random() * 0.06 + 0.02,
      tiltAngle: 0,
      speedY: Math.random() * 3 + 2.5,
      speedX: Math.random() * 2 - 1
    };
  }
  
  loop() {
    if (!this.active) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    let allFinished = true;
    this.particles.forEach(p => {
      p.tiltAngle += p.tiltAngleIncremental;
      p.y += p.speedY;
      p.x += p.speedX;
      p.tilt = Math.sin(p.tiltAngle) * 12;
      
      this.ctx.beginPath();
      this.ctx.lineWidth = p.r;
      this.ctx.strokeStyle = p.color;
      this.ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
      this.ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
      this.ctx.stroke();
      
      if (p.y < this.canvas.height) {
        allFinished = false;
      }
    });
    
    if (!allFinished) {
      requestAnimationFrame(() => this.loop());
    } else {
      this.active = false;
    }
  }
}

// Connect Four Game Manager
class Game {
  constructor() {
    this.rows = 6;
    this.cols = 7;
    
    // Core game state
    this.board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(0));
    this.activePlayer = 1; // 1 = Red, 2 = Yellow
    this.gameMode = 'pvp'; // 'pvp', 'pve', or 'lan'
    this.difficulty = 'medium'; // 'easy', 'medium', 'hard'
    this.moveHistory = [];
    this.gameOver = false;
    this.animating = false;
    
    // LAN Multiplayer variables
    this.lanRole = 1; // 1 = Red, 2 = Yellow
    this.lanInterval = null;
    this.lanLastMovesCount = 0;
    
    // Timer
    this.timerSeconds = 0;
    this.timerInterval = null;
    
    // Scores
    this.scores = {
      pvp: { p1: 0, p2: 0, draws: 0 },
      pve: { p1: 0, p2: 0, draws: 0 },
      lan: { p1: 0, p2: 0, draws: 0 }
    };
    
    // All-time scores database
    this.allTimeScores = {};
    
    // Controllers
    this.sounds = new SoundController();
    this.confetti = new ConfettiController('confetti-canvas');
    
    // Initialize
    this.loadAllTimeScores();
    this.initDOM();
    
    // Try to restore saved game session
    if (!this.restoreActiveGameState()) {
      this.loadStats();
      this.renderScores();
      this.startTimer();
    }
    
    // Sync LAN if loaded in LAN mode
    if (this.gameMode === 'lan') {
      this.startLANPolling();
    }
  }
  
  initDOM() {
    this.boardCover = document.getElementById('board-cover');
    this.columnsContainer = document.getElementById('columns-container');
    this.tokensContainer = document.getElementById('tokens-container');
    this.previewRow = document.getElementById('preview-row');
    
    // Side panels
    this.p1Card = document.getElementById('p1-card');
    this.p2Card = document.getElementById('p2-card');
    this.p1Label = document.getElementById('p1-label');
    this.p2Label = document.getElementById('p2-label');
    this.p1NameText = document.getElementById('p1-name-text');
    this.p2NameText = document.getElementById('p2-name-text');
    this.p1Score = document.getElementById('p1-score');
    this.p2Score = document.getElementById('p2-score');
    this.p1Alltime = document.getElementById('p1-alltime');
    this.p2Alltime = document.getElementById('p2-alltime');
    
    // Turn indicators
    this.turnPill = document.getElementById('turn-pill');
    this.turnColorIndicator = document.getElementById('turn-color-indicator');
    this.turnText = document.getElementById('turn-text');
    
    // Controls
    this.newGameBtn = document.getElementById('new-game-btn');
    this.undoBtn = document.getElementById('undo-btn');
    this.hintBtn = document.getElementById('hint-btn');
    this.soundBtn = document.getElementById('sound-btn');
    this.timerDisplay = document.getElementById('game-timer');
    
    // Settings Drawer
    this.settingsToggle = document.getElementById('settings-toggle');
    this.settingsClose = document.getElementById('settings-close');
    this.settingsDrawer = document.getElementById('settings-drawer');
    this.drawerOverlay = this.settingsDrawer.querySelector('.drawer-overlay');
    
    this.modePvP = document.getElementById('mode-pvp');
    this.modePvE = document.getElementById('mode-pve');
    this.modeLAN = document.getElementById('mode-lan');
    this.difficultyGroup = document.getElementById('difficulty-group');
    this.lanConfigGroup = document.getElementById('lan-config-group');
    
    this.roleP1Btn = document.getElementById('role-p1');
    this.roleP2Btn = document.getElementById('role-p2');
    this.copyUrlBtn = document.getElementById('copy-url-btn');
    this.shareUrlInput = document.getElementById('lan-share-url');
    
    this.inputP1Name = document.getElementById('input-p1-name');
    this.inputP2Name = document.getElementById('input-p2-name');
    this.p2NameInputGroup = document.getElementById('p2-name-input-group');
    
    this.drawsStat = document.getElementById('draws-stat');
    this.clearStats = document.getElementById('clear-stats');
    this.clearAlltimeBtn = document.getElementById('clear-alltime');
    this.themeToggle = document.getElementById('theme-toggle');
    
    // Win overlay
    this.winOverlay = document.getElementById('win-overlay');
    this.winTitle = document.getElementById('win-title');
    this.winSubtitle = document.getElementById('win-subtitle');
    this.winPlayAgain = document.getElementById('win-play-again');
    this.winClose = document.getElementById('win-close');
    this.winEmoji = document.getElementById('win-emoji');
    
    // Pre-populate share link
    const currentHost = window.location.hostname || "192.168.0.46";
    const portString = window.location.port ? `:${window.location.port}` : ":8000";
    const lanLink = `http://${currentHost}${portString}/`;
    this.shareUrlInput.value = lanLink;
    document.getElementById('lan-qr-code').src = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(lanLink)}`;
    
    // Load local role setting if active
    const savedRole = sessionStorage.getItem('connect4_lan_role');
    if (savedRole) {
      this.lanRole = parseInt(savedRole);
      this.updateLANRoleUI();
    }
    
    // Populate board cell covers
    this.boardCover.innerHTML = '';
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell';
        this.boardCover.appendChild(cell);
      }
    }
    
    // Populate column hitboxes
    this.columnsContainer.innerHTML = '';
    for (let c = 0; c < this.cols; c++) {
      const col = document.createElement('div');
      col.className = 'board-column';
      col.dataset.col = c;
      this.columnsContainer.appendChild(col);
    }
    
    this.bindEvents();
    this.setupTheme();
  }
  
  bindEvents() {
    // Column hover and click triggers
    this.columnsContainer.addEventListener('click', (e) => {
      const colEl = e.target.closest('.board-column');
      if (!colEl || this.gameOver || this.animating) return;
      
      // If Vs AI and it's AI turn, block click
      if (this.gameMode === 'pve' && this.activePlayer === 2) return;
      
      // If LAN mode and it's not our player role's turn, block click
      if (this.gameMode === 'lan' && this.activePlayer !== this.lanRole) return;
      
      const col = parseInt(colEl.dataset.col);
      this.handlePlayerMove(col);
    });
    
    this.columnsContainer.addEventListener('mousemove', (e) => {
      const colEl = e.target.closest('.board-column');
      if (!colEl || this.gameOver || this.animating) {
        this.clearPreviews();
        return;
      }
      
      if (this.gameMode === 'pve' && this.activePlayer === 2) {
        this.clearPreviews();
        return;
      }
      
      if (this.gameMode === 'lan' && this.activePlayer !== this.lanRole) {
        this.clearPreviews();
        return;
      }
      
      const col = parseInt(colEl.dataset.col);
      this.showMovePreview(col);
    });
    
    this.columnsContainer.addEventListener('mouseleave', () => {
      this.clearPreviews();
    });
    
    // Inline renaming double clicks
    this.p1Label.addEventListener('dblclick', () => this.editPlayerNameInline(1));
    this.p2Label.addEventListener('dblclick', () => this.editPlayerNameInline(2));
    
    // Drawer Game Modes
    this.modePvP.addEventListener('click', () => this.switchMode('pvp'));
    this.modePvE.addEventListener('click', () => this.switchMode('pve'));
    this.modeLAN.addEventListener('click', () => this.switchMode('lan'));
    
    // LAN Role Selection
    this.roleP1Btn.addEventListener('click', () => this.switchLANRole(1));
    this.roleP2Btn.addEventListener('click', () => this.switchLANRole(2));
    
    // Copy LAN url link
    this.copyUrlBtn.addEventListener('click', () => {
      this.sounds.playClick();
      this.shareUrlInput.select();
      document.execCommand('copy');
      alert("LAN Link copied to clipboard!");
    });
    
    // Difficulty selectors
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.sounds.playClick();
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.difficulty = e.target.dataset.diff;
        this.restartGame();
      });
    });
    
    // Drawer Name Inputs
    this.inputP1Name.addEventListener('input', (e) => {
      const val = e.target.value.trim() || "Red Player";
      this.p1NameText.textContent = val;
      this.updateAllTimeScoreUI();
      this.saveActiveGameState();
      if (this.gameMode === 'lan') this.syncNamesToServer();
    });
    
    this.inputP2Name.addEventListener('input', (e) => {
      const val = e.target.value.trim() || "Yellow Player";
      this.p2NameText.textContent = val;
      this.updateAllTimeScoreUI();
      this.saveActiveGameState();
      if (this.gameMode === 'lan') this.syncNamesToServer();
    });
    
    // Drawer open/close toggles
    this.settingsToggle.addEventListener('click', () => {
      this.sounds.playClick();
      this.settingsDrawer.classList.remove('hidden');
    });
    this.settingsClose.addEventListener('click', () => {
      this.sounds.playClick();
      this.settingsDrawer.classList.add('hidden');
    });
    this.drawerOverlay.addEventListener('click', () => {
      this.settingsDrawer.classList.add('hidden');
    });
    
    // Controls Bar Row Actions
    this.newGameBtn.addEventListener('click', () => {
      this.sounds.playClick();
      this.restartGame();
    });
    this.undoBtn.addEventListener('click', () => {
      this.sounds.playClick();
      this.undoMove();
    });
    this.hintBtn.addEventListener('click', () => {
      this.sounds.playClick();
      this.showHint();
    });
    
    this.soundBtn.addEventListener('click', () => {
      this.sounds.enabled = !this.sounds.enabled;
      this.soundBtn.classList.toggle('sound-active', this.sounds.enabled);
      localStorage.setItem('sound', this.sounds.enabled ? 'on' : 'off');
      this.sounds.playClick();
    });
    
    this.themeToggle.addEventListener('click', () => {
      this.sounds.playClick();
      document.body.classList.toggle('light-theme');
      document.body.classList.toggle('dark-theme');
      localStorage.setItem('theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
    });
    
    // Clear Scorecard Stats
    this.clearStats.addEventListener('click', () => {
      this.sounds.playClick();
      this.resetStats();
    });
    
    // Reset All-Time scores database
    this.clearAlltimeBtn.addEventListener('click', () => {
      this.sounds.playClick();
      if (confirm("Are you sure you want to clear the entire all-time scoreboard database?")) {
        this.allTimeScores = {};
        localStorage.setItem('connect4_alltime_db', JSON.stringify({}));
        this.updateAllTimeScoreUI();
        alert("All-Time database cleared!");
      }
    });
    
    // Win Overlay Modal clicks
    this.winPlayAgain.addEventListener('click', () => {
      this.sounds.playClick();
      this.winOverlay.classList.add('hidden');
      this.confetti.stop();
      this.restartGame();
    });
    this.winClose.addEventListener('click', () => {
      this.sounds.playClick();
      this.winOverlay.classList.add('hidden');
      this.confetti.stop();
    });
  }
  
  setupTheme() {
    const soundPref = localStorage.getItem('sound');
    if (soundPref === 'off') {
      this.sounds.enabled = false;
      this.soundBtn.classList.remove('sound-active');
    } else {
      this.sounds.enabled = true;
      this.soundBtn.classList.add('sound-active');
    }
    
    const themePref = localStorage.getItem('theme');
    if (themePref === 'light') {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    } else {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    }
  }
  
  switchMode(mode) {
    if (this.gameMode === mode) return;
    this.sounds.playClick();
    this.gameMode = mode;
    
    // Clear any LAN polling
    this.stopLANPolling();
    
    // Reset indicators
    this.difficultyGroup.classList.add('hidden');
    this.lanConfigGroup.classList.add('hidden');
    this.p2NameInputGroup.classList.remove('hidden');
    
    this.modePvP.classList.remove('active');
    this.modePvE.classList.remove('active');
    this.modeLAN.classList.remove('active');
    
    if (mode === 'pvp') {
      this.modePvP.classList.add('active');
      this.p1NameText.textContent = this.inputP1Name.value.trim() || 'Red Player';
      this.p2NameText.textContent = this.inputP2Name.value.trim() || 'Yellow Player';
    } else if (mode === 'pve') {
      this.modePvE.classList.add('active');
      this.difficultyGroup.classList.remove('hidden');
      this.p1NameText.textContent = this.inputP1Name.value.trim() || 'Red Player';
      this.p2NameText.textContent = 'Quantum AI';
      this.p2NameInputGroup.classList.add('hidden');
    } else if (mode === 'lan') {
      this.modeLAN.classList.add('active');
      this.lanConfigGroup.classList.remove('hidden');
      this.p1NameText.textContent = this.inputP1Name.value.trim() || 'Red Player';
      this.p2NameText.textContent = this.inputP2Name.value.trim() || 'Yellow Player';
      this.startLANPolling();
    }
    
    this.updateAllTimeScoreUI();
    this.renderScores();
    this.restartGame();
  }
  
  switchLANRole(role) {
    this.sounds.playClick();
    this.lanRole = role;
    sessionStorage.setItem('connect4_lan_role', role);
    this.updateLANRoleUI();
    this.updateTurnUI();
  }
  
  updateLANRoleUI() {
    this.roleP1Btn.classList.toggle('active', this.lanRole === 1);
    this.roleP2Btn.classList.toggle('active', this.lanRole === 2);
  }
  
  editPlayerNameInline(player) {
    if (this.gameMode === 'pve' && player === 2) return; // Block renaming AI inline
    
    const textSpan = player === 1 ? this.p1NameText : this.p2NameText;
    const oldName = textSpan.textContent;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-edit-input';
    input.value = oldName;
    
    textSpan.innerHTML = '';
    textSpan.appendChild(input);
    input.focus();
    input.select();
    
    const saveName = () => {
      const newName = input.value.trim() || (player === 1 ? "Red Player" : "Yellow Player");
      textSpan.textContent = newName;
      
      // Update settings drawer inputs
      if (player === 1) {
        this.inputP1Name.value = newName;
      } else {
        this.inputP2Name.value = newName;
      }
      
      this.updateAllTimeScoreUI();
      this.saveActiveGameState();
      if (this.gameMode === 'lan') this.syncNamesToServer();
    };
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveName();
      if (e.key === 'Escape') textSpan.textContent = oldName;
    });
    
    input.addEventListener('blur', saveName);
  }
  
  clearPreviews() {
    this.previewRow.innerHTML = '';
    document.querySelectorAll('.col-arrow').forEach(a => {
      a.classList.remove('active-red', 'active-yellow');
    });
  }
  
  showMovePreview(col) {
    const row = this.getNextOpenRow(this.board, col);
    if (row === -1) {
      this.clearPreviews();
      return;
    }
    
    this.previewRow.innerHTML = '';
    const previewTok = document.createElement('div');
    previewTok.className = `preview-token player${this.activePlayer}`;
    previewTok.style.left = `calc(${col} * (100% / var(--board-cols)) + (100% / var(--board-cols) - var(--token-size)) / 2)`;
    this.previewRow.appendChild(previewTok);
    
    // Light up column arrow
    document.querySelectorAll('.col-arrow').forEach((a, idx) => {
      a.classList.remove('active-red', 'active-yellow');
      if (idx === col) {
        a.classList.add(this.activePlayer === 1 ? 'active-red' : 'active-yellow');
      }
    });
  }
  
  handlePlayerMove(col) {
    const row = this.getNextOpenRow(this.board, col);
    if (row === -1) return; // Column full
    
    if (this.gameMode === 'lan') {
      // POST move to custom Python server coordinator
      this.postLANMove(col, row);
    } else {
      this.makeMove(row, col);
    }
  }
  
  makeMove(row, col) {
    this.board[row][col] = this.activePlayer;
    this.moveHistory.push({ row, col, player: this.activePlayer });
    
    this.sounds.playDrop(row);
    
    // Add chip element to DOM with drop translation
    const token = document.createElement('div');
    token.className = `token player${this.activePlayer}`;
    token.dataset.row = row;
    token.dataset.col = col;
    token.style.left = `calc(${col} * (100% / var(--board-cols)) + (100% / var(--board-cols) - var(--token-size)) / 2)`;
    token.style.transform = `translateY(calc(-1.5 * var(--cell-size) + (var(--cell-size) - var(--token-size)) / 2))`;
    this.tokensContainer.appendChild(token);
    
    this.animating = true;
    setTimeout(() => {
      token.style.transform = `translateY(calc(${row} * var(--cell-size) + (var(--cell-size) - var(--token-size)) / 2))`;
    }, 15);
    
    this.undoBtn.disabled = this.gameMode === 'lan'; // Disable undo in LAN
    
    this.saveActiveGameState();
    
    // Wait for the drop drop slide to end (~450ms) then check game state
    setTimeout(() => {
      this.animating = false;
      this.checkGameStatus();
    }, 450);
  }
  
  checkGameStatus() {
    const winInfo = this.checkWinCondition(this.board);
    
    if (winInfo) {
      this.gameOver = true;
      this.pauseTimer();
      this.highlightWinningTokens(winInfo.cells);
      this.sounds.playWin();
      this.confetti.start();
      
      const p1Name = this.p1NameText.textContent;
      const p2Name = this.p2NameText.textContent;
      
      const modeStats = this.scores[this.gameMode];
      let winnerName = "";
      if (winInfo.player === 1) {
        modeStats.p1++;
        winnerName = p1Name;
        this.allTimeScores[p1Name] = (this.allTimeScores[p1Name] || 0) + 1;
      } else {
        modeStats.p2++;
        winnerName = p2Name;
        this.allTimeScores[p2Name] = (this.allTimeScores[p2Name] || 0) + 1;
      }
      
      this.saveStats();
      this.saveAllTimeScores();
      this.saveActiveGameState();
      this.renderScores();
      this.updateAllTimeScoreUI();
      
      // Update UI banner
      this.turnText.textContent = `${winnerName} Wins!`;
      this.turnColorIndicator.className = `turn-color-indicator ${winInfo.player === 1 ? 'red' : 'yellow'}`;
      
      // Open win modal overlay
      const numMoves = this.moveHistory.length;
      this.winTitle.textContent = `${winnerName} Wins!`;
      this.winSubtitle.textContent = `Achieved a brilliant victory in ${numMoves} total moves.`;
      this.winEmoji.textContent = winInfo.player === 1 ? '🏆' : '🤖';
      
      setTimeout(() => {
        this.winOverlay.classList.remove('hidden');
      }, 750);
      
    } else if (this.isBoardFull()) {
      this.gameOver = true;
      this.pauseTimer();
      this.scores[this.gameMode].draws++;
      this.saveStats();
      this.saveActiveGameState();
      this.renderScores();
      
      this.turnText.textContent = "It's a Draw!";
      this.turnColorIndicator.className = 'turn-color-indicator';
      
      this.winTitle.textContent = "Match Draw!";
      this.winSubtitle.textContent = "A perfect defensive grid from both sides.";
      this.winEmoji.textContent = '🤝';
      
      setTimeout(() => {
        this.winOverlay.classList.remove('hidden');
      }, 750);
      
    } else {
      // Toggle active player
      this.activePlayer = this.activePlayer === 1 ? 2 : 1;
      this.updateTurnUI();
      this.saveActiveGameState();
      
      // Trigger AI turn directly
      if (!this.gameOver && this.gameMode === 'pve' && this.activePlayer === 2) {
        this.triggerAIMove();
      }
    }
  }
  
  triggerAIMove() {
    this.animating = true;
    this.turnText.textContent = "AI is computing...";
    
    setTimeout(() => {
      const aiCol = this.getBestMoveForPlayer(2);
      if (aiCol !== null) {
        const aiRow = this.getNextOpenRow(this.board, aiCol);
        this.animating = false;
        this.makeMove(aiRow, aiCol);
      } else {
        this.animating = false;
      }
    }, 600);
  }
  
  showHint() {
    if (this.gameOver || this.animating) return;
    
    const bestCol = this.getBestMoveForPlayer(this.activePlayer);
    if (bestCol !== null) {
      const arrow = document.querySelector(`.col-arrow[data-col="${bestCol}"]`);
      if (arrow) {
        arrow.classList.add('hint-glow');
        setTimeout(() => {
          arrow.classList.remove('hint-glow');
        }, 2000);
      }
    }
  }
  
  undoMove() {
    if (this.gameMode === 'lan' || this.moveHistory.length === 0 || this.animating) return;
    
    this.winOverlay.classList.add('hidden');
    this.confetti.stop();
    
    if (this.gameMode === 'pve') {
      const lastMove = this.moveHistory[this.moveHistory.length - 1];
      this.removeLastTokenDOM();
      this.board[lastMove.row][lastMove.col] = 0;
      this.moveHistory.pop();
      
      if (lastMove.player === 2 && this.moveHistory.length > 0) {
        const userMove = this.moveHistory[this.moveHistory.length - 1];
        this.removeLastTokenDOM();
        this.board[userMove.row][userMove.col] = 0;
        this.moveHistory.pop();
      }
      
      this.activePlayer = 1;
    } else {
      const lastMove = this.moveHistory[this.moveHistory.length - 1];
      this.removeLastTokenDOM();
      this.board[lastMove.row][lastMove.col] = 0;
      this.moveHistory.pop();
      this.activePlayer = lastMove.player;
    }
    
    this.gameOver = false;
    document.querySelectorAll('.token').forEach(t => t.classList.remove('winning-token'));
    
    this.updateTurnUI();
    this.resumeTimer();
    this.saveActiveGameState();
    
    if (this.moveHistory.length === 0) {
      this.undoBtn.disabled = true;
    }
  }
  
  removeLastTokenDOM() {
    const tokens = this.tokensContainer.querySelectorAll('.token');
    if (tokens.length > 0) {
      tokens[tokens.length - 1].remove();
    }
  }
  
  restartGame() {
    if (this.gameMode === 'lan') {
      // POST reset request to Python server coordinator
      fetch('/api/reset', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          this.applyLANServerState(data.state);
        });
    } else {
      this.board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(0));
      this.moveHistory = [];
      this.gameOver = false;
      this.animating = false;
      this.activePlayer = 1;
      
      this.tokensContainer.innerHTML = '';
      this.previewRow.innerHTML = '';
      this.winOverlay.classList.add('hidden');
      this.confetti.stop();
      this.undoBtn.disabled = true;
      
      this.updateTurnUI();
      this.startTimer();
      this.saveActiveGameState();
    }
  }
  
  updateTurnUI() {
    const p1Card = this.p1Card;
    const p2Card = this.p2Card;
    const p1Name = this.p1NameText.textContent;
    const p2Name = this.p2NameText.textContent;
    
    if (this.activePlayer === 1) {
      p1Card.classList.add('active');
      p2Card.classList.remove('active');
      this.turnColorIndicator.className = 'turn-color-indicator red';
      
      if (this.gameMode === 'lan') {
        this.turnText.textContent = this.lanRole === 1 ? "Your Turn" : `${p1Name}'s Turn`;
      } else {
        this.turnText.textContent = this.gameMode === 'pvp' ? `${p1Name}'s Turn` : "Your Turn";
      }
    } else {
      p1Card.classList.remove('active');
      p2Card.classList.add('active');
      this.turnColorIndicator.className = 'turn-color-indicator yellow';
      
      if (this.gameMode === 'lan') {
        this.turnText.textContent = this.lanRole === 2 ? "Your Turn" : `${p2Name}'s Turn`;
      } else {
        this.turnText.textContent = this.gameMode === 'pvp' ? `${p2Name}'s Turn` : "AI's Turn";
      }
    }
  }
  
  highlightWinningTokens(cells) {
    cells.forEach(([r, c]) => {
      const token = this.tokensContainer.querySelector(`.token[data-row="${r}"][data-col="${c}"]`);
      if (token) {
        token.classList.add('winning-token');
      }
    });
  }
  
  getNextOpenRow(board, col) {
    for (let r = this.rows - 1; r >= 0; r--) {
      if (board[r][col] === 0) return r;
    }
    return -1;
  }
  
  getValidMoves(board) {
    const valid = [];
    for (let c = 0; c < this.cols; c++) {
      if (board[0][c] === 0) valid.push(c);
    }
    return valid;
  }
  
  isBoardFull() {
    return this.moveHistory.length === this.rows * this.cols;
  }
  
  checkWinCondition(b) {
    // Horizontal Check
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c <= this.cols - 4; c++) {
        if (b[r][c] !== 0 && b[r][c] === b[r][c+1] && b[r][c] === b[r][c+2] && b[r][c] === b[r][c+3]) {
          return { player: b[r][c], cells: [[r, c], [r, c+1], [r, c+2], [r, c+3]] };
        }
      }
    }
    // Vertical Check
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r <= this.rows - 4; r++) {
        if (b[r][c] !== 0 && b[r][c] === b[r+1][c] && b[r][c] === b[r+2][c] && b[r][c] === b[r+3][c]) {
          return { player: b[r][c], cells: [[r, c], [r+1, c], [r+2, c], [r+3, c]] };
        }
      }
    }
    // Diagonal Check (descending down-right)
    for (let r = 0; r <= this.rows - 4; r++) {
      for (let c = 0; c <= this.cols - 4; c++) {
        if (b[r][c] !== 0 && b[r][c] === b[r+1][c+1] && b[r][c] === b[r+2][c+2] && b[r][c] === b[r+3][c+3]) {
          return { player: b[r][c], cells: [[r, c], [r+1, c+1], [r+2, c+2], [r+3, c+3]] };
        }
      }
    }
    // Diagonal Check (ascending up-right)
    for (let r = 3; r < this.rows; r++) {
      for (let c = 0; c <= this.cols - 4; c++) {
        if (b[r][c] !== 0 && b[r][c] === b[r-1][c+1] && b[r][c] === b[r-2][c+2] && b[r][c] === b[r-3][c+3]) {
          return { player: b[r][c], cells: [[r, c], [r-1, c+1], [r-2, c+2], [r-3, c+3]] };
        }
      }
    }
    return null;
  }
  
  // ================= LAN MULTIPLAYER SERVICES =================
  
  startLANPolling() {
    this.stopLANPolling();
    this.undoBtn.disabled = true; // Disable undo in LAN mode
    this.lanLastMovesCount = 0;
    
    // Poll LAN state every 500ms
    this.pollLANState();
    this.lanInterval = setInterval(() => this.pollLANState(), 500);
  }
  
  stopLANPolling() {
    if (this.lanInterval) {
      clearInterval(this.lanInterval);
      this.lanInterval = null;
    }
  }
  
  pollLANState() {
    fetch('/api/state')
      .then(res => res.json())
      .then(data => {
        this.applyLANServerState(data);
      })
      .catch(err => {
        console.error("Failed to poll LAN state from coordinator", err);
      });
  }
  
  applyLANServerState(state) {
    if (!state) return;
    
    // Sync current session scores and names
    this.p1NameText.textContent = state.p1_name;
    this.p2NameText.textContent = state.p2_name;
    this.inputP1Name.value = state.p1_name;
    this.inputP2Name.value = state.p2_name;
    
    this.scores.lan.p1 = state.p1_score;
    this.scores.lan.p2 = state.p2_score;
    this.scores.lan.draws = state.draws;
    this.renderScores();
    this.updateAllTimeScoreUI();
    
    // Sync timer
    this.timerSeconds = state.timerSeconds;
    this.updateTimerDisplay();
    
    // Sync Board Moves & Animations
    const serverMovesCount = state.moves.length;
    const localMovesCount = this.moveHistory.length;
    
    if (serverMovesCount === 0 && localMovesCount > 0) {
      // Server reset board: clean client locally
      this.board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(0));
      this.moveHistory = [];
      this.tokensContainer.innerHTML = '';
      this.winOverlay.classList.add('hidden');
      this.confetti.stop();
      this.gameOver = False;
      this.activePlayer = 1;
      this.updateTurnUI();
    } else if (serverMovesCount > localMovesCount) {
      // Loop and animate each new incoming move
      for (let i = localMovesCount; i < serverMovesCount; i++) {
        const move = state.moves[i];
        
        // Block board drawing if client already drew it (avoid duplicating elements)
        const duplicate = this.tokensContainer.querySelector(`.token[data-row="${move.row}"][data-col="${move.col}"]`);
        if (!duplicate) {
          this.board[move.row][move.col] = move.player;
          this.moveHistory.push(move);
          
          this.sounds.playDrop(move.row);
          
          const token = document.createElement('div');
          token.className = `token player${move.player}`;
          token.dataset.row = move.row;
          token.dataset.col = move.col;
          token.style.left = `calc(${move.col} * (100% / var(--board-cols)) + (100% / var(--board-cols) - var(--token-size)) / 2)`;
          token.style.transform = `translateY(calc(-1.5 * var(--cell-size) + (var(--cell-size) - var(--token-size)) / 2))`;
          this.tokensContainer.appendChild(token);
          
          // Animate falling
          this.animating = true;
          setTimeout(() => {
            token.style.transform = `translateY(calc(${move.row} * var(--cell-size) + (var(--cell-size) - var(--token-size)) / 2))`;
          }, 15);
          
          setTimeout(() => {
            this.animating = false;
            this.syncWinOverlayState(state);
          }, 450);
        }
      }
    }
    
    // Sync active turn if not currently dropping
    if (!this.animating) {
      this.activePlayer = state.activePlayer;
      this.gameOver = state.gameOver;
      this.updateTurnUI();
      this.syncWinOverlayState(state);
    }
  }
  
  syncWinOverlayState(state) {
    if (state.gameOver && this.winOverlay.classList.contains('hidden')) {
      this.gameOver = true;
      this.highlightWinningTokens(state.winningCells);
      this.confetti.start();
      
      const p1Name = this.p1NameText.textContent;
      const p2Name = this.p2NameText.textContent;
      
      if (state.winner) {
        const winnerName = state.winner === 1 ? p1Name : p2Name;
        this.turnText.textContent = `${winnerName} Wins!`;
        this.turnColorIndicator.className = `turn-color-indicator ${state.winner === 1 ? 'red' : 'yellow'}`;
        
        this.winTitle.textContent = `${winnerName} Wins!`;
        this.winSubtitle.textContent = `A glorious LAN victory achieved in ${state.moves.length} moves.`;
        this.winEmoji.textContent = state.winner === 1 ? '🏆' : '🤖';
      } else {
        this.turnText.textContent = "It's a Draw!";
        this.winTitle.textContent = "Match Draw!";
        this.winSubtitle.textContent = "A perfect defensive grid on the LAN.";
        this.winEmoji.textContent = '🤝';
      }
      
      setTimeout(() => {
        this.winOverlay.classList.remove('hidden');
      }, 750);
    }
  }
  
  postLANMove(col, row) {
    this.animating = true;
    
    const moveData = {
      col: col,
      row: row,
      player: this.lanRole
    };
    
    // Optimistic local draw
    this.makeMove(row, col);
    
    fetch('/api/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(moveData)
    })
      .then(res => res.json())
      .then(data => {
        this.applyLANServerState(data.state);
      })
      .catch(err => {
        console.error("Failed to POST move to server coordinator", err);
      });
  }
  
  syncNamesToServer() {
    const names = {
      p1_name: this.p1NameText.textContent,
      p2_name: this.p2NameText.textContent
    };
    fetch('/api/update_names', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(names)
    });
  }
  
  // ================= TIMER CONTROLS =================
  
  startTimer() {
    this.pauseTimer();
    this.timerSeconds = 0;
    this.updateTimerDisplay();
    this.timerInterval = setInterval(() => {
      this.timerSeconds++;
      this.updateTimerDisplay();
      
      // If LAN mode and P1, push active timer count to serve as server clock source
      if (this.gameMode === 'lan' && this.lanRole === 1 && !this.gameOver) {
        fetch('/api/sync_timer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timerSeconds: this.timerSeconds })
        });
      }
    }, 1000);
  }
  
  pauseTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
  
  resumeTimer() {
    if (!this.timerInterval && !this.gameOver) {
      this.timerInterval = setInterval(() => {
        this.timerSeconds++;
        this.updateTimerDisplay();
      }, 1000);
    }
  }
  
  updateTimerDisplay() {
    const mins = Math.floor(this.timerSeconds / 60).toString().padStart(2, '0');
    const secs = (this.timerSeconds % 60).toString().padStart(2, '0');
    this.timerDisplay.textContent = `${mins}:${secs}`;
  }
  
  // ================= ALL-TIME SCORE KEEPING & RESTORE =================
  
  loadAllTimeScores() {
    const stored = localStorage.getItem('connect4_alltime_db');
    if (stored) {
      try {
        this.allTimeScores = JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse all-time db", e);
      }
    }
  }
  
  saveAllTimeScores() {
    localStorage.setItem('connect4_alltime_db', JSON.stringify(this.allTimeScores));
  }
  
  updateAllTimeScoreUI() {
    const p1Name = this.p1NameText.textContent;
    const p2Name = this.p2NameText.textContent;
    
    const p1Wins = this.allTimeScores[p1Name] || 0;
    const p2Wins = this.allTimeScores[p2Name] || 0;
    
    this.p1Alltime.textContent = `All-Time Wins: ${p1Wins}`;
    this.p2Alltime.textContent = `All-Time Wins: ${p2Wins}`;
  }
  
  saveActiveGameState() {
    if (this.gameMode === 'lan') return; // Do not local autosave LAN states
    
    const state = {
      board: this.board,
      moveHistory: this.moveHistory,
      activePlayer: this.activePlayer,
      gameMode: this.gameMode,
      difficulty: this.difficulty,
      scores: this.scores,
      p1_name: this.p1NameText.textContent,
      p2_name: this.inputP1Name.value,
      p2_name_display: this.p2NameText.textContent,
      p2_name_input: this.inputP2Name.value,
      timerSeconds: this.timerSeconds,
      gameOver: this.gameOver
    };
    localStorage.setItem('connect4_active_game', JSON.stringify(state));
  }
  
  restoreActiveGameState() {
    const stored = localStorage.getItem('connect4_active_game');
    if (!stored) return false;
    
    try {
      const state = JSON.parse(stored);
      this.board = state.board;
      this.moveHistory = state.moveHistory;
      this.activePlayer = state.activePlayer;
      this.gameMode = state.gameMode;
      this.difficulty = state.difficulty;
      this.scores = state.scores;
      this.timerSeconds = state.timerSeconds;
      this.gameOver = state.gameOver;
      
      // Update UI texts
      this.p1NameText.textContent = state.p1_name;
      this.inputP1Name.value = state.p2_name;
      this.p2NameText.textContent = state.p2_name_display;
      this.inputP2Name.value = state.p2_name_input;
      
      // Update active highlights
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      if (this.gameMode === 'pvp') {
        this.modePvP.classList.add('active');
        this.p2NameInputGroup.classList.remove('hidden');
      } else if (this.gameMode === 'pve') {
        this.modePvE.classList.add('active');
        this.difficultyGroup.classList.remove('hidden');
        this.p2NameInputGroup.classList.add('hidden');
      }
      
      document.querySelectorAll('.diff-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.diff === this.difficulty);
      });
      
      // Restore tokens onto the board instantly
      this.tokensContainer.innerHTML = '';
      this.moveHistory.forEach(m => {
        const token = document.createElement('div');
        token.className = `token player${m.player}`;
        token.dataset.row = m.row;
        token.dataset.col = m.col;
        token.style.left = `calc(${m.col} * (100% / var(--board-cols)) + (100% / var(--board-cols) - var(--token-size)) / 2)`;
        token.style.transform = `translateY(calc(${m.row} * var(--cell-size) + (var(--cell-size) - var(--token-size)) / 2))`;
        this.tokensContainer.appendChild(token);
      });
      
      this.renderScores();
      this.updateAllTimeScoreUI();
      this.updateTurnUI();
      
      if (this.gameOver) {
        // Redraw winning pulses if restored on win
        const winInfo = this.checkWinCondition(this.board);
        if (winInfo) {
          this.highlightWinningTokens(winInfo.cells);
        }
      } else {
        // Resume ticking clock
        this.resumeTimer();
      }
      
      this.undoBtn.disabled = this.moveHistory.length === 0;
      return true;
      
    } catch (e) {
      console.error("Failed to restore saved game session", e);
      return false;
    }
  }
  
  // ================= AI ENGINE (MINIMAX WITH ALPHA-BETA PRUNING) =================
  
  getBestMoveForPlayer(player) {
    const validMoves = this.getValidMoves(this.board);
    if (validMoves.length === 0) return null;
    
    if (this.gameMode === 'pve' && player === 2 && this.difficulty === 'easy') {
      return validMoves[Math.floor(Math.random() * validMoves.length)];
    }
    
    const depth = (this.gameMode === 'pve' && player === 2 && this.difficulty === 'medium') ? 3 : 5;
    validMoves.sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3));
    
    let bestScore = player === 2 ? -Infinity : Infinity;
    let bestMoves = [];
    
    for (let col of validMoves) {
      const row = this.getNextOpenRow(this.board, col);
      this.board[row][col] = player;
      
      const nextIsMaximizing = player === 1;
      const score = this.minimax(this.board, depth - 1, -Infinity, Infinity, nextIsMaximizing);
      
      this.board[row][col] = 0;
      
      if (player === 2) {
        if (score > bestScore) {
          bestScore = score;
          bestMoves = [col];
        } else if (score === bestScore) {
          bestMoves.push(col);
        }
      } else {
        if (score < bestScore) {
          bestScore = score;
          bestMoves = [col];
        } else if (score === bestScore) {
          bestMoves.push(col);
        }
      }
    }
    
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }
  
  minimax(board, depth, alpha, beta, isMaximizing) {
    const winInfo = this.checkWinCondition(board);
    if (winInfo) {
      if (winInfo.player === 2) return 1000000 + depth;
      if (winInfo.player === 1) return -1000000 - depth;
    }
    
    const validMoves = this.getValidMoves(board);
    if (depth === 0 || validMoves.length === 0) {
      return this.evaluateBoard(board);
    }
    
    validMoves.sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3));
    
    if (isMaximizing) {
      let maxEval = -Infinity;
      for (let col of validMoves) {
        const row = this.getNextOpenRow(board, col);
        board[row][col] = 2;
        const evaluation = this.minimax(board, depth - 1, alpha, beta, false);
        board[row][col] = 0;
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (let col of validMoves) {
        const row = this.getNextOpenRow(board, col);
        board[row][col] = 1;
        const evaluation = this.minimax(board, depth - 1, alpha, beta, true);
        board[row][col] = 0;
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }
  
  evaluateBoard(board) {
    let score = 0;
    const centerCol = 3;
    const centerCount = this.countInCol(board, centerCol, 2);
    score += centerCount * 4;
    
    // Horizontal
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c <= this.cols - 4; c++) {
        const window = [board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]];
        score += this.evaluateWindow(window);
      }
    }
    
    // Vertical
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r <= this.rows - 4; r++) {
        const window = [board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]];
        score += this.evaluateWindow(window);
      }
    }
    
    // Diagonal down-right
    for (let r = 0; r <= this.rows - 4; r++) {
      for (let c = 0; c <= this.cols - 4; c++) {
        const window = [board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]];
        score += this.evaluateWindow(window);
      }
    }
    
    // Diagonal up-right
    for (let r = 3; r < this.rows; r++) {
      for (let c = 0; c <= this.cols - 4; c++) {
        const window = [board[r][c], board[r-1][c+1], board[r-2][c+2], board[r-3][c+3]];
        score += this.evaluateWindow(window);
      }
    }
    
    return score;
  }
  
  evaluateWindow(window) {
    let score = 0;
    const aiCount = window.filter(x => x === 2).length;
    const humanCount = window.filter(x => x === 1).length;
    const emptyCount = window.filter(x => x === 0).length;
    
    if (aiCount === 4) {
      score += 100000;
    } else if (aiCount === 3 && emptyCount === 1) {
      score += 120;
    } else if (aiCount === 2 && emptyCount === 2) {
      score += 10;
    }
    
    if (humanCount === 3 && emptyCount === 1) {
      score -= 600;
    } else if (humanCount === 2 && emptyCount === 2) {
      score -= 15;
    } else if (humanCount === 4) {
      score -= 80000;
    }
    
    return score;
  }
  
  countInCol(board, col, player) {
    let count = 0;
    for (let r = 0; r < this.rows; r++) {
      if (board[r][col] === player) count++;
    }
    return count;
  }
  
  // ================= SCORECARD PERSISTENCE =================
  
  loadStats() {
    const stored = localStorage.getItem('connect4_scores');
    if (stored) {
      try {
        this.scores = JSON.parse(stored);
      } catch (e) {
        console.error("Failed to load scores", e);
      }
    }
  }
  
  saveStats() {
    localStorage.setItem('connect4_scores', JSON.stringify(this.scores));
  }
  
  renderScores() {
    const stats = this.scores[this.gameMode];
    this.p1Score.textContent = stats.p1;
    this.p2Score.textContent = stats.p2;
    this.drawsStat.textContent = stats.draws;
  }
  
  resetStats() {
    if (this.gameMode === 'lan') {
      fetch('/api/reset_scores', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          this.applyLANServerState(data.state);
        });
    } else {
      this.scores[this.gameMode] = { p1: 0, p2: 0, draws: 0 };
      this.saveStats();
      this.saveActiveGameState();
      this.renderScores();
    }
  }
}

// Start Game
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
