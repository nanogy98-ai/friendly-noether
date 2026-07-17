/**
 * Connect Four - Game Logic Engine
 */

const firebaseConfig = {
  apiKey: "AIzaSyAFdNRQSA2nPDGgEUnq3KwRZU0j9aK41X8",
  authDomain: "connect4-3877b.firebaseapp.com",
  databaseURL: "https://connect4-3877b-default-rtdb.firebaseio.com",
  projectId: "connect4-3877b",
  storageBucket: "connect4-3877b.firebasestorage.app",
  messagingSenderId: "774026933685",
  appId: "1:774026933685:web:b2b1d48272cdcc29ee95fc"
};

let db = null;
let firebaseLoadPromise = null;

function loadScriptOnce(src) {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    return existing.dataset.loaded === 'true'
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', reject, { once: true });
        });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', reject, { once: true });
    document.head.appendChild(script);
  });
}

async function ensureFirebase() {
  if (db) return db;
  if (!firebaseLoadPromise) {
    firebaseLoadPromise = (async () => {
      await loadScriptOnce('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
      await loadScriptOnce('https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js');
      if (!window.firebase.apps.length) window.firebase.initializeApp(firebaseConfig);
      db = window.firebase.database();
      return db;
    })().catch((error) => {
      firebaseLoadPromise = null;
      throw error;
    });
  }
  return firebaseLoadPromise;
}

const LEGACY_COMPUTER_NAME = ['quant', 'um ai'].join('');

function sanitizePlayerName(value, fallback) {
  const name = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 20);
  if (!name) return fallback;
  if (name.toLowerCase() === LEGACY_COMPUTER_NAME) return fallback;
  return name;
}

function normalizeScores(value) {
  const safeNumber = (number) => Math.max(0, Math.floor(Number(number) || 0));
  const normalized = {};
  for (const mode of ['pvp', 'pve', 'online']) {
    normalized[mode] = {
      p1: safeNumber(value?.[mode]?.p1),
      p2: safeNumber(value?.[mode]?.p2),
      draws: safeNumber(value?.[mode]?.draws)
    };
  }
  return normalized;
}

function normalizeAllTimeScores(value) {
  const normalized = Object.create(null);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return normalized;
  for (const [rawName, rawScore] of Object.entries(value)) {
    const name = sanitizePlayerName(rawName, 'Player');
    normalized[name] = (normalized[name] || 0) + Math.max(0, Math.floor(Number(rawScore) || 0));
  }
  return normalized;
}

function createRoomId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function isValidRoomId(value) {
  return /^[A-Za-z0-9_-]{22}$/.test(value);
}

class AIWorkerClient {
  constructor() {
    this.worker = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  ensureWorker() {
    if (this.worker || typeof Worker === 'undefined') return this.worker;
    this.worker = new Worker('ai-worker.js?v=1');
    this.worker.addEventListener('message', (event) => {
      const request = this.pending.get(event.data.id);
      if (!request) return;
      this.pending.delete(event.data.id);
      if (event.data.error) request.reject(new Error(event.data.error));
      else request.resolve(event.data.result);
    });
    this.worker.addEventListener('error', (error) => {
      for (const request of this.pending.values()) request.reject(error);
      this.pending.clear();
      this.worker?.terminate();
      this.worker = null;
    });
    return this.worker;
  }

  request(type, payload) {
    const worker = this.ensureWorker();
    if (!worker) return Promise.reject(new Error('Web Workers are unavailable'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, type, payload });
    });
  }

  cancelAll() {
    for (const request of this.pending.values()) request.reject(new Error('Cancelled'));
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }
}

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
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
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
    this.gameMode = 'pvp'; // 'pvp', 'pve', or 'online'
    this.coachEnabled = false;
    this.difficulty = 'medium'; // 'easy', 'medium', 'hard'
    this.moveHistory = [];
    this.gameOver = false;
    this.animating = false;
    this.hoveredCol = null;
    this.lastResult = null;
    this.gameGeneration = 0;
    this.pendingGameTasks = new Set();
    
    
    // Firebase Online Multiplayer variables
    this.roomRef = null;
    this.peerId = null; // acts as roomId
    this.isOnlineHost = false;
    this.lastMoveCounter = 0;
    this.localResetTrigger = 0;
    this.localTimerTrigger = 0;
    
    // Timer
    this.timerSeconds = 0;
    this.timerInterval = null;
    this.lastTimerTimestamp = null;
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
    this.allTimeScores = Object.create(null);
    
    // Controllers
    this.sounds = new SoundController();
    this.confetti = new ConfettiController('confetti-canvas');
    this.aiWorker = new AIWorkerClient();
    
    // Initialize
    this.loadAllTimeScores();
    this.initDOM();
    
    // Parse a private-room invitation from the URL.
    const urlParams = new URLSearchParams(window.location.search);
    const joinRoomId = urlParams.get('join');
    
    if (joinRoomId) {
      // Guest arriving via invite link — wipe any saved local game so old tokens don't appear
      localStorage.removeItem('connect4_active_game');
      this.loadStats();
      this.renderScores();
      this.updateTurnUI();
      this.scheduleGameTask(() => {
        this.joinOverlay.classList.remove('hidden');
        document.getElementById('app-shell').inert = true;
        this.joinNameInput.focus();
      }, 300);
    } else {
      // Normal load — try to restore saved game session
      if (!this.restoreActiveGameState()) {
        this.loadStats();
        this.renderScores();
        this.updateTurnUI();
      }
    }
    this.updateHintButtonState();
  }
  
  updateHintButtonState() {
    if (this.gameMode === 'pve') {
      this.hintBtn.disabled = false;
    } else {
      this.hintBtn.disabled = true;
    }
  }

  scheduleGameTask(callback, delay, generation = this.gameGeneration) {
    let task = null;
    task = setTimeout(() => {
      this.pendingGameTasks.delete(task);
      if (generation === this.gameGeneration) callback();
    }, delay);
    this.pendingGameTasks.add(task);
    return task;
  }

  cancelPendingGameTasks() {
    for (const task of this.pendingGameTasks) clearTimeout(task);
    this.pendingGameTasks.clear();
    this.gameGeneration++;
    this.aiWorker.cancelAll();
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
    this.soundToggle = document.getElementById('sound-toggle');
    this.timerDisplay = document.getElementById('game-timer');
    this.coachToggle = document.getElementById('coach-toggle');
    this.clearStats = document.getElementById('clear-stats');
    
    // Settings Drawer
    this.settingsToggle = document.getElementById('settings-toggle');
    this.settingsClose = document.getElementById('settings-close');
    this.settingsDrawer = document.getElementById('settings-drawer');
    this.drawerOverlay = this.settingsDrawer.querySelector('.drawer-overlay');
    this.drawerContent = this.settingsDrawer.querySelector('.drawer-content');
    this.appShell = document.getElementById('app-shell');
    
    this.modePvP = document.getElementById('mode-pvp');
    this.modePvE = document.getElementById('mode-pve');
    this.modeOnline = document.getElementById('mode-online');
    
    this.difficultyGroup = document.getElementById('difficulty-group');
    this.onlineConfigGroup = document.getElementById('online-config-group');
    
    this.p1TimerUI = document.getElementById('p1-timer');
    this.p2TimerUI = document.getElementById('p2-timer');
    
    this.p1MatchFormatUI = document.getElementById('p1-match-format');
    this.p2MatchFormatUI = document.getElementById('p2-match-format');
    
    // Online room controls
    this.peerStatus = document.getElementById('peer-status');
    this.onlineShareUrl = document.getElementById('online-share-url');
    this.copyOnlineUrlBtn = document.getElementById('copy-online-url-btn');
    this.inputPeerId = document.getElementById('input-peer-id');
    this.connectPeerBtn = document.getElementById('connect-peer-btn');
    this.playerRenameGroup = document.getElementById('player-rename-group');
    
    // Name inputs
    this.inputP1Name = document.getElementById('input-p1-name');
    this.inputP2Name = document.getElementById('input-p2-name');
    this.p1NameInputGroup = document.getElementById('p1-name-input-group');
    this.p2NameInputGroup = document.getElementById('p2-name-input-group');
    
    this.drawsStat = document.getElementById('draws-stat');
    this.clearStats = document.getElementById('clear-stats');
    this.clearAlltimeBtn = document.getElementById('clear-alltime');
    
    // Win overlay
    this.winOverlay = document.getElementById('win-overlay');
    this.winTitle = document.getElementById('win-title');
    this.winSubtitle = document.getElementById('win-subtitle');
    this.winEmoji = document.getElementById('win-emoji');
    
    // Join overlay
    this.joinOverlay = document.getElementById('join-overlay');
    this.joinNameInput = document.getElementById('join-name-input');
    this.joinRoomBtn = document.getElementById('join-room-btn');
    
    // Coach and Move Tracker
    this.coachPanel = document.getElementById('coach-panel');
    this.coachIcon = document.getElementById('coach-icon');
    this.coachMessage = document.getElementById('coach-message');
    this.trackerList = document.getElementById('tracker-list');
    this.boardAnnouncer = document.getElementById('board-announcer');
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
      col.setAttribute('aria-keyshortcuts', String(c + 1));
      this.columnsContainer.appendChild(col);
    }
    this.updateColumnControls();
    
    this.bindEvents();
    this.setupTheme();
  }
  
  bindEvents() {
    // Join Game Modal
    this.joinRoomBtn.addEventListener('click', () => {
      const val = this.joinNameInput.value.trim() || 'Guest (Yellow)';
      this.inputP2Name.value = val;
      this.p2NameText.textContent = val;
      this.joinOverlay.classList.add('hidden');
      this.appShell.inert = false;
      this.sounds.playClick();
      
      const urlParams = new URLSearchParams(window.location.search);
      const joinRoomId = urlParams.get('join');
      if (joinRoomId) {
        this.switchMode('online', joinRoomId);
      }
    });

    this.joinNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.joinRoomBtn.click();
    });

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

    // Connect to a private room code.
    this.connectPeerBtn.addEventListener('click', () => {
      this.connectToPeer(this.inputPeerId.value.trim());
    });
    

    this.copyOnlineUrlBtn.addEventListener('click', async () => {
      this.sounds.playClick();
      const value = this.onlineShareUrl.value;
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
      } catch (_) {
        this.onlineShareUrl.select();
        document.execCommand('copy');
      }
      const previous = this.copyOnlineUrlBtn.textContent;
      this.copyOnlineUrlBtn.textContent = 'Copied';
      this.scheduleGameTask(() => {
        this.copyOnlineUrlBtn.textContent = previous;
      }, 1600);
    });
    
    // Difficulty selectors
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.sounds.playClick();
        document.querySelectorAll('.diff-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        e.target.classList.add('active');
        e.target.setAttribute('aria-pressed', 'true');
        this.difficulty = e.target.dataset.diff;
        this.restartGame();
      });
    });
    
    // Time control selectors
    document.querySelectorAll('.time-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.sounds.playClick();
        document.querySelectorAll('.time-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        e.target.classList.add('active');
        e.target.setAttribute('aria-pressed', 'true');
        this.timeControl = parseInt(e.target.dataset.time, 10);
        this.restartGame();
      });
    });
    
    // Match Length selectors
    document.querySelectorAll('.match-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.sounds.playClick();
        document.querySelectorAll('.match-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        e.target.classList.add('active');
        e.target.setAttribute('aria-pressed', 'true');
        this.matchTargetWins = parseInt(e.target.dataset.wins, 10);
        this.scores[this.gameMode] = { p1: 0, p2: 0, draws: 0 };
        this.renderScores();
        this.updateMatchFormatUI();
        this.restartGame();
      });
    });
    
    // Drawer Name Inputs
    this.inputP1Name.addEventListener('input', (e) => {
      const val = sanitizePlayerName(e.target.value, "Red Player");
      if (this.gameMode === 'online' && !this.isOnlineHost) {
        this.p2NameText.textContent = val;
      } else {
        this.p1NameText.textContent = val;
      }
      this.updateAllTimeScoreUI();
      this.saveActiveGameState();
      if (this.gameMode === 'online' && this.roomRef && this.isOnlineHost) {
        this.roomRef.update({ hostName: val });
      }
    });
    
    this.inputP2Name.addEventListener('input', (e) => {
      const val = sanitizePlayerName(e.target.value, "Yellow Player");
      this.p2NameText.textContent = val;
      this.updateAllTimeScoreUI();
      this.saveActiveGameState();
      if (this.gameMode === 'online' && this.roomRef && !this.isOnlineHost) {
        this.roomRef.update({ guestName: val });
      }
    });
    
    // Drawer open/close toggles
    this.settingsToggle.addEventListener('click', () => {
      this.sounds.playClick();
      this.openSettings();
    });
    this.settingsClose.addEventListener('click', () => {
      this.sounds.playClick();
      this.closeSettings();
    });
    this.drawerOverlay.addEventListener('click', () => {
      this.closeSettings();
    });
    document.addEventListener('keydown', (event) => this.handleDialogKeydown(event));
    
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
      this.setSoundEnabled(!this.sounds.enabled);
    });

    this.soundToggle.addEventListener('change', (event) => {
      this.setSoundEnabled(event.target.checked);
    });
    
    this.coachToggle.addEventListener('change', (e) => {
      this.coachEnabled = e.target.checked;
      if (!this.coachEnabled && this.coachPanel) {
        this.coachPanel.classList.add('hidden');
      }
      localStorage.setItem('connect4_coach', this.coachEnabled ? 'on' : 'off');
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
        this.allTimeScores = Object.create(null);
        localStorage.setItem('connect4_alltime_db', JSON.stringify({}));
        this.updateAllTimeScoreUI();
        const previous = this.clearAlltimeBtn.textContent;
        this.clearAlltimeBtn.textContent = 'All-time scores reset';
        this.scheduleGameTask(() => {
          this.clearAlltimeBtn.textContent = previous;
        }, 1800);
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
    this.soundToggle.checked = this.sounds.enabled;

    this.coachEnabled = localStorage.getItem('connect4_coach') === 'on';
    this.coachToggle.checked = this.coachEnabled;
    
    const themePref = localStorage.getItem('theme');
    if (themePref === 'light') {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    } else {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    }
  }

  setSoundEnabled(enabled) {
    this.sounds.enabled = Boolean(enabled);
    this.soundToggle.checked = this.sounds.enabled;
    this.soundBtn.classList.toggle('sound-active', this.sounds.enabled);
    localStorage.setItem('sound', this.sounds.enabled ? 'on' : 'off');
    if (this.sounds.enabled) this.sounds.playClick();
  }

  openSettings() {
    this.settingsDrawer.classList.remove('hidden');
    this.appShell.inert = true;
    document.body.classList.add('modal-open');
    this.drawerContent.focus();
  }

  closeSettings() {
    if (this.settingsDrawer.classList.contains('hidden')) return;
    this.settingsDrawer.classList.add('hidden');
    this.appShell.inert = false;
    document.body.classList.remove('modal-open');
    this.settingsToggle.focus();
  }

  handleDialogKeydown(event) {
    if (!this.settingsDrawer.classList.contains('hidden')) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeSettings();
        return;
      }
      if (event.key === 'Tab') this.trapFocus(event, this.drawerContent);
    } else if (!this.joinOverlay.classList.contains('hidden') && event.key === 'Tab') {
      this.trapFocus(event, this.joinOverlay.querySelector('.join-card'));
    } else if (/^[1-7]$/.test(event.key) && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      const col = Number(event.key) - 1;
      if (this.canLocalPlayerAct(false)) this.handlePlayerMove(col);
    }
  }

  trapFocus(event, container) {
    const focusable = Array.from(container.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])'))
      .filter((element) => !element.disabled);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  canLocalPlayerAct(showAlert = false) {
    if (this.gameOver || this.animating) return false;
    if (this.gameMode === 'pve' && this.activePlayer === 2) return false;

    if (this.gameMode === 'online') {
      if (!this.roomRef) return false;
      const myRole = this.isOnlineHost ? 1 : 2;
      if (this.activePlayer !== myRole) {
        if (showAlert) this.announce("It is your opponent's turn.");
        return false;
      }
    }

    return true;
  }
  
  switchMode(mode, targetId = null) {
    if (this.gameMode === mode && mode !== 'online') return;
    this.sounds.playClick();
    
    // Clean up the previous online room before changing modes.
    this.destroyFirebase();
    
    this.gameMode = mode;
    if (mode === 'online') this.isOnlineHost = !targetId;
    this.updateHintButtonState();
    
    // Reset UI indicators
    this.difficultyGroup.classList.add('hidden');
    this.onlineConfigGroup.classList.add('hidden');
    this.p2NameInputGroup.classList.remove('hidden');
    this.playerRenameGroup.classList.remove('hidden');
    
    this.modePvP.classList.remove('active');
    this.modePvE.classList.remove('active');
    this.modeOnline.classList.remove('active');
    [this.modePvP, this.modePvE, this.modeOnline].forEach((button) => button.setAttribute('aria-pressed', 'false'));

    const p1Name = sanitizePlayerName(this.inputP1Name.value, 'Red Player');
    const p2Name = sanitizePlayerName(this.inputP2Name.value, 'Yellow Player');
    this.inputP1Name.value = p1Name;
    this.inputP2Name.value = p2Name;
    this.coachToggle.disabled = mode === 'online';
    if (mode === 'online') this.coachPanel.classList.add('hidden');
    
    if (mode === 'pvp') {
      this.modePvP.classList.add('active');
      this.modePvP.setAttribute('aria-pressed', 'true');
      if (this.p1NameInputGroup) this.p1NameInputGroup.classList.remove('hidden');
      this.p2NameInputGroup.classList.remove('hidden');
      this.p1NameText.textContent = p1Name;
      this.p2NameText.textContent = p2Name;
    } else if (mode === 'pve') {
      this.modePvE.classList.add('active');
      this.modePvE.setAttribute('aria-pressed', 'true');
      this.difficultyGroup.classList.remove('hidden');
      if (this.p1NameInputGroup) this.p1NameInputGroup.classList.remove('hidden');
      this.p2NameInputGroup.classList.add('hidden');
      this.p1NameText.textContent = p1Name;
      this.p2NameText.textContent = 'Computer';
    } else if (mode === 'online') {
      this.modeOnline.classList.add('active');
      this.modeOnline.setAttribute('aria-pressed', 'true');
      this.onlineConfigGroup.classList.remove('hidden');
      if (this.isOnlineHost) {
        if (this.p1NameInputGroup) this.p1NameInputGroup.classList.remove('hidden');
        this.p2NameInputGroup.classList.add('hidden');
      } else {
        if (this.p1NameInputGroup) this.p1NameInputGroup.classList.add('hidden');
        this.p2NameInputGroup.classList.remove('hidden');
      }
    }
    
    this.updateAllTimeScoreUI();
    this.renderScores();
    // Always clear the board when switching modes
    this.restartGame({ broadcast: false });
    if (mode === 'online') void this.initFirebase(targetId);
  }

  editPlayerNameInline(player) {
    if (this.gameMode === 'pve' && player === 2) return; 
    if (this.gameMode === 'online') {
      // Online rooms only allow each player to rename their own slot.
      const myRole = this.isOnlineHost ? 1 : 2;
      if (player !== myRole) return;
    }
    
    const textSpan = player === 1 ? this.p1NameText : this.p2NameText;
    const oldName = textSpan.textContent;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-edit-input';
    input.value = oldName;
    input.maxLength = 20;
    
    textSpan.innerHTML = '';
    textSpan.appendChild(input);
    input.focus();
    input.select();
    
    const saveName = () => {
      const newName = sanitizePlayerName(input.value, player === 1 ? "Red Player" : "Yellow Player");
      textSpan.textContent = newName;
      
      // Update settings inputs
      if (player === 1) {
        this.inputP1Name.value = newName;
      } else {
        this.inputP2Name.value = newName;
      }
      
      this.updateAllTimeScoreUI();
      this.saveActiveGameState();
      
      if (this.gameMode === 'online' && this.roomRef) {
        if (this.isOnlineHost && player === 1) this.roomRef.update({ hostName: newName });
        if (!this.isOnlineHost && player === 2) this.roomRef.update({ guestName: newName });
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
    
    const boardClone = JSON.parse(JSON.stringify(this.board));
    const player = this.activePlayer;
    if (this.coachEnabled && this.gameMode !== 'online') {
      this.scheduleGameTask(() => void this.evaluateMoveForCoach(boardClone, player, col), 500);
    }
    
    if (this.gameMode === 'online') {
      if (this.roomRef) {
        this.lastMoveCounter = (this.lastMoveCounter || 0) + 1;
        this.roomRef.update({
          lastMove: {
            player: this.isOnlineHost ? 1 : 2,
            col: col,
            counter: this.lastMoveCounter
          }
        });
        this.makeMove(row, col, false);
      }
    } else {
      this.makeMove(row, col);
    }
  }
  
  makeMove(row, col, broadcast = true) {
    if (this.gameOver || row < 0 || this.board[row][col] !== 0) return;
    if (this.moveHistory.length === 0 && (this.gameMode !== 'online' || this.isOnlineHost)) {
      this.startTimer();
    } else if (this.moveHistory.length === 0 && this.gameMode === 'online' && !this.isOnlineHost && broadcast) {
      // Guest makes first move — start timer now
      this.startTimer();
    }
    this.board[row][col] = this.activePlayer;
    this.moveHistory.push({ row, col, player: this.activePlayer });
    
    const colLetter = String.fromCharCode(65 + col);
    this.updateMoveTracker(colLetter, this.activePlayer);
    this.announce(`${this.activePlayer === 1 ? this.p1NameText.textContent : this.p2NameText.textContent} played column ${colLetter}.`);
    
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
    this.scheduleGameTask(() => {
      token.style.transform = `translateY(calc(${row} * var(--cell-size) + (var(--cell-size) - var(--token-size)) / 2))`;
    }, 15);
    
    // Disable undo for network matches
    this.undoBtn.disabled = this.gameMode === 'online';
    
    if (this.gameMode !== 'online') {
      this.saveActiveGameState();
    }
    
    this.scheduleGameTask(() => {
      this.animating = false;
      this.checkGameStatus();
    }, 450);
  }
  
  checkGameStatus() {
    if (this.gameOver) return;
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
      const winnerName = winInfo.player === 1 ? p1Name : p2Name;
      this.awardResult('win', winInfo.player, winnerName);
      
      this.saveStats();
      this.saveAllTimeScores();
      this.saveActiveGameState();
      this.renderScores();
      this.updateAllTimeScoreUI();
      
      this.turnText.textContent = `${winnerName} Wins!`;
      this.announce(`${winnerName} wins the game.`);
      this.turnColorIndicator.className = `turn-color-indicator ${winInfo.player === 1 ? 'red' : 'yellow'}`;
      this.updateColumnControls();
      
      const numMoves = this.moveHistory.length;
      const isMatchWin = this.matchTargetWins > 0 && (modeStats.p1 >= this.matchTargetWins || modeStats.p2 >= this.matchTargetWins);
      
      this.winTitle.textContent = isMatchWin ? `SERIES VICTORY!` : `${winnerName} Wins!`;
      this.winSubtitle.textContent = isMatchWin 
        ? `${winnerName} wins the match ${modeStats.p1} - ${modeStats.p2}!` 
        : `Achieved a brilliant victory in ${numMoves} total moves.`;
      this.winEmoji.textContent = isMatchWin ? '🏆' : (winInfo.player === 1 ? 'R' : 'Y');
      
      this.scheduleGameTask(() => {
        this.winOverlay.classList.remove('hidden');
        this.scheduleGameTask(() => {
          this.winOverlay.classList.add('hidden');
          this.confetti.stop();
        }, 3500);
      }, 750);
    } else if (this.isBoardFull()) {
      this.handleDraw();
    } else {
      this.activePlayer = this.activePlayer === 1 ? 2 : 1;
      this.updateTurnUI();
      this.saveActiveGameState();
      
      if (!this.gameOver && this.gameMode === 'pve' && this.activePlayer === 2) {
        this.triggerComputerMove();
      }
    }
  }
  
  triggerComputerMove() {
    if (this.gameOver || this.getValidMoves(this.board).length === 0) {
      this.handleDraw();
      return;
    }

    this.animating = true;
    this.turnText.textContent = "Computer is thinking...";

    const generation = this.gameGeneration;
    this.scheduleGameTask(async () => {
      const computerCol = await this.getBestMoveAsync(this.board, 2);
      if (generation !== this.gameGeneration || this.gameOver || this.activePlayer !== 2) return;
      if (computerCol !== null) {
        const computerRow = this.getNextOpenRow(this.board, computerCol);
        this.animating = false;
        this.makeMove(computerRow, computerCol);
      } else {
        this.animating = false;
        this.handleDraw();
      }
    }, 320, generation);
  }

  handleDraw() {
    if (this.gameOver) return;

    this.gameOver = true;
    this.animating = false;
    this.pauseTimer();
    this.awardResult('draw', null, null);
    this.saveStats();
    this.saveActiveGameState();
    this.renderScores();

    this.turnText.textContent = "It's a Draw!";
    this.announce('The game is a draw.');
    this.turnColorIndicator.className = 'turn-color-indicator';
    this.p1Card.classList.remove('active');
    this.p2Card.classList.remove('active');
    this.updateColumnControls();

    this.winTitle.textContent = "Match Draw!";
    this.winSubtitle.textContent = "A perfect defensive grid from both sides.";
    this.winEmoji.textContent = '=';

    this.scheduleGameTask(() => {
      this.winOverlay.classList.remove('hidden');
      this.scheduleGameTask(() => {
        this.winOverlay.classList.add('hidden');
      }, 3500);
    }, 750);
  }
  
  async showHint() {
    if (this.gameOver || this.animating) return;
    const generation = this.gameGeneration;
    this.hintBtn.disabled = true;
    const bestCol = await this.getBestMoveAsync(this.board, this.activePlayer);
    this.updateHintButtonState();
    if (generation !== this.gameGeneration || this.gameOver) return;
    if (bestCol !== null) {
      const arrow = document.querySelector(`.col-arrow[data-col="${bestCol}"]`);
      if (arrow) {
        arrow.classList.add('hint-glow');
        this.announce(`Hint: consider column ${String.fromCharCode(65 + bestCol)}.`);
        this.scheduleGameTask(() => {
          arrow.classList.remove('hint-glow');
        }, 2000);
      }
    }
  }
  
  undoMove() {
    const canInterruptComputer = this.gameMode === 'pve' && this.activePlayer === 2;
    if (this.gameMode === 'online' || this.moveHistory.length === 0 || (this.animating && !canInterruptComputer)) return;

    this.cancelPendingGameTasks();
    this.rollbackLastResult();
    
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
    this.animating = false;
    this.lastResult = null;
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

    this.cancelPendingGameTasks();
    this.pauseTimer();

    if (this.matchTargetWins > 0) {
      const p1Score = this.scores[this.gameMode].p1;
      const p2Score = this.scores[this.gameMode].p2;
      if (p1Score >= this.matchTargetWins || p2Score >= this.matchTargetWins) {
        this.scores[this.gameMode] = { p1: 0, p2: 0, draws: 0 };
        this.renderScores();
        this.saveStats();
      }
      this.setNewGameButtonLabel('Next Game');
    } else {
      this.setNewGameButtonLabel('New Game');
    }

    this.board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(0));
    this.moveHistory = [];
    this.gameOver = false;
    this.animating = false;
    this.activePlayer = 1;
    this.lastResult = null;

    this.tokensContainer.innerHTML = '';
    this.previewRow.innerHTML = '';
    this.resetMoveTracker();
    this.winOverlay.classList.add('hidden');
    this.confetti.stop();
    this.undoBtn.disabled = true;

    this.p1TimeRemaining = this.timeControl;
    this.p2TimeRemaining = this.timeControl;
    this.updatePlayerTimersUI();

    this.updateTurnUI();
    this.timerSeconds = 0;
    this.lastTimerTimestamp = null;
    this.updateTimerDisplay();

    if (this.gameMode === 'online') {
      if (shouldBroadcast && this.roomRef) {
        this.localResetTrigger = (this.localResetTrigger || 0) + 1;
        this.roomRef.update({ 
          resetTrigger: this.localResetTrigger,
          gameConfig: {
            timeControl: this.timeControl,
            matchTargetWins: this.matchTargetWins
          }
        });
      }
    } else {
      this.saveActiveGameState();
    }
  }

  setNewGameButtonLabel(label) {
    const text = this.newGameBtn.querySelector('span');
    if (text) text.textContent = label;
  }

  announce(message) {
    if (this.boardAnnouncer) this.boardAnnouncer.textContent = message;
  }

  awardResult(type, winner, winnerName) {
    if (this.lastResult) return;
    const stats = this.scores[this.gameMode];
    if (type === 'draw') {
      stats.draws++;
    } else {
      stats[winner === 1 ? 'p1' : 'p2']++;
      this.allTimeScores[winnerName] = (this.allTimeScores[winnerName] || 0) + 1;
    }
    this.lastResult = { type, winner, winnerName, mode: this.gameMode };
  }

  rollbackLastResult() {
    const result = this.lastResult;
    if (!result || result.mode !== this.gameMode) return;
    const stats = this.scores[result.mode];
    if (result.type === 'draw') {
      stats.draws = Math.max(0, stats.draws - 1);
    } else {
      const scoreKey = result.winner === 1 ? 'p1' : 'p2';
      stats[scoreKey] = Math.max(0, stats[scoreKey] - 1);
      if (result.winnerName) {
        this.allTimeScores[result.winnerName] = Math.max(0, (this.allTimeScores[result.winnerName] || 0) - 1);
        if (this.allTimeScores[result.winnerName] === 0) delete this.allTimeScores[result.winnerName];
      }
    }
    this.lastResult = null;
    this.saveStats();
    this.saveAllTimeScores();
    this.renderScores();
    this.updateAllTimeScoreUI();
  }
  
  updateTurnUI() {
    const p1Card = this.p1Card;
    const p2Card = this.p2Card;
    const p1Name = this.p1NameText.textContent;
    const p2Name = this.p2NameText.textContent;

    if (this.gameOver) {
      const winInfo = this.checkWinCondition(this.board);
      if (winInfo) {
        const winnerName = winInfo.player === 1 ? p1Name : p2Name;
        this.turnText.textContent = `${winnerName} Wins!`;
        this.turnColorIndicator.className = `turn-color-indicator ${winInfo.player === 1 ? 'red' : 'yellow'}`;
      } else if (this.isBoardFull()) {
        this.turnText.textContent = "It's a Draw!";
        this.turnColorIndicator.className = 'turn-color-indicator';
        p1Card.classList.remove('active');
        p2Card.classList.remove('active');
      }
      this.updateColumnControls();
      return;
    }
    
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
    this.updateColumnControls();
  }

  updateColumnControls() {
    this.columnsContainer?.querySelectorAll('.board-column').forEach((button) => {
      const col = Number(button.dataset.col);
      const spaces = this.board.reduce((count, row) => count + (row[col] === 0 ? 1 : 0), 0);
      const letter = String.fromCharCode(65 + col);
      button.disabled = spaces === 0 || this.gameOver;
      button.setAttribute('aria-disabled', (!this.canLocalPlayerAct(false) || spaces === 0).toString());
      button.setAttribute('aria-label', `Drop token in column ${letter}. ${spaces} ${spaces === 1 ? 'space' : 'spaces'} available.`);
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
  
  getValidMoves(board) {
    const valid = [];
    for (let c = 0; c < this.cols; c++) {
      if (board[0][c] === 0) valid.push(c);
    }
    return valid;
  }
  
  isBoardFull() {
    return this.moveHistory.length > 0 && this.getValidMoves(this.board).length === 0;
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
  
  
  // ================= FIREBASE ONLINE MULTIPLAYER SERVICES =================
  
  async initFirebase(targetId = null) {
    this.destroyFirebase();
    const generation = this.gameGeneration;
    this.peerStatus.textContent = "Connecting...";
    this.peerStatus.className = "status-badge waiting";

    let database;
    try {
      database = await ensureFirebase();
    } catch (error) {
      console.error('Unable to load online play', error);
      this.peerStatus.textContent = "Online play unavailable";
      this.peerStatus.className = "status-badge disconnected";
      return;
    }
    if (generation !== this.gameGeneration || this.gameMode !== 'online') return;

    if (targetId) {
      if (!isValidRoomId(targetId)) {
        this.peerStatus.textContent = "Invalid room code";
        this.peerStatus.className = "status-badge disconnected";
        return;
      }
      // Guest joining room
      this.isOnlineHost = false;
      this.p1NameText.textContent = 'Host (Red)';
      this.p2NameText.textContent = sanitizePlayerName(this.inputP2Name.value, 'Guest (Yellow)');
      
      this.peerStatus.textContent = "Connecting to Room...";
      
      this.peerId = targetId;
      this.roomRef = database.ref('rooms/' + targetId);
      try {
        const snapshot = await this.roomRef.once('value');
        if (snapshot.exists() && Number(snapshot.val().expiresAt) > Date.now()) {
          const data = snapshot.val();
          this.p1NameText.textContent = sanitizePlayerName(data.hostName, 'Host (Red)');
          
          await this.roomRef.update({
            guestName: this.p2NameText.textContent,
            status: 'playing'
          });
          this.setupFirebaseListeners(targetId);
        } else {
          this.peerStatus.textContent = "Room not found or expired";
          this.peerStatus.className = "status-badge disconnected";
        }
      } catch (error) {
        console.error('Unable to join room', error);
        this.peerStatus.textContent = "Could not join room";
        this.peerStatus.className = "status-badge disconnected";
      }
    } else {
      // Host creating room
      this.isOnlineHost = true;
      this.p1NameText.textContent = sanitizePlayerName(this.inputP1Name.value, 'Host (Red)');
      this.p2NameText.textContent = 'Waiting...';
      
      const roomId = createRoomId();
      this.peerId = roomId;
      this.roomRef = database.ref('rooms/' + roomId);
      const createdAt = Date.now();
      const expiresAt = createdAt + (6 * 60 * 60 * 1000);

      try {
        await this.roomRef.set({
          hostName: this.p1NameText.textContent,
          guestName: '',
          status: 'waiting',
          createdAt,
          expiresAt,
          resetTrigger: 0,
          gameConfig: {
            timeControl: this.timeControl,
            matchTargetWins: this.matchTargetWins
          }
        });
        this.disconnectRegistration = this.roomRef.onDisconnect();
        this.disconnectRegistration.remove();
        this.setupFirebaseListeners(roomId);

        this.peerStatus.textContent = "Waiting for Friend...";
        this.peerStatus.className = "status-badge waiting";
        const shareLink = `${window.location.origin}${window.location.pathname}?join=${roomId}`;
        this.onlineShareUrl.value = shareLink;
      } catch (error) {
        console.error('Unable to create room', error);
        this.peerStatus.textContent = "Could not create room";
        this.peerStatus.className = "status-badge disconnected";
      }
    }
    this.updateAllTimeScoreUI();
  }
  
  connectToPeer(targetId) {
    if (!isValidRoomId(targetId)) {
      this.peerStatus.textContent = "Enter a valid room code";
      this.peerStatus.className = "status-badge disconnected";
      return;
    }
    void this.initFirebase(targetId);
  }
  
  setupFirebaseListeners(roomId) {
    const onConnectionReady = () => {
      this.peerStatus.textContent = "Connected";
      this.peerStatus.className = "status-badge connected";
      this.sounds.playClick();
      
      this.closeSettings();
      
      this.updateAllTimeScoreUI();
      if (this.isOnlineHost) {
        // Host starts a fresh game and broadcasts the reset
        this.restartGame({ broadcast: true });
      } else {
        // Guest clears the board locally — Host controls state
        this.restartGame({ broadcast: false });
      }
    };

    let hasConnected = false;

    this.roomRef.on('value', (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.val();

      // --- Guest: Sync config from DB on very first snapshot ---
      if (!this.isOnlineHost && data.gameConfig && !hasConnected) {
        this.timeControl = data.gameConfig.timeControl ?? this.timeControl;
        this.matchTargetWins = data.gameConfig.matchTargetWins ?? this.matchTargetWins;
        this.p1TimeRemaining = this.timeControl;
        this.p2TimeRemaining = this.timeControl;
        this.updateMatchFormatUI();
        this.updatePlayerTimersUI();
        document.querySelectorAll('.time-btn').forEach(b => {
          const selected = parseInt(b.dataset.time, 10) === this.timeControl;
          b.classList.toggle('active', selected);
          b.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        document.querySelectorAll('.match-btn').forEach(b => {
          const selected = parseInt(b.dataset.wins, 10) === this.matchTargetWins;
          b.classList.toggle('active', selected);
          b.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
      }

      // --- Connection handshake ---
      if (data.status === 'playing' && !hasConnected) {
        hasConnected = true;
        // Pre-seed the move counter so we don't replay old moves
        this.lastMoveCounter = data.lastMove ? (data.lastMove.counter || 0) : 0;
        onConnectionReady();
      }

      // --- Name sync ---
      if (this.isOnlineHost && data.guestName && data.guestName !== this.p2NameText.textContent) {
        this.p2NameText.textContent = data.guestName;
        this.updateAllTimeScoreUI();
      } else if (!this.isOnlineHost && data.hostName && data.hostName !== this.p1NameText.textContent) {
        this.p1NameText.textContent = data.hostName;
        this.updateAllTimeScoreUI();
      }

      // --- Config sync (mid-game host change) ---
      if (!this.isOnlineHost && hasConnected && data.gameConfig) {
        if (this.timeControl !== data.gameConfig.timeControl || this.matchTargetWins !== data.gameConfig.matchTargetWins) {
          this.timeControl = data.gameConfig.timeControl;
          this.matchTargetWins = data.gameConfig.matchTargetWins;
          if (this.moveHistory.length === 0) {
            this.p1TimeRemaining = this.timeControl;
            this.p2TimeRemaining = this.timeControl;
          }
          this.updateMatchFormatUI();
          this.updatePlayerTimersUI();
          document.querySelectorAll('.time-btn').forEach(b => {
            const selected = parseInt(b.dataset.time, 10) === this.timeControl;
            b.classList.toggle('active', selected);
            b.setAttribute('aria-pressed', selected ? 'true' : 'false');
          });
          document.querySelectorAll('.match-btn').forEach(b => {
            const selected = parseInt(b.dataset.wins, 10) === this.matchTargetWins;
            b.classList.toggle('active', selected);
            b.setAttribute('aria-pressed', selected ? 'true' : 'false');
          });
        }
      }

      // --- Opponent move ---
      if (hasConnected && data.lastMove && data.lastMove.counter > (this.lastMoveCounter || 0)) {
        this.lastMoveCounter = data.lastMove.counter;
        if (data.lastMove.player !== (this.isOnlineHost ? 1 : 2)) {
          const row = this.getNextOpenRow(this.board, data.lastMove.col);
          if (row !== -1) {
            this.makeMove(row, data.lastMove.col, false);
          }
        }
      }

      // --- Reset trigger ---
      if (hasConnected && data.resetTrigger && data.resetTrigger > (this.localResetTrigger || 0)) {
        this.localResetTrigger = data.resetTrigger;
        // Sync config on reset too
        if (data.gameConfig) {
          this.timeControl = data.gameConfig.timeControl ?? this.timeControl;
          this.matchTargetWins = data.gameConfig.matchTargetWins ?? this.matchTargetWins;
        }
        this.restartGame({ broadcast: false });
      }

      // --- Timer sync (Guest side only, driven by Host) ---
      if (!this.isOnlineHost && data.timerData && data.timerData.trigger > (this.localTimerTrigger || 0)) {
        this.localTimerTrigger = data.timerData.trigger;
        this.timerSeconds = data.timerData.seconds;
        // Start Guest's display timer if not already running
        if (!this.timerInterval && !this.gameOver && this.moveHistory.length > 0) {
          this.resumeTimer();
        }
        if (data.timerData.p1Time !== undefined) {
          this.p1TimeRemaining = data.timerData.p1Time;
          this.p2TimeRemaining = data.timerData.p2Time;
          this.updatePlayerTimersUI();
          if (this.p1TimeRemaining <= 0 && this.timeControl > 0) this.handleTimeout(1);
          if (this.p2TimeRemaining <= 0 && this.timeControl > 0) this.handleTimeout(2);
        }
        this.updateTimerDisplay();
      }
    });
  }
  
  destroyFirebase() {
    if (this.roomRef) {
      const oldRoom = this.roomRef;
      const shouldRemoveRoom = this.isOnlineHost;
      this.roomRef.off();
      this.roomRef = null;
      if (shouldRemoveRoom) oldRoom.remove().catch(() => {});
    }
    this.disconnectRegistration?.cancel?.();
    this.disconnectRegistration = null;
    this.peerId = null;
    this.lastMoveCounter = 0;
    this.localResetTrigger = 0;
    this.localTimerTrigger = 0;
    if (this.peerStatus) {
      this.peerStatus.textContent = "Idle";
      this.peerStatus.className = "status-badge disconnected";
    }
  }
  
  // ================= TIMER CONTROLS =================
  
  startTimer() {
    this.pauseTimer();
    this.timerSeconds = 0;
    this.lastTimerTimestamp = Date.now();
    this.updateTimerDisplay();
    if (this.gameMode === 'online' && !this.isOnlineHost) return;
    this.timerInterval = setInterval(() => this.advanceTimer(), 250);
  }
  
  pauseTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
  
  resumeTimer() {
    if (this.timerInterval || this.gameOver || this.moveHistory.length === 0) return;
    this.lastTimerTimestamp = Date.now();
    if (this.gameMode === 'online' && !this.isOnlineHost) return;
    this.timerInterval = setInterval(() => this.advanceTimer(), 250);
  }

  advanceTimer() {
    if (this.gameOver || !this.lastTimerTimestamp) return;
    const now = Date.now();
    const elapsed = Math.floor((now - this.lastTimerTimestamp) / 1000);
    if (elapsed < 1) return;
    this.lastTimerTimestamp += elapsed * 1000;
    this.timerSeconds += elapsed;
    this.tickPlayerClocks(elapsed);
    this.updateTimerDisplay();
    this.saveActiveGameState();

    if (this.gameMode === 'online' && this.isOnlineHost && this.roomRef && !this.gameOver) {
      this.localTimerTrigger = (this.localTimerTrigger || 0) + 1;
      this.roomRef.update({
        timerData: {
          trigger: this.localTimerTrigger,
          seconds: this.timerSeconds,
          p1Time: this.p1TimeRemaining,
          p2Time: this.p2TimeRemaining,
          updatedAt: Date.now()
        }
      }).catch(() => {});
    }
  }
  
  tickPlayerClocks(elapsed = 1) {
    if (this.timeControl > 0 && !this.gameOver) {
      if (this.activePlayer === 1) {
        this.p1TimeRemaining -= elapsed;
        if (this.p1TimeRemaining <= 0) {
          this.p1TimeRemaining = 0;
          this.handleTimeout(1);
        }
      } else {
        this.p2TimeRemaining -= elapsed;
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
    if (this.timeControl <= 0) return;
    if (this.gameOver) return;
    this.gameOver = true;
    this.pauseTimer();
    
    const p1Name = this.p1NameText.textContent;
    const p2Name = this.p2NameText.textContent;
    const winner = losingPlayer === 1 ? 2 : 1;
    const winnerName = winner === 1 ? p1Name : p2Name;
    
    this.sounds.playWin();
    
    this.awardResult('timeout', winner, winnerName);
    
    this.saveStats();
    this.saveAllTimeScores();
    this.saveActiveGameState();
    this.renderScores();
    this.updateAllTimeScoreUI();
    
    this.turnText.textContent = `${winnerName} Wins!`;
    this.announce(`${winnerName} wins on time.`);
    this.turnColorIndicator.className = `turn-color-indicator ${winner === 1 ? 'red' : 'yellow'}`;
    this.updateColumnControls();
    
    const modeStats = this.scores[this.gameMode];
    const isMatchWin = this.matchTargetWins > 0 && (modeStats.p1 >= this.matchTargetWins || modeStats.p2 >= this.matchTargetWins);
    
    this.winTitle.textContent = isMatchWin ? `SERIES VICTORY!` : `Time's Up!`;
    this.winSubtitle.textContent = isMatchWin 
      ? `${winnerName} wins the match ${modeStats.p1} - ${modeStats.p2}!` 
      : `${winnerName} wins on time!`;
    this.winEmoji.textContent = isMatchWin ? '1' : '00';
    
    this.scheduleGameTask(() => {
      this.winOverlay.classList.remove('hidden');
      this.scheduleGameTask(() => {
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
        this.allTimeScores = normalizeAllTimeScores(JSON.parse(stored));
        const legacyKey = Object.keys(this.allTimeScores).find((name) => name.toLowerCase() === LEGACY_COMPUTER_NAME);
        if (legacyKey) {
          this.allTimeScores.Computer = (this.allTimeScores.Computer || 0) + (Number(this.allTimeScores[legacyKey]) || 0);
          delete this.allTimeScores[legacyKey];
          this.saveAllTimeScores();
        }
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
      gameOver: this.gameOver,
      lastResult: this.lastResult,
      savedAt: Date.now()
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
      
      const validBoard = Array.isArray(state.board)
        && state.board.length === this.rows
        && state.board.every((row) => Array.isArray(row) && row.length === this.cols && row.every((cell) => [0, 1, 2].includes(cell)));
      const validHistory = Array.isArray(state.moveHistory)
        && state.moveHistory.every((move) => Number.isInteger(move.row) && move.row >= 0 && move.row < this.rows
          && Number.isInteger(move.col) && move.col >= 0 && move.col < this.cols && [1, 2].includes(move.player));
      if (!validBoard || !validHistory) return false;
      this.board = state.board;
      this.moveHistory = state.moveHistory;
      this.activePlayer = state.activePlayer === 2 ? 2 : 1;
      this.gameMode = state.gameMode === 'pve' ? 'pve' : 'pvp';
      this.difficulty = ['easy', 'medium', 'hard', 'expert'].includes(state.difficulty) ? state.difficulty : 'medium';
      this.scores = normalizeScores(state.scores || this.scores);
      this.timerSeconds = Math.max(0, Number(state.timerSeconds) || 0);

      this.timeControl = [0, 15, 30, 60, 180, 300].includes(state.timeControl) ? state.timeControl : 0;
      this.matchTargetWins = [0, 3, 5].includes(state.matchTargetWins) ? state.matchTargetWins : 0;
      this.updateMatchFormatUI();
      
      this.p1TimeRemaining = Math.max(0, Number(state.p1TimeRemaining ?? this.timeControl) || 0);
      this.p2TimeRemaining = Math.max(0, Number(state.p2TimeRemaining ?? this.timeControl) || 0);
      this.updatePlayerTimersUI();
      
      this.gameOver = Boolean(state.gameOver);
      this.lastResult = state.lastResult || null;
      
      const p1InputName = sanitizePlayerName(state.p1_name_input || state.p1_name, 'Red Player');
      const p2InputName = sanitizePlayerName(state.p2_name_input || state.p2_name_display, 'Yellow Player');
      this.p1NameText.textContent = sanitizePlayerName(state.p1_name, p1InputName);
      this.inputP1Name.value = p1InputName;
      this.inputP2Name.value = p2InputName;
      this.p2NameText.textContent = this.gameMode === 'pve'
        ? 'Computer'
        : sanitizePlayerName(state.p2_name_display, p2InputName);
      
      document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      if (this.gameMode === 'pvp') {
        this.modePvP.classList.add('active');
        this.modePvP.setAttribute('aria-pressed', 'true');
        if (this.p1NameInputGroup) this.p1NameInputGroup.classList.remove('hidden');
        this.p2NameInputGroup.classList.remove('hidden');
      } else if (this.gameMode === 'pve') {
        this.modePvE.classList.add('active');
        this.modePvE.setAttribute('aria-pressed', 'true');
        this.difficultyGroup.classList.remove('hidden');
        if (this.p1NameInputGroup) this.p1NameInputGroup.classList.remove('hidden');
        this.p2NameInputGroup.classList.add('hidden');
      }
      
      document.querySelectorAll('.diff-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.diff === this.difficulty);
        b.setAttribute('aria-pressed', b.dataset.diff === this.difficulty ? 'true' : 'false');
      });

      const elapsedAway = !this.gameOver && this.moveHistory.length > 0 && state.savedAt
        ? Math.max(0, Math.floor((Date.now() - Number(state.savedAt)) / 1000))
        : 0;
      if (elapsedAway > 0) {
        this.timerSeconds += elapsedAway;
        this.tickPlayerClocks(elapsedAway);
      }
      
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
      
      this.renderScores();
      this.updateAllTimeScoreUI();
      this.updateTurnUI();
      
      if (this.gameOver) {
        const winInfo = this.checkWinCondition(this.board);
        if (winInfo) {
          this.highlightWinningTokens(winInfo.cells);
          if (!this.lastResult) {
            this.lastResult = {
              type: 'win',
              winner: winInfo.player,
              winnerName: winInfo.player === 1 ? this.p1NameText.textContent : this.p2NameText.textContent,
              mode: this.gameMode
            };
          }
        } else if (this.isBoardFull() && !this.lastResult) {
          this.lastResult = { type: 'draw', winner: null, winnerName: null, mode: this.gameMode };
        }
      } else {
        if (this.moveHistory.length > 0) {
          this.resumeTimer();
        }
        if (this.gameMode === 'pve' && this.activePlayer === 2) {
          this.triggerComputerMove();
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

  async getBestMoveAsync(board, player) {
    const boardCopy = board.map((row) => [...row]);
    try {
      const result = await this.aiWorker.request('best-move', {
        board: boardCopy,
        player,
        difficulty: this.difficulty
      });
      return result.bestCol;
    } catch (error) {
      if (error.message === 'Cancelled') return null;
      console.warn('Computer worker unavailable; using the local engine.', error);
      const currentBoard = this.board;
      this.board = boardCopy;
      try {
        return this.getBestMoveForPlayer(player);
      } finally {
        this.board = currentBoard;
      }
    }
  }

  async getPositionAnalysis(board, player) {
    try {
      return await this.aiWorker.request('analyze', {
        board: board.map((row) => [...row]),
        player,
        difficulty: this.difficulty
      });
    } catch (error) {
      if (error.message === 'Cancelled') return null;
      console.warn('Coach worker unavailable; using a shallower local analysis.', error);
      const currentBoard = this.board;
      const currentDifficulty = this.difficulty;
      this.board = board.map((row) => [...row]);
      this.difficulty = currentDifficulty === 'expert' ? 'hard' : currentDifficulty;
      try {
        const bestCol = this.getBestMoveForPlayer(player);
        return { bestCol, bestMoves: bestCol === null ? [] : [bestCol], moveScores: {}, bestScore: 0 };
      } finally {
        this.board = currentBoard;
        this.difficulty = currentDifficulty;
      }
    }
  }

  getBoardHash(board, isMaximizing = false) {
    let hash = isMaximizing ? "2:" : "1:";
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 7; c++) {
        hash += board[r][c];
      }
    }
    return hash;
  }

  orderMoves(board, validMoves, player) {
    const opponent = player === 1 ? 2 : 1;
    const movesWithScores = validMoves.map(col => {
      let score = 0;
      const row = this.getNextOpenRow(board, col);
      
      // Check if this move wins for current player
      board[row][col] = player;
      const winSelf = this.checkWinCondition(board);
      board[row][col] = 0;
      if (winSelf && winSelf.player === player) {
        score += 100000;
      }
      
      // Check if this move blocks opponent's win
      board[row][col] = opponent;
      const winOpp = this.checkWinCondition(board);
      board[row][col] = 0;
      if (winOpp && winOpp.player === opponent) {
        score += 50000;
      }
      
      // Center column preference
      score -= Math.abs(col - 3) * 10;
      
      return { col, score };
    });
    
    movesWithScores.sort((a, b) => b.score - a.score);
    return movesWithScores.map(x => x.col);
  }

  getBestMoveForPlayer(player) {
    const validMoves = this.getValidMoves(this.board);
    if (validMoves.length === 0) return null;
    
    if (this.gameMode === 'pve' && player === 2 && this.difficulty === 'easy') {
      return validMoves[Math.floor(Math.random() * validMoves.length)];
    }
    
    this.transpositionTable = new Map();
    
    let depth = 5;
    if (this.difficulty === 'medium') depth = 3;
    if (this.difficulty === 'expert') depth = 12;
    
    const orderedMoves = this.orderMoves(this.board, validMoves, player);
    
    let bestScore = player === 2 ? -Infinity : Infinity;
    let bestMoves = [];
    
    for (let col of orderedMoves) {
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
    const hash = this.getBoardHash(board, isMaximizing);
    const entry = this.transpositionTable.get(hash);
    
    const TT_EXACT = 0;
    const TT_ALPHA = 1;
    const TT_BETA = 2;
    
    if (entry && entry.depth >= depth) {
      if (entry.flag === TT_EXACT) {
        return entry.score;
      } else if (entry.flag === TT_ALPHA && entry.score <= alpha) {
        return entry.score;
      } else if (entry.flag === TT_BETA && entry.score >= beta) {
        return entry.score;
      }
    }
    
    const winInfo = this.checkWinCondition(board);
    if (winInfo) {
      if (winInfo.player === 2) return 1000000 + depth;
      if (winInfo.player === 1) return -1000000 - depth;
    }
    
    const validMoves = this.getValidMoves(board);
    if (depth === 0 || validMoves.length === 0) {
      return this.evaluateBoard(board);
    }
    
    const alphaOrig = alpha;
    const betaOrig = beta;
    const activePlayer = isMaximizing ? 2 : 1;
    const orderedMoves = this.orderMoves(board, validMoves, activePlayer);
    
    if (isMaximizing) {
      let maxEval = -Infinity;
      for (let col of orderedMoves) {
        const row = this.getNextOpenRow(board, col);
        board[row][col] = 2;
        const evaluation = this.minimax(board, depth - 1, alpha, beta, false);
        board[row][col] = 0;
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break;
      }
      
      let flag = TT_EXACT;
      if (maxEval <= alphaOrig) flag = TT_ALPHA;
      else if (maxEval >= betaOrig) flag = TT_BETA;
      this.transpositionTable.set(hash, { score: maxEval, depth, flag });
      
      return maxEval;
    } else {
      let minEval = Infinity;
      for (let col of orderedMoves) {
        const row = this.getNextOpenRow(board, col);
        board[row][col] = 1;
        const evaluation = this.minimax(board, depth - 1, alpha, beta, true);
        board[row][col] = 0;
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break;
      }
      
      let flag = TT_EXACT;
      if (minEval <= alphaOrig) flag = TT_ALPHA;
      else if (minEval >= betaOrig) flag = TT_BETA;
      this.transpositionTable.set(hash, { score: minEval, depth, flag });
      
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
        const parsed = JSON.parse(stored);
        if (parsed && parsed.scores) {
          this.scores = normalizeScores(parsed.scores);
          if (parsed.matchTargetWins !== undefined) {
            this.matchTargetWins = parsed.matchTargetWins;
          }
        } else {
          this.scores = normalizeScores(parsed);
        }
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
      this.setNewGameButtonLabel('Next Game');
    } else {
      this.p1MatchFormatUI.classList.add('hidden');
      this.p2MatchFormatUI.classList.add('hidden');
      this.setNewGameButtonLabel('New Game');
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

  getWinningMovesCount(board, player) {
    let count = 0;
    const validMoves = this.getValidMoves(board);
    for (let col of validMoves) {
      const row = this.getNextOpenRow(board, col);
      if (row === -1) continue;
      board[row][col] = player;
      const win = this.checkWinCondition(board);
      board[row][col] = 0;
      if (win && win.player === player) {
        count++;
      }
    }
    return count;
  }

  getDoubleThreatColumns(board, player) {
    const list = [];
    const validMoves = this.getValidMoves(board);
    for (let col of validMoves) {
      const row = this.getNextOpenRow(board, col);
      if (row === -1) continue;
      board[row][col] = player;
      const count = this.getWinningMovesCount(board, player);
      board[row][col] = 0;
      if (count >= 2) {
        list.push(col);
      }
    }
    return list;
  }

  async evaluateMoveForCoach(boardState, player, chosenCol) {
    if (!this.coachPanel || !this.coachEnabled) return;

    const generation = this.gameGeneration;
    this.coachPanel.classList.remove('hidden');
    this.coachMessage.textContent = "Analyzing...";
    this.coachIcon.textContent = "◇";
    this.coachIcon.className = "coach-icon";
    
    const opponent = player === 1 ? 2 : 1;
    const validMoves = this.getValidMoves(boardState);
    if (validMoves.length === 0) return;
    
    // --- 1. Detect Forced Moves ---
    if (validMoves.length === 1) {
      this.coachIcon.textContent = "🔒";
      this.coachIcon.className = "coach-icon forced";
      this.coachMessage.textContent = "Forced Move. You had no other legal moves available.";
      
      const moveId = player === 1 ? this.moveCount : this.moveCount - 1;
      const entry = document.getElementById(`move-${moveId}`);
      if (entry) {
        const targetSpan = entry.querySelector(player === 1 ? '.move-p1' : '.move-p2');
        if (targetSpan && !targetSpan.querySelector('.move-eval')) {
          const evalSpan = document.createElement('span');
          evalSpan.className = 'move-eval forced';
          evalSpan.textContent = "🔒";
          targetSpan.appendChild(evalSpan);
        }
      }
      return;
    }
    
    // --- 2. Pre-move state evaluation ---
    let playerWinningCol = -1;
    for (let col of validMoves) {
      const row = this.getNextOpenRow(boardState, col);
      boardState[row][col] = player;
      if (this.checkWinCondition(boardState)) playerWinningCol = col;
      boardState[row][col] = 0;
    }
    
    let opponentWinningCol = -1;
    for (let col of validMoves) {
      const row = this.getNextOpenRow(boardState, col);
      boardState[row][col] = opponent;
      if (this.checkWinCondition(boardState)) opponentWinningCol = col;
      boardState[row][col] = 0;
    }
    
    const oppDoubleThreatsBefore = this.getDoubleThreatColumns(boardState, opponent);
    
    // --- 3. Compute engine scores away from the main UI thread ---
    const analysis = await this.getPositionAnalysis(boardState, player);
    if (!analysis || generation !== this.gameGeneration || !this.coachEnabled) return;
    const moveScores = analysis.moveScores || {};
    const bestScore = analysis.bestScore;
    const bestMoves = analysis.bestMoves?.length ? analysis.bestMoves : [analysis.bestCol].filter((col) => col !== null);
    
    // --- 4. Evaluate actual move post-state ---
    const testBoard = JSON.parse(JSON.stringify(boardState));
    const testRow = this.getNextOpenRow(testBoard, chosenCol);
    testBoard[testRow][chosenCol] = player;
    
    const playerWonNow = this.checkWinCondition(testBoard);
    const playerWinsCountAfter = this.getWinningMovesCount(testBoard, player);
    const oppDoubleThreatsAfter = this.getDoubleThreatColumns(testBoard, opponent);
    
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
    
    let icon = "";
    let styleClass = "";
    let msg = "";
    
    const isForcedLoss = (player === 1 && bestScore >= 900000) || (player === 2 && bestScore <= -900000);
    
    if (isForcedLoss) {
      icon = "🏳️";
      styleClass = "forced-loss";
      const bestCol = bestMoves[0];
      if (bestMoves.includes(chosenCol)) {
        msg = `Difficult Position. The engine sees a forcing sequence, but column ${String.fromCharCode(65 + chosenCol)} offers the best resistance.`;
      } else {
        msg = `Difficult Position. The engine prefers column ${String.fromCharCode(65 + bestCol)} as the strongest resistance.`;
      }
    }
    else if (playerWonNow) {
      icon = "🌟";
      styleClass = "best";
      msg = "Brilliant! You found the winning sequence.";
    } 
    else if (playerWinningCol !== -1 && chosenCol !== playerWinningCol) {
      icon = "❌";
      styleClass = "blunder";
      msg = `Blunder! You missed a guaranteed win in column ${String.fromCharCode(65 + playerWinningCol)}!`;
    }
    else if (opponentWinningCol !== -1 && chosenCol !== opponentWinningCol) {
      icon = "❌";
      styleClass = "blunder";
      msg = `Blunder! You failed to block the opponent's winning threat in column ${String.fromCharCode(65 + opponentWinningCol)}!`;
    }
    else if (gaveOpponentWinCol !== -1) {
      icon = "❌";
      styleClass = "blunder";
      msg = `Blunder! Playing in column ${String.fromCharCode(65 + chosenCol)} allows your opponent to win immediately by playing in column ${String.fromCharCode(65 + gaveOpponentWinCol)}.`;
    }
    else if (playerWinsCountAfter >= 2) {
      icon = "🌟";
      styleClass = "best";
      msg = `Brilliant! Your move in column ${String.fromCharCode(65 + chosenCol)} establishes a double-threat win trap!`;
    }
    else if (oppDoubleThreatsBefore.includes(chosenCol)) {
      icon = "🛡️";
      styleClass = "defense";
      msg = `Preventative Defense! You blocked your opponent from setting up a double-threat trap in column ${String.fromCharCode(65 + chosenCol)}.`;
    }
    else if (oppDoubleThreatsAfter.length > 0) {
      icon = "❌";
      styleClass = "blunder";
      msg = `Blunder! This move allows your opponent to set up a double-threat win trap in column ${String.fromCharCode(65 + oppDoubleThreatsAfter[0])}.`;
    }
    else if (bestMoves.includes(chosenCol)) {
      icon = "⭐";
      styleClass = "best";
      msg = "Strong Move. This matches the engine's preferred continuation.";
    }
    else {
      // Numerical evaluation drop check
      const chosenScore = moveScores[chosenCol] ?? bestScore;
      const scoreDiff = Math.abs(chosenScore - bestScore);
      const bestCol = bestMoves[0];
      
      const preStats = this.getBoardStats(boardState, player);
      const bestRow = this.getNextOpenRow(boardState, bestCol);
      boardState[bestRow][bestCol] = player;
      const postStats = this.getBoardStats(boardState, player);
      boardState[bestRow][bestCol] = 0;
      
      let reason = "";
      if (postStats.opp3 < preStats.opp3) {
        reason = `it blocks your opponent from setting up a 3-in-a-row threat.`;
      } else if (postStats.my3 > preStats.my3) {
        reason = `it creates a dangerous 3-in-a-row threat.`;
      } else if (postStats.my2 > preStats.my2) {
        reason = `it connects your pieces together to build future threats.`;
      } else if (Math.abs(bestCol - 3) < Math.abs(chosenCol - 3)) {
        reason = `it controls the center of the board more effectively.`;
      } else {
        reason = `it gives you more options for connecting pieces on future turns.`;
      }
      
      if (scoreDiff <= 20) {
        icon = "✔️";
        styleClass = "good";
        msg = `Good Move! Column ${String.fromCharCode(65 + chosenCol)} is a solid continuation. Column ${String.fromCharCode(65 + bestCol)} was also strong.`;
      } else if (scoreDiff <= 100) {
        icon = "❓";
        styleClass = "inaccuracy";
        msg = `Inaccuracy! Column ${String.fromCharCode(65 + chosenCol)} is passive. Column ${String.fromCharCode(65 + bestCol)} was better because ${reason}`;
      } else {
        icon = "⚠️";
        styleClass = "blunder";
        msg = `Mistake! Column ${String.fromCharCode(65 + chosenCol)} worsens your position. Column ${String.fromCharCode(65 + bestCol)} was much better because ${reason}`;
      }
    }
    
    this.coachIcon.textContent = icon;
    this.coachIcon.className = `coach-icon ${styleClass}`;
    this.coachMessage.textContent = msg;
    
    // Add evaluation icon to tracker list
    const moveId = player === 1 ? this.moveCount : this.moveCount - 1;
    const entry = document.getElementById(`move-${moveId}`);
    if (entry) {
      const targetSpan = entry.querySelector(player === 1 ? '.move-p1' : '.move-p2');
      if (targetSpan && !targetSpan.querySelector('.move-eval')) {
        const evalSpan = document.createElement('span');
        evalSpan.className = `move-eval ${styleClass}`;
        evalSpan.textContent = icon;
        targetSpan.appendChild(evalSpan);
      }
    }
  }
}

// Start Game
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
