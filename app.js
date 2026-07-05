/**
 * Connect Four - Game Logic Engine
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
    this.gameMode = 'pvp'; // 'pvp', 'pve', 'online', 'puzzle'
    this.coachEnabled = false;
    this.threatsEnabled = false;
    this.difficulty = 'medium'; // 'easy', 'medium', 'hard', 'expert'
    this.moveHistory = [];
    this.gameOver = false;
    this.animating = false;
    this.hoveredCol = null;
    
    
    // WebRTC Online Multiplayer variables
    this.peer = null;
    this.peerConn = null;
    this.peerId = null;
    this.isOnlineHost = false;
    
    // Timer
    this.timerSeconds = 0;
    this.timerInterval = null;
    this.timeControl = 0; // seconds
    this.p1TimeRemaining = 0;
    this.p2TimeRemaining = 0;
    
    this.matchTargetWins = 0;
    
    // Scores
    this.scores = {
      pvp: { p1: 0, p2: 0, draws: 0 },
      pve: { p1: 0, p2: 0, draws: 0 },
      online: { p1: 0, p2: 0, draws: 0 }
    };
    
    // All-time scores database
    this.allTimeScores = {};
    
    // Training Features
    this.evaluationHistory = [];
    this.currentPuzzleIndex = 0;
    this.trainingPuzzles = [
      {
        name: "Block the 7-Trap",
        description: "Yellow has set up a deadly 7-Trap. Find the only move that survives!",
        playerTurn: 1,
        board: [
          [0,0,0,0,0,0,0],
          [0,0,0,0,0,0,0],
          [0,0,0,0,0,0,0],
          [0,0,0,2,0,0,0],
          [0,0,2,2,0,0,0],
          [0,1,1,1,2,0,0]
        ]
      },
      {
        name: "The Double Threat",
        description: "Red can force a win in 3 moves. Can you find the start of the sequence?",
        playerTurn: 1,
        board: [
          [0,0,0,0,0,0,0],
          [0,0,0,0,0,0,0],
          [0,0,0,0,0,0,0],
          [0,0,0,1,0,0,0],
          [0,0,2,1,0,0,0],
          [0,2,2,1,0,0,0]
        ]
      }
    ];
    
    // Controllers
    this.sounds = new SoundController();
    this.confetti = new ConfettiController('confetti-canvas');
    
    // Initialize
    this.loadAllTimeScores();
    this.initDOM();
    
    // Try to restore saved game session, else load default scoreboard
    if (!this.restoreActiveGameState()) {
      this.loadStats();
      this.renderScores();
      this.updateTurnUI();
      this.startTimer();
    }
    
    // Parse URL check for online P2P join request
    const urlParams = new URLSearchParams(window.location.search);
    const joinRoomId = urlParams.get('join');
    if (joinRoomId) {
      setTimeout(() => {
        this.switchMode('online');
        this.connectToPeer(joinRoomId);
      }, 750);
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
    this.difficultyGroup = document.getElementById('difficulty-group');
    this.timerDisplay = document.getElementById('game-timer');
    this.coachToggle = document.getElementById('coach-toggle');
    this.threatsToggle = document.getElementById('threats-toggle');
    this.reviewGameBtn = document.getElementById('review-game-btn');
    this.analysisModal = document.getElementById('analysis-modal');
    this.analysisContent = document.getElementById('analysis-content');
    this.closeAnalysisBtn = document.getElementById('close-analysis-btn');
    this.clearStats = document.getElementById('clear-stats');
    
    // Settings Drawer
    this.settingsToggle = document.getElementById('settings-toggle');
    this.settingsClose = document.getElementById('settings-close');
    this.settingsDrawer = document.getElementById('settings-drawer');
    this.drawerOverlay = this.settingsDrawer.querySelector('.drawer-overlay');
    
    this.modePvP = document.getElementById('mode-pvp');
    this.modePvE = document.getElementById('mode-pve');
    this.modeOnline = document.getElementById('mode-online');
    this.modePuzzle = document.getElementById('mode-puzzle');
    
    this.difficultyGroup = document.getElementById('difficulty-group');
    this.onlineConfigGroup = document.getElementById('online-config-group');
    
    this.p1TimerUI = document.getElementById('p1-timer');
    this.p2TimerUI = document.getElementById('p2-timer');
    
    this.p1MatchFormatUI = document.getElementById('p1-match-format');
    this.p2MatchFormatUI = document.getElementById('p2-match-format');
    
    // Peer components
    this.peerStatus = document.getElementById('peer-status');
    this.onlineShareUrl = document.getElementById('online-share-url');
    this.copyOnlineUrlBtn = document.getElementById('copy-online-url-btn');
    this.onlineQrCode = document.getElementById('online-qr-code');
    this.inputPeerId = document.getElementById('input-peer-id');
    this.connectPeerBtn = document.getElementById('connect-peer-btn');
    this.playerRenameGroup = document.getElementById('player-rename-group');
    
    // Name inputs
    this.inputP1Name = document.getElementById('input-p1-name');
    this.inputP2Name = document.getElementById('input-p2-name');
    this.p2NameInputGroup = document.getElementById('p2-name-input-group');
    
    this.drawsStat = document.getElementById('draws-stat');
    this.clearStats = document.getElementById('clear-stats');
    this.clearAlltimeBtn = document.getElementById('clear-alltime');
    
    // Win overlay
    this.winOverlay = document.getElementById('win-overlay');
    this.winTitle = document.getElementById('win-title');
    this.winSubtitle = document.getElementById('win-subtitle');
    this.winEmoji = document.getElementById('win-emoji');
    
    // Coach and Move Tracker
    this.coachPanel = document.getElementById('coach-panel');
    this.coachIcon = document.getElementById('coach-icon');
    this.coachMessage = document.getElementById('coach-message');
    this.trackerList = document.getElementById('tracker-list');
    this.moveCount = 1;
    
    // Populate board cell covers
    this.boardCover.innerHTML = '';
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell';
        this.boardCover.appendChild(cell);
      }
    }
    
    // Populate accessible column controls
    this.columnsContainer.innerHTML = '';
    for (let c = 0; c < this.cols; c++) {
      const col = document.createElement('button');
      col.type = 'button';
      col.className = 'board-column';
      col.dataset.col = c;
      col.setAttribute('aria-label', `Drop token in column ${String.fromCharCode(65 + c)}`);
      this.columnsContainer.appendChild(col);
    }
    
    this.bindEvents();
    this.setupTheme();
  }
  
  bindEvents() {
    // Column hover and click triggers
    this.columnsContainer.addEventListener('click', (e) => {
      const colEl = e.target.closest('.board-column');
      if (!colEl || !this.canLocalPlayerAct(true)) return;
      
      const col = parseInt(colEl.dataset.col);
      this.handlePlayerMove(col);
    });
    
    this.columnsContainer.addEventListener('mousemove', (e) => {
      const colEl = e.target.closest('.board-column');
      if (!colEl || !this.canLocalPlayerAct(false)) {
        this.clearPreviews();
        return;
      }
      
      const col = parseInt(colEl.dataset.col);
      this.showMovePreview(col);
    });
    
    this.columnsContainer.addEventListener('mouseleave', () => {
      this.hoveredCol = null;
      this.clearPreviews();
    });

    this.columnsContainer.addEventListener('keydown', (e) => {
      const colEl = e.target.closest('.board-column');
      if (!colEl) return;

      const currentCol = parseInt(colEl.dataset.col);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const delta = e.key === 'ArrowLeft' ? -1 : 1;
        const nextCol = Math.max(0, Math.min(this.cols - 1, currentCol + delta));
        this.columnsContainer.querySelector(`[data-col="${nextCol}"]`)?.focus();
        this.showMovePreview(nextCol);
      }
    });
    
    // Inline renaming double clicks
    this.p1Label.addEventListener('dblclick', () => this.editPlayerNameInline(1));
    this.p2Label.addEventListener('dblclick', () => this.editPlayerNameInline(2));
    
    // Drawer Game Modes
    this.modePvP.addEventListener('click', () => this.switchMode('pvp'));
    this.modePvE.addEventListener('click', () => this.switchMode('pve'));
    this.modeOnline.addEventListener('click', () => this.switchMode('online'));
    this.modePuzzle.addEventListener('click', () => this.switchMode('puzzle'));

    // Connect to target Peer ID
    this.connectPeerBtn.addEventListener('click', () => {
      this.connectToPeer(this.inputPeerId.value.trim());
    });
    

    // Copy WebRTC URL
    this.copyOnlineUrlBtn.addEventListener('click', () => {
      this.sounds.playClick();
      this.onlineShareUrl.select();
      document.execCommand('copy');
      alert("Online P2P invite link copied to clipboard!");
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
    
    // Time control selectors
    document.querySelectorAll('.time-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.sounds.playClick();
        document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.timeControl = parseInt(e.target.dataset.time, 10);
        this.restartGame();
      });
    });
    
    // Match Length selectors
    document.querySelectorAll('.match-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.sounds.playClick();
        document.querySelectorAll('.match-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.matchTargetWins = parseInt(e.target.dataset.wins, 10);
        this.scores[this.gameMode] = { p1: 0, p2: 0, draws: 0 };
        this.renderScores();
        this.updateMatchFormatUI();
        this.restartGame();
      });
    });
    
    // Drawer Name Inputs
    this.inputP1Name.addEventListener('input', (e) => {
      const val = e.target.value.trim() || "Red Player";
      this.p1NameText.textContent = val;
      this.updateAllTimeScoreUI();
      this.saveActiveGameState();
      if (this.gameMode === 'online' && this.peerConn) {
        this.peerConn.send({ type: 'name_update', name: val });
      }
    });
    
    this.inputP2Name.addEventListener('input', (e) => {
      const val = e.target.value.trim() || "Yellow Player";
      this.p2NameText.textContent = val;
      this.updateAllTimeScoreUI();
      this.saveActiveGameState();
      if (this.gameMode === 'online' && this.peerConn) {
        this.peerConn.send({ type: 'name_update', name: val });
      }
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
    
    this.coachToggle.addEventListener('change', (e) => {
      this.coachEnabled = e.target.checked;
      if (!this.coachEnabled && this.coachPanel) {
        this.coachPanel.classList.add('hidden');
      } else if (this.coachEnabled && !this.gameOver) {
        this.evaluateMoveForCoach(this.board, this.activePlayer, null);
      }
    });

    this.threatsToggle.addEventListener('change', (e) => {
      this.threatsEnabled = e.target.checked;
      this.updateThreatIndicators();
    });
    
    this.reviewGameBtn.addEventListener('click', () => {
      this.sounds.playClick();
      this.generateAnalysisReport();
      this.analysisModal.classList.remove('hidden');
    });
    
    this.closeAnalysisBtn.addEventListener('click', () => {
      this.sounds.playClick();
      this.analysisModal.classList.add('hidden');
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

  canLocalPlayerAct(showAlert = false) {
    if (this.gameOver || this.animating) return false;
    if (this.gameMode === 'pve' && this.activePlayer === 2) return false;
    
    if (this.gameMode === 'puzzle') {
      const puzzle = this.trainingPuzzles[this.currentPuzzleIndex];
      if (this.activePlayer !== puzzle.playerTurn) return false;
    }

    if (this.gameMode === 'online') {
      if (!this.peerConn) return false;
      const myRole = this.isOnlineHost ? 1 : 2;
      if (this.activePlayer !== myRole) {
        if (showAlert) alert("It's not your turn! Please wait for your opponent.");
        return false;
      }
    }

    return true;
  }
  
  switchMode(mode, targetId = null) {
    if (this.gameMode === mode && mode !== 'online') return;
    this.sounds.playClick();
    
    // Clean up active WebRTC connections
    this.destroyPeerJS();
    
    this.gameMode = mode;
    
    // Reset UI indicators
    this.difficultyGroup.classList.add('hidden');
    this.onlineConfigGroup.classList.add('hidden');
    this.p2NameInputGroup.classList.remove('hidden');
    this.playerRenameGroup.classList.remove('hidden');
    
    this.modePvP.classList.remove('active');
    this.modePvE.classList.remove('active');
    this.modeOnline.classList.remove('active');
    if (this.modePuzzle) this.modePuzzle.classList.remove('active');
    
    if (mode === 'pvp') {
      this.modePvP.classList.add('active');
      this.p1NameText.textContent = this.inputP1Name.value.trim() || 'Red Player';
      this.p2NameText.textContent = this.inputP2Name.value.trim() || 'Yellow Player';
    } else if (mode === 'pve') {
      this.modePvE.classList.add('active');
      this.difficultyGroup.classList.remove('hidden');
      this.p1NameText.textContent = this.inputP1Name.value.trim() || 'Red Player';
      this.p2NameText.textContent = 'Computer';
      this.p2NameInputGroup.classList.add('hidden');
    } else if (mode === 'online') {
      this.modeOnline.classList.add('active');
      this.onlineConfigGroup.classList.remove('hidden');
      this.p2NameInputGroup.classList.add('hidden'); // Opponent name will sync automatically
      this.initPeerJS(targetId);
    } else if (mode === 'puzzle') {
      if (this.modePuzzle) this.modePuzzle.classList.add('active');
      this.playerRenameGroup.classList.add('hidden'); // Don't allow renaming in puzzle mode
    }
    
    this.updateAllTimeScoreUI();
    this.renderScores();
    this.restartGame();
  }

  editPlayerNameInline(player) {
    if (this.gameMode === 'pve' && player === 2) return; 
    if (this.gameMode === 'online') {
      // Direct peer: only allow renaming your own slot (P1 on Host is Red, P1 on Joiner is Yellow)
      const myRole = this.isOnlineHost ? 1 : 2;
      if (player !== myRole) return;
    }
    
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
      
      // Update settings inputs
      if (player === 1) {
        this.inputP1Name.value = newName;
      } else {
        this.inputP2Name.value = newName;
      }
      
      this.updateAllTimeScoreUI();
      this.saveActiveGameState();
      
      if (this.gameMode === 'online' && this.peerConn) {
        this.peerConn.send({ type: 'name_update', name: newName });
      }
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
      this.hoveredCol = null;
      this.clearPreviews();
      return;
    }
    
    this.hoveredCol = col;
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
    if (row === -1) return; 
    
    // Coach evaluation (async so it doesn't block move drop)
    const boardClone = JSON.parse(JSON.stringify(this.board));
    const player = this.activePlayer;
    setTimeout(() => {
      this.evaluateMoveForCoach(boardClone, player, col);
    }, 500);
    
    if (this.gameMode === 'online') {
      if (this.peerConn) {
        this.peerConn.send({ type: 'move', col: col });
        this.makeMove(row, col);
      }
    } else {
      this.makeMove(row, col);
    }
  }
  
  makeMove(row, col) {
    if (this.moveHistory.length === 0) {
      this.startTimer();
    }
    this.board[row][col] = this.activePlayer;
    this.moveHistory.push({ row, col, player: this.activePlayer });
    
    const colLetter = String.fromCharCode(65 + col);
    this.updateMoveTracker(colLetter, this.activePlayer);
    
    this.sounds.playDrop(row);
    
    // Add chip element to DOM
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
    
    // Disable undo for network matches
    this.undoBtn.disabled = this.gameMode === 'online';
    
    this.saveActiveGameState();
    
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
      
      this.turnText.textContent = `${winnerName} Wins!`;
      this.turnColorIndicator.className = `turn-color-indicator ${winInfo.player === 1 ? 'red' : 'yellow'}`;
      
      const numMoves = this.moveHistory.length;
      const isMatchWin = this.matchTargetWins > 0 && (modeStats.p1 >= this.matchTargetWins || modeStats.p2 >= this.matchTargetWins);
      
      if (this.gameMode === 'puzzle') {
        this.reviewGameBtn.style.display = 'none';
        if (winInfo.player === this.trainingPuzzles[this.currentPuzzleIndex].playerTurn) {
          this.winTitle.textContent = "Puzzle Solved!";
          this.winSubtitle.textContent = "Great job finding the winning move.";
          this.winEmoji.textContent = '🧩';
          this.currentPuzzleIndex++;
          if (this.currentPuzzleIndex >= this.trainingPuzzles.length) {
            this.currentPuzzleIndex = 0;
          }
        } else {
          this.winTitle.textContent = "Puzzle Failed!";
          this.winSubtitle.textContent = "You missed the critical move. Try again!";
          this.winEmoji.textContent = '❌';
        }
      } else {
        this.reviewGameBtn.style.display = 'block';
        this.winTitle.textContent = isMatchWin ? `SERIES VICTORY!` : `${winnerName} Wins!`;
        this.winSubtitle.textContent = isMatchWin 
          ? `${winnerName} wins the match ${modeStats.p1} - ${modeStats.p2}!` 
          : `Achieved a brilliant victory in ${numMoves} total moves.`;
        this.winEmoji.textContent = isMatchWin ? '🏆' : (winInfo.player === 1 ? 'R' : 'Y');
      }
      
      setTimeout(() => {
        this.winOverlay.classList.remove('hidden');
        setTimeout(() => {
          this.winOverlay.classList.add('hidden');
          this.confetti.stop();
        }, 3500);
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
      this.reviewGameBtn.style.display = 'block';
      
      setTimeout(() => {
        this.winOverlay.classList.remove('hidden');
        setTimeout(() => {
          this.winOverlay.classList.add('hidden');
        }, 3500);
      }, 750);
      
    } else {
      this.activePlayer = this.activePlayer === 1 ? 2 : 1;
      this.recordEvaluation();
      this.updateTurnUI();
      this.saveActiveGameState();
      
      if (!this.gameOver) {
        const isPvEComputerTurn = this.gameMode === 'pve' && this.activePlayer === 2;
        const isPuzzleComputerTurn = this.gameMode === 'puzzle' && this.activePlayer !== this.trainingPuzzles[this.currentPuzzleIndex].playerTurn;
        if (isPvEComputerTurn || isPuzzleComputerTurn) {
          this.triggerComputerMove();
        }
      }
    }
  }
  
  triggerComputerMove() {
    this.animating = true;
    this.turnText.textContent = "Computer is thinking...";
    
    setTimeout(() => {
      const computerCol = this.getBestMoveForPlayer(this.activePlayer);
      if (computerCol !== null) {
        const computerRow = this.getNextOpenRow(this.board, computerCol);
        this.animating = false;
        this.makeMove(computerRow, computerCol);
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
    if (this.gameMode === 'online' || this.moveHistory.length === 0 || this.animating) return;
    
    this.winOverlay.classList.add('hidden');
    this.confetti.stop();
    
    if (this.gameMode === 'pve') {
      const lastMove = this.moveHistory[this.moveHistory.length - 1];
      this.removeLastTokenDOM();
      this.board[lastMove.row][lastMove.col] = 0;
      this.moveHistory.pop();
      this.evaluationHistory.pop();
      
      if (lastMove.player === 2 && this.moveHistory.length > 0) {
        const userMove = this.moveHistory[this.moveHistory.length - 1];
        this.removeLastTokenDOM();
        this.board[userMove.row][userMove.col] = 0;
        this.moveHistory.pop();
        this.evaluationHistory.pop();
      }
      
      this.activePlayer = 1;
    } else {
      const lastMove = this.moveHistory[this.moveHistory.length - 1];
      this.removeLastTokenDOM();
      this.board[lastMove.row][lastMove.col] = 0;
      this.moveHistory.pop();
      this.evaluationHistory.pop();
      this.activePlayer = lastMove.player;
    }
    
    this.gameOver = false;
    document.querySelectorAll('.token').forEach(t => t.classList.remove('winning-token'));
    
    this.updateTurnUI();
    this.rebuildMoveTracker();
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
  
  restartGame(options = {}) {
    const shouldBroadcast = options.broadcast !== false;

    if (this.matchTargetWins > 0) {
      const p1Score = this.scores[this.gameMode].p1;
      const p2Score = this.scores[this.gameMode].p2;
      if (p1Score >= this.matchTargetWins || p2Score >= this.matchTargetWins) {
        this.scores[this.gameMode] = { p1: 0, p2: 0, draws: 0 };
        this.renderScores();
        this.saveStats();
      }
      this.newGameBtn.innerHTML = "<span class=\"icon\">+</span> Next Game";
    } else {
      this.newGameBtn.innerHTML = "<span class=\"icon\">+</span> New Game";
    }

    if (this.gameMode === 'puzzle') {
      const puzzle = this.trainingPuzzles[this.currentPuzzleIndex];
      this.board = JSON.parse(JSON.stringify(puzzle.board));
      this.activePlayer = puzzle.playerTurn;
      this.p1NameText.textContent = `Puzzle ${this.currentPuzzleIndex + 1}`;
      this.p2NameText.textContent = `of ${this.trainingPuzzles.length}`;
      this.scores['puzzle'] = { p1: " ", p2: " ", draws: 0 };
      this.matchTargetWins = 0; // Disable match length for puzzles
    } else {
      this.board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(0));
      this.activePlayer = 1;
    }
    
    this.moveHistory = [];
    this.evaluationHistory = [];
    this.gameOver = false;
    this.animating = false;
    this.tokensContainer.innerHTML = '';
    this.previewRow.innerHTML = '';
    
    // Render existing pieces (for puzzles)
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.board[r][c] !== 0) {
          const player = this.board[r][c];
          const token = document.createElement('div');
          token.className = `token player${player}`;
          token.dataset.row = r;
          token.dataset.col = c;
          token.style.left = `calc(${c} * (100% / var(--board-cols)) + (100% / var(--board-cols) - var(--token-size)) / 2)`;
          token.style.transform = `translateY(calc(${r} * var(--cell-size) + (var(--cell-size) - var(--token-size)) / 2))`;
          this.tokensContainer.appendChild(token);
        }
      }
    }
    
    this.resetMoveTracker();
    this.winOverlay.classList.add('hidden');
    this.confetti.stop();
    this.undoBtn.disabled = true;

    this.p1TimeRemaining = this.timeControl;
    this.p2TimeRemaining = this.timeControl;
    this.updatePlayerTimersUI();

    this.updateTurnUI();
    this.pauseTimer();
    this.timerSeconds = 0;
    this.updateTimerDisplay();

    if (this.gameMode === 'online') {
      if (shouldBroadcast && this.peerConn) {
        this.peerConn.send({ type: 'reset' });
      }
    } else {
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
      
      if (this.gameMode === 'online') {
        const myRole = this.isOnlineHost ? 1 : 2;
        this.turnText.textContent = myRole === 1 ? "Your Turn" : `${p1Name}'s Turn`;
      } else {
        this.turnText.textContent = this.gameMode === 'pvp' ? `${p1Name}'s Turn` : "Your Turn";
      }
    } else {
      p1Card.classList.remove('active');
      p2Card.classList.add('active');
      this.turnColorIndicator.className = 'turn-color-indicator yellow';
      
      if (this.gameMode === 'online') {
        const myRole = this.isOnlineHost ? 1 : 2;
        this.turnText.textContent = myRole === 2 ? "Your Turn" : `${p2Name}'s Turn`;
      } else {
        this.turnText.textContent = this.gameMode === 'pvp' ? `${p2Name}'s Turn` : "Computer's Turn";
      }
    }

    if (this.hoveredCol !== null) {
      if (this.canLocalPlayerAct(false)) {
        this.showMovePreview(this.hoveredCol);
      } else {
        this.clearPreviews();
      }
    }
    
    this.updateThreatIndicators();
  }
  
  updateThreatIndicators() {
    // Clear existing threats
    document.querySelectorAll('.threat-indicator').forEach(el => el.remove());
    if (!this.threatsEnabled || this.gameOver) return;

    const validMoves = this.getValidMoves(this.board);
    validMoves.forEach(col => {
      const row = this.getNextOpenRow(this.board, col);
      
      let p1Wins = false;
      let p2Wins = false;

      // Check P1
      this.board[row][col] = 1;
      if (this.checkWinCondition(this.board)) p1Wins = true;
      
      // Check P2
      this.board[row][col] = 2;
      if (this.checkWinCondition(this.board)) p2Wins = true;
      
      // Reset
      this.board[row][col] = 0;

      if (p1Wins || p2Wins) {
        const indicator = document.createElement('div');
        let colorClass = 'threat-red';
        if (p1Wins && p2Wins) colorClass = 'threat-dual';
        else if (p2Wins) colorClass = 'threat-yellow';
        
        indicator.className = `threat-indicator ${colorClass}`;
        indicator.style.left = `calc(${col} * (100% / var(--board-cols)) + (100% / var(--board-cols) - var(--token-size)) / 2)`;
        indicator.style.top = `calc(${row} * var(--cell-size) + (var(--cell-size) - var(--token-size)) / 2)`;
        this.tokensContainer.appendChild(indicator);
      }
    });
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
  
  recordEvaluation() {
    if (this.gameMode === 'puzzle' || this.gameOver) return;
    
    const isP2Turn = this.activePlayer === 2;
    const score = this.minimax(this.board, 4, -Infinity, Infinity, isP2Turn);
    
    const p1Advantage = -score;
    
    this.evaluationHistory.push({
      player: this.activePlayer === 1 ? 2 : 1, // The player who just moved
      moveNum: this.moveHistory.length,
      score: p1Advantage
    });
  }
  
  generateAnalysisReport() {
    if (this.evaluationHistory.length === 0) {
      this.analysisContent.innerHTML = "<p>No data available for this game.</p>";
      return;
    }

    let biggestBlunder = null;
    let bestMove = null;
    let maxDrop = 0;
    let maxGain = 0;
    let prevScore = 0; 

    this.evaluationHistory.forEach((evalData) => {
      let diff = evalData.score - prevScore;
      let gain = evalData.player === 1 ? diff : -diff;
      let drop = evalData.player === 1 ? -diff : diff;
      
      if (gain > maxGain && gain > 15) { 
        maxGain = gain;
        bestMove = evalData;
      }
      if (drop > maxDrop && drop > 15) { 
        maxDrop = drop;
        biggestBlunder = evalData;
      }
      prevScore = evalData.score;
    });

    let html = `
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
          <h3 style="margin-top:0; margin-bottom: 5px; color: #ffeb99;">Biggest Blunder</h3>
          ${biggestBlunder 
            ? `<p style="margin:0;">Turn ${biggestBlunder.moveNum} by ${biggestBlunder.player === 1 ? 'Red' : 'Yellow'}.<br>The evaluation dropped significantly, giving away a huge advantage.</p>` 
            : `<p style="margin:0;">No major blunders detected! A very solid game.</p>`}
        </div>
        
        <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
          <h3 style="margin-top:0; margin-bottom: 5px; color: #ffeb99;">Best Move</h3>
          ${bestMove 
            ? `<p style="margin:0;">Turn ${bestMove.moveNum} by ${bestMove.player === 1 ? 'Red' : 'Yellow'}.<br>A brilliant move that swung the math in their favor.</p>` 
            : `<p style="margin:0;">No single move stood out. Steady play throughout.</p>`}
        </div>
      </div>
    `;
    this.analysisContent.innerHTML = html;
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
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c <= this.cols - 4; c++) {
        if (b[r][c] !== 0 && b[r][c] === b[r][c+1] && b[r][c] === b[r][c+2] && b[r][c] === b[r][c+3]) {
          return { player: b[r][c], cells: [[r, c], [r, c+1], [r, c+2], [r, c+3]] };
        }
      }
    }
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r <= this.rows - 4; r++) {
        if (b[r][c] !== 0 && b[r][c] === b[r+1][c] && b[r][c] === b[r+2][c] && b[r][c] === b[r+3][c]) {
          return { player: b[r][c], cells: [[r, c], [r+1, c], [r+2, c], [r+3, c]] };
        }
      }
    }
    for (let r = 0; r <= this.rows - 4; r++) {
      for (let c = 0; c <= this.cols - 4; c++) {
        if (b[r][c] !== 0 && b[r][c] === b[r+1][c+1] && b[r][c] === b[r+2][c+2] && b[r][c] === b[r+3][c+3]) {
          return { player: b[r][c], cells: [[r, c], [r+1, c+1], [r+2, c+2], [r+3, c+3]] };
        }
      }
    }
    for (let r = 3; r < this.rows; r++) {
      for (let c = 0; c <= this.cols - 4; c++) {
        if (b[r][c] !== 0 && b[r][c] === b[r-1][c+1] && b[r][c] === b[r-2][c+2] && b[r][c] === b[r-3][c+3]) {
          return { player: b[r][c], cells: [[r, c], [r-1, c+1], [r-2, c+2], [r-3, c+3]] };
        }
      }
    }
    return null;
  }
  
  
  // ================= WEBRTC ONLINE MULTIPLAYER SERVICES =================
  
  initPeerJS(targetId = null) {
    this.destroyPeerJS();
    
    this.peerStatus.textContent = "Connecting...";
    this.peerStatus.className = "status-badge waiting";
    
    if (targetId) {
      this.isOnlineHost = false;
      this.p1NameText.textContent = 'Host (Red)';
      this.p2NameText.textContent = this.inputP1Name.value.trim() || 'Guest (Yellow)';
    } else {
      this.isOnlineHost = true;
      this.p1NameText.textContent = this.inputP1Name.value.trim() || 'Host (Red)';
      this.p2NameText.textContent = 'Waiting...';
    }
    this.updateAllTimeScoreUI();
    
    // Connect to PeerJS cloud
    this.peer = new Peer();
    
    this.peer.on('open', (id) => {
      this.peerId = id;
      
      if (this.isOnlineHost) {
        this.peerStatus.textContent = "Waiting for Friend...";
        this.peerStatus.className = "status-badge waiting";
        
        // Build P2P connection URL
        const origin = window.location.origin;
        const path = window.location.pathname;
        const shareLink = `${origin}${path}?join=${id}`;
        
        this.onlineShareUrl.value = shareLink;
        this.onlineQrCode.src = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(shareLink)}`;
        this.onlineQrCode.style.display = "block";
      } else {
        // We are the joiner, connect to target host now that our peer is open
        this.peerStatus.textContent = "Connecting to Host...";
        this.peerStatus.className = "status-badge waiting";
        
        this.peerConn = this.peer.connect(targetId);
        this.setupPeerConnListeners(this.peerConn);
      }
    });
    
    this.peer.on('connection', (conn) => {
      // Disconnect old connection if new one overrides
      if (this.peerConn) {
        this.peerConn.close();
      }
      this.peerConn = conn;
      this.setupPeerConnListeners(conn);
      
      this.peerStatus.textContent = "Connected";
      this.peerStatus.className = "status-badge connected";
      this.sounds.playClick();
      
      // Sync names
      conn.send({ type: 'init', name: this.p1NameText.textContent });
    });
    
    this.peer.on('error', (err) => {
      console.error("PeerJS Error:", err);
      this.peerStatus.textContent = "Server Error";
      this.peerStatus.className = "status-badge disconnected";
      alert("PeerJS server connection failed: " + err.type);
    });
  }
  
  connectToPeer(targetId) {
    if (!targetId) return;
    this.initPeerJS(targetId);
  }
  
  setupPeerConnListeners(conn) {
    conn.on('open', () => {
      this.peerStatus.textContent = "Connected";
      this.peerStatus.className = "status-badge connected";
      this.sounds.playClick();
      
      // Close settings drawer on connection
      this.settingsDrawer.classList.add('hidden');
      
      // Send name
      conn.send({ type: 'init', name: this.p1NameText.textContent });
      
      // Joiner setup names
      if (!this.isOnlineHost) {
        this.p2NameText.textContent = this.inputP1Name.value.trim() || 'Guest (Yellow)';
        this.p1NameText.textContent = 'Host (Red)';
      }
      this.updateAllTimeScoreUI();
      this.restartGame();
    });
    
    conn.on('data', (data) => {
      if (!data) return;
      
      switch (data.type) {
        case 'init':
          if (this.isOnlineHost) {
            this.p2NameText.textContent = data.name;
          } else {
            this.p1NameText.textContent = data.name;
          }
          this.updateAllTimeScoreUI();
          break;
          
        case 'name_update':
          if (this.isOnlineHost) {
            this.p2NameText.textContent = data.name;
          } else {
            this.p1NameText.textContent = data.name;
          }
          this.updateAllTimeScoreUI();
          break;
          
        case 'move':
          const row = this.getNextOpenRow(this.board, data.col);
          if (row !== -1) {
            this.makeMove(row, data.col);
          }
          break;
          
        case 'reset':
          this.restartGame({ broadcast: false });
          break;
          
        case 'timer_sync':
          this.timerSeconds = data.seconds;
          if (data.p1Time !== undefined) {
            this.p1TimeRemaining = data.p1Time;
            this.p2TimeRemaining = data.p2Time;
            this.updatePlayerTimersUI();
            if (this.p1TimeRemaining <= 0) this.handleTimeout(1);
            if (this.p2TimeRemaining <= 0) this.handleTimeout(2);
          }
          this.updateTimerDisplay();
          break;
      }
    });
    
    conn.on('close', () => {
      this.peerStatus.textContent = "Disconnected";
      this.peerStatus.className = "status-badge disconnected";
      this.peerConn = null;
      alert("Your opponent has disconnected.");
    });
  }
  
  destroyPeerJS() {
    if (this.peerConn) {
      this.peerConn.close();
      this.peerConn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.peerId = null;
    if (this.peerStatus) {
      this.peerStatus.textContent = "Idle";
      this.peerStatus.className = "status-badge disconnected";
    }
  }
  
  // ================= TIMER CONTROLS =================
  
  startTimer() {
    this.pauseTimer();
    this.timerSeconds = 0;
    this.updateTimerDisplay();
    this.timerInterval = setInterval(() => {
      this.timerSeconds++;
      this.updateTimerDisplay();
      
      this.tickPlayerClocks();

      // WebRTC Host clock broadcast
      if (this.gameMode === 'online' && this.isOnlineHost && this.peerConn && !this.gameOver) {
        this.peerConn.send({ 
          type: 'timer_sync', 
          seconds: this.timerSeconds,
          p1Time: this.p1TimeRemaining,
          p2Time: this.p2TimeRemaining
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
        this.tickPlayerClocks();
      }, 1000);
    }
  }
  
  tickPlayerClocks() {
    if (this.timeControl > 0 && !this.gameOver) {
      if (this.activePlayer === 1) {
        this.p1TimeRemaining--;
        if (this.p1TimeRemaining <= 0) {
          this.p1TimeRemaining = 0;
          this.handleTimeout(1);
        }
      } else {
        this.p2TimeRemaining--;
        if (this.p2TimeRemaining <= 0) {
          this.p2TimeRemaining = 0;
          this.handleTimeout(2);
        }
      }
      this.updatePlayerTimersUI();
    }
  }

  updatePlayerTimersUI() {
    if (this.timeControl === 0) {
      this.p1TimerUI.classList.add('hidden');
      this.p2TimerUI.classList.add('hidden');
      return;
    }
    
    this.p1TimerUI.classList.remove('hidden');
    this.p2TimerUI.classList.remove('hidden');
    
    const formatTime = (seconds) => {
      const m = Math.floor(seconds / 60).toString().padStart(2, '0');
      const s = (seconds % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };
    
    this.p1TimerUI.textContent = formatTime(this.p1TimeRemaining);
    this.p2TimerUI.textContent = formatTime(this.p2TimeRemaining);
    
    this.p1TimerUI.classList.toggle('danger', this.p1TimeRemaining <= 10 && this.p1TimeRemaining > 0);
    this.p2TimerUI.classList.toggle('danger', this.p2TimeRemaining <= 10 && this.p2TimeRemaining > 0);
  }
  
  handleTimeout(losingPlayer) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.pauseTimer();
    
    const p1Name = this.p1NameText.textContent;
    const p2Name = this.p2NameText.textContent;
    const winner = losingPlayer === 1 ? 2 : 1;
    const winnerName = winner === 1 ? p1Name : p2Name;
    
    this.sounds.playWin();
    
    this.scores[this.gameMode][winner === 1 ? 'p1' : 'p2']++;
    this.allTimeScores[winnerName] = (this.allTimeScores[winnerName] || 0) + 1;
    
    this.saveStats();
    this.saveAllTimeScores();
    this.renderScores();
    this.updateAllTimeScoreUI();
    
    this.turnText.textContent = `${winnerName} Wins!`;
    this.turnColorIndicator.className = `turn-color-indicator ${winner === 1 ? 'red' : 'yellow'}`;
    
    const modeStats = this.scores[this.gameMode];
    const isMatchWin = this.matchTargetWins > 0 && (modeStats.p1 >= this.matchTargetWins || modeStats.p2 >= this.matchTargetWins);
    
    this.winTitle.textContent = isMatchWin ? `SERIES VICTORY!` : `Time's Up!`;
    this.winSubtitle.textContent = isMatchWin 
      ? `${winnerName} wins the match ${modeStats.p1} - ${modeStats.p2}!` 
      : `${winnerName} wins on time!`;
    this.winEmoji.textContent = isMatchWin ? '🏆' : '⏱️';
    
    setTimeout(() => {
      this.winOverlay.classList.remove('hidden');
      setTimeout(() => {
        this.winOverlay.classList.add('hidden');
      }, 3500);
    }, 500);
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
    
    this.p1Alltime.textContent = 'CONNECT 4';
    this.p2Alltime.textContent = 'CONNECT 4';
    this.p1Alltime.setAttribute('title', `${p1Name} lifetime wins: ${p1Wins}`);
    this.p2Alltime.setAttribute('title', `${p2Name} lifetime wins: ${p2Wins}`);
  }
  
  saveActiveGameState() {
    if (this.gameMode === 'online') return; 
    
    const state = {
      board: this.board,
      moveHistory: this.moveHistory,
      activePlayer: this.activePlayer,
      gameMode: this.gameMode,
      difficulty: this.difficulty,
      scores: this.scores,
      p1_name: this.p1NameText.textContent,
      p1_name_input: this.inputP1Name.value,
      p2_name_display: this.p2NameText.textContent,
      p2_name_input: this.inputP2Name.value,
      timerSeconds: this.timerSeconds,
      timeControl: this.timeControl,
      matchTargetWins: this.matchTargetWins,
      p1TimeRemaining: this.p1TimeRemaining,
      p2TimeRemaining: this.p2TimeRemaining,
      gameOver: this.gameOver
    };
    localStorage.setItem('connect4_active_game', JSON.stringify(state));
  }
  
  restoreActiveGameState() {
    const stored = localStorage.getItem('connect4_active_game');
    if (!stored) return false;
    
    try {
      const state = JSON.parse(stored);
      
      // Do not restore Online states dynamically from previous local storage runs
      if (state.gameMode === 'online') return false;
      
      this.board = state.board;
      this.moveHistory = state.moveHistory;
      this.activePlayer = state.activePlayer;
      this.gameMode = state.gameMode;
      this.difficulty = state.difficulty;
      this.scores = state.scores;
      this.timerSeconds = state.timerSeconds;
      
      this.timeControl = state.timeControl || 0;
      this.matchTargetWins = state.matchTargetWins || 0;
      this.updateMatchFormatUI();
      
      this.p1TimeRemaining = state.p1TimeRemaining !== undefined ? state.p1TimeRemaining : this.timeControl;
      this.p2TimeRemaining = state.p2TimeRemaining !== undefined ? state.p2TimeRemaining : this.timeControl;
      this.updatePlayerTimersUI();
      
      this.gameOver = state.gameOver;
      
      const p1InputName = state.p1_name_input || state.p1_name || 'Red Player';
      const p2InputName = state.p2_name_input || state.p2_name_display || 'Yellow Player';
      this.p1NameText.textContent = state.p1_name || p1InputName;
      this.inputP1Name.value = p1InputName;
      this.inputP2Name.value = p2InputName;
      this.p2NameText.textContent = this.gameMode === 'pve' ? 'Computer' : (state.p2_name_display || p2InputName);
      
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
      
      this.tokensContainer.innerHTML = '';
      this.resetMoveTracker();
      this.moveHistory.forEach(m => {
        const token = document.createElement('div');
        token.className = `token player${m.player}`;
        token.dataset.row = m.row;
        token.dataset.col = m.col;
        token.style.left = `calc(${m.col} * (100% / var(--board-cols)) + (100% / var(--board-cols) - var(--token-size)) / 2)`;
        token.style.transform = `translateY(calc(${m.row} * var(--cell-size) + (var(--cell-size) - var(--token-size)) / 2))`;
        this.tokensContainer.appendChild(token);
      });
      this.rebuildMoveTracker();
      this.updateThreatIndicators();
      
      this.renderScores();
      this.updateAllTimeScoreUI();
      this.updateTurnUI();
      
      if (this.gameOver) {
        const winInfo = this.checkWinCondition(this.board);
        if (winInfo) {
          this.highlightWinningTokens(winInfo.cells);
        }
      } else {
        if (this.moveHistory.length > 0) {
          this.resumeTimer();
        }
      }
      
      this.undoBtn.disabled = this.moveHistory.length === 0;
      return true;
      
    } catch (e) {
      console.error("Failed to restore saved game session", e);
      return false;
    }
  }
  
  // ================= COMPUTER STRATEGY =================
  
  getBestMoveForPlayer(player) {
    const validMoves = this.getValidMoves(this.board);
    if (validMoves.length === 0) return null;
    
    if (this.gameMode === 'pve' && player === 2 && this.difficulty === 'easy') {
      if (Math.random() < 0.25) {
        return validMoves[Math.floor(Math.random() * validMoves.length)];
      }
    }
    
    let depth = 5;
    if (this.difficulty === 'easy') depth = 1;
    if (this.difficulty === 'medium') depth = 2;
    if (this.difficulty === 'expert') depth = 7;
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
    const computerCenterCount = this.countInCol(board, centerCol, 2);
    const humanCenterCount = this.countInCol(board, centerCol, 1);
    score += (computerCenterCount * 4);
    score -= (humanCenterCount * 4);
    
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c <= this.cols - 4; c++) {
        const window = [board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]];
        score += this.evaluateWindow(window);
      }
    }
    
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r <= this.rows - 4; r++) {
        const window = [board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]];
        score += this.evaluateWindow(window);
      }
    }
    
    for (let r = 0; r <= this.rows - 4; r++) {
      for (let c = 0; c <= this.cols - 4; c++) {
        const window = [board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]];
        score += this.evaluateWindow(window);
      }
    }
    
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
    const computerCount = window.filter(x => x === 2).length;
    const humanCount = window.filter(x => x === 1).length;
    const emptyCount = window.filter(x => x === 0).length;
    
    if (computerCount === 4) {
      score += 100000;
    } else if (computerCount === 3 && emptyCount === 1) {
      score += 120;
    } else if (computerCount === 2 && emptyCount === 2) {
      score += 10;
    }
    
    if (humanCount === 3 && emptyCount === 1) {
      score -= 120;
    } else if (humanCount === 2 && emptyCount === 2) {
      score -= 10;
    } else if (humanCount === 4) {
      score -= 100000;
    }
    
    return score;
  }
  
  getBoardStats(board, player) {
    const opponent = player === 1 ? 2 : 1;
    let my3 = 0, my2 = 0, opp3 = 0;
    
    const checkWindow = (window) => {
      const myCount = window.filter(x => x === player).length;
      const oppCount = window.filter(x => x === opponent).length;
      const emptyCount = window.filter(x => x === 0).length;
      
      if (myCount === 3 && emptyCount === 1) my3++;
      if (myCount === 2 && emptyCount === 2) my2++;
      if (oppCount === 3 && emptyCount === 1) opp3++;
    };
    
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c <= this.cols - 4; c++) {
        checkWindow([board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]]);
      }
    }
    
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r <= this.rows - 4; r++) {
        checkWindow([board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]]);
      }
    }
    
    for (let r = 0; r <= this.rows - 4; r++) {
      for (let c = 0; c <= this.cols - 4; c++) {
        checkWindow([board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]]);
      }
    }
    
    for (let r = 3; r < this.rows; r++) {
      for (let c = 0; c <= this.cols - 4; c++) {
        checkWindow([board[r][c], board[r-1][c+1], board[r-2][c+2], board[r-3][c+3]]);
      }
    }
    
    return { my3, my2, opp3 };
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
    localStorage.setItem('connect4_scores', JSON.stringify({
      scores: this.scores,
      matchTargetWins: this.matchTargetWins
    }));
  }
  
  renderScores() {
    const stats = this.scores[this.gameMode];
    this.p1Score.textContent = stats.p1;
    this.p2Score.textContent = stats.p2;
    this.drawsStat.textContent = stats.draws;
  }
  
  updateMatchFormatUI() {
    if (this.matchTargetWins > 0) {
      this.p1MatchFormatUI.textContent = `FIRST TO ${this.matchTargetWins}`;
      this.p2MatchFormatUI.textContent = `FIRST TO ${this.matchTargetWins}`;
      this.p1MatchFormatUI.classList.remove('hidden');
      this.p2MatchFormatUI.classList.remove('hidden');
      this.newGameBtn.innerHTML = "<span class=\"icon\">+</span> Next Game";
    } else {
      this.p1MatchFormatUI.classList.add('hidden');
      this.p2MatchFormatUI.classList.add('hidden');
      this.newGameBtn.innerHTML = "<span class=\"icon\">+</span> New Game";
    }
  }
  
  resetStats() {
    this.scores[this.gameMode] = { p1: 0, p2: 0, draws: 0 };
    this.saveStats();
    this.saveActiveGameState();
    this.renderScores();
  }

  // ================= MOVE TRACKER AND COACH =================

  resetMoveTracker() {
    this.moveCount = 1;
    if (this.trackerList) {
      this.trackerList.innerHTML = '';
    }
  }

  rebuildMoveTracker() {
    const moves = [...this.moveHistory];
    this.resetMoveTracker();
    moves.forEach(({ col, player }) => {
      this.updateMoveTracker(String.fromCharCode(65 + col), player);
    });
  }
  
  updateMoveTracker(colLetter, player) {
    if (!this.trackerList) return;
    
    if (player === 1) {
      const entry = document.createElement('div');
      entry.className = 'move-entry';
      entry.id = `move-${this.moveCount}`;
      
      const numSpan = document.createElement('span');
      numSpan.className = 'move-num';
      numSpan.textContent = `${this.moveCount}.`;
      
      const p1Span = document.createElement('span');
      p1Span.className = 'move-p1';
      p1Span.textContent = colLetter;
      
      const p2Span = document.createElement('span');
      p2Span.className = 'move-p2';
      
      entry.appendChild(numSpan);
      entry.appendChild(p1Span);
      entry.appendChild(p2Span);
      
      this.trackerList.appendChild(entry);
      this.trackerList.scrollTop = this.trackerList.scrollHeight;
    } else {
      const entry = this.trackerList.querySelector(`#move-${this.moveCount}`);
      if (entry) {
        const p2Span = entry.querySelector('.move-p2');
        if (p2Span) p2Span.textContent = colLetter;
      }
      this.moveCount++;
    }
  }

  evaluateMoveForCoach(boardState, player, chosenCol) {
    if (!this.coachPanel || !this.coachEnabled) return;
    
    this.coachPanel.classList.remove('hidden');
    this.coachMessage.textContent = "Analyzing...";
    this.coachIcon.textContent = "◇";
    
    const opponent = player === 1 ? 2 : 1;
    
    // 1. Did the player have an immediate winning move available?
    let playerWinningCol = -1;
    const validMoves = this.getValidMoves(boardState);
    if (validMoves.length === 0) return;
    
    for (let col of validMoves) {
      const row = this.getNextOpenRow(boardState, col);
      boardState[row][col] = player;
      if (this.checkWinCondition(boardState)) playerWinningCol = col;
      boardState[row][col] = 0;
    }
    
    // 2. Did the opponent have an immediate winning move available (that we needed to block)?
    let opponentWinningCol = -1;
    for (let col of validMoves) {
      const row = this.getNextOpenRow(boardState, col);
      boardState[row][col] = opponent;
      if (this.checkWinCondition(boardState)) opponentWinningCol = col;
      boardState[row][col] = 0;
    }
    
    // 3. What does Minimax think are the best moves?
    let depth = 5;
    if (this.difficulty === 'medium') depth = 3;
    if (this.difficulty === 'expert') depth = 7;
    let bestScore = player === 2 ? -Infinity : Infinity;
    let bestMoves = [];
    
    // Sort to prioritize center column in case of score ties
    validMoves.sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3));
    
    for (let col of validMoves) {
      const row = this.getNextOpenRow(boardState, col);
      boardState[row][col] = player;
      const nextIsMaximizing = player === 1;
      const score = this.minimax(boardState, depth - 1, -Infinity, Infinity, nextIsMaximizing);
      boardState[row][col] = 0;
      
      if (player === 2) {
        if (score > bestScore) { bestScore = score; bestMoves = [col]; }
        else if (score === bestScore) { bestMoves.push(col); }
      } else {
        if (score < bestScore) { bestScore = score; bestMoves = [col]; }
        else if (score === bestScore) { bestMoves.push(col); }
      }
    }
    
    let icon = "";
    let msg = "";
    
    // 4. Evaluate the actual move made
    const testBoard = JSON.parse(JSON.stringify(boardState));
    const testRow = this.getNextOpenRow(testBoard, chosenCol);
    testBoard[testRow][chosenCol] = player;
    const playerWonNow = this.checkWinCondition(testBoard);
    
    if (playerWonNow) {
      icon = "🌟";
      msg = "Brilliant! You found the winning sequence.";
    } 
    else if (playerWinningCol !== -1 && chosenCol !== playerWinningCol) {
      icon = "❌";
      msg = `Blunder! You missed a guaranteed win in column ${String.fromCharCode(65 + playerWinningCol)}!`;
    }
    else if (opponentWinningCol !== -1 && chosenCol !== opponentWinningCol) {
      icon = "❌";
      msg = `Blunder! You failed to block the opponent's winning threat in column ${String.fromCharCode(65 + opponentWinningCol)}!`;
    }
    else {
      // Check if chosen move creates an immediate loss
      let gaveOpponentWinCol = -1;
      const oppValidMoves = this.getValidMoves(testBoard);
      for (let oppCol of oppValidMoves) {
        const oppRow = this.getNextOpenRow(testBoard, oppCol);
        if (oppRow === -1) continue;
        testBoard[oppRow][oppCol] = opponent;
        if (this.checkWinCondition(testBoard)) {
          gaveOpponentWinCol = oppCol;
        }
        testBoard[oppRow][oppCol] = 0;
      }
      
      if (gaveOpponentWinCol !== -1) {
        icon = "❌";
        msg = `Blunder! This allows your opponent to win immediately by playing in column ${String.fromCharCode(65 + gaveOpponentWinCol)}.`;
      }
      else if (bestMoves.includes(chosenCol)) {
        icon = "⭐";
        msg = "Best Move! You found the optimal continuation.";
      }
      else {
        // It's an inaccuracy.
        const bestCol = bestMoves[0];
        icon = "❓";
        
        const preStats = this.getBoardStats(boardState, player);
        const bestRow = this.getNextOpenRow(boardState, bestCol);
        boardState[bestRow][bestCol] = player;
        const postStats = this.getBoardStats(boardState, player);
        boardState[bestRow][bestCol] = 0;
        
        if (postStats.opp3 < preStats.opp3) {
          msg = `Inaccuracy. Column ${String.fromCharCode(65 + bestCol)} was better because it blocks your opponent from setting up a 3-in-a-row threat.`;
        } else if (postStats.my3 > preStats.my3) {
          msg = `Inaccuracy. Column ${String.fromCharCode(65 + bestCol)} was better because it creates a dangerous 3-in-a-row threat.`;
        } else if (postStats.my2 > preStats.my2) {
          msg = `Inaccuracy. Column ${String.fromCharCode(65 + bestCol)} was better because it connects your pieces together to build future threats.`;
        } else if (Math.abs(bestCol - 3) < Math.abs(chosenCol - 3)) {
          msg = `Inaccuracy. Column ${String.fromCharCode(65 + bestCol)} was better because it controls the center of the board more effectively.`;
        } else {
          msg = `Inaccuracy. Column ${String.fromCharCode(65 + bestCol)} gives you more options for connecting pieces on future turns.`;
        }
      }
    }
    
    this.coachIcon.textContent = icon;
    this.coachMessage.textContent = msg;
    
    // Add evaluation icon to tracker list
    const moveId = player === 1 ? this.moveCount : this.moveCount - 1;
    const entry = document.getElementById(`move-${moveId}`);
    if (entry) {
      const targetSpan = entry.querySelector(player === 1 ? '.move-p1' : '.move-p2');
      if (targetSpan && !targetSpan.querySelector('.move-eval')) {
        const evalSpan = document.createElement('span');
        evalSpan.className = 'move-eval';
        evalSpan.textContent = this.coachIcon.textContent;
        targetSpan.appendChild(evalSpan);
      }
    }
  }
}

// Start Game
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
