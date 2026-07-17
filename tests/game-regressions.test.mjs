import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const APP_SOURCE = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const ONLINE_SOURCE = readFileSync(new URL('../online-state.js', import.meta.url), 'utf8');
const ENGINE_SOURCE = readFileSync(new URL('../connect-four-engine.js', import.meta.url), 'utf8');
const CSS_SOURCE = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const HTML_SOURCE = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const README_SOURCE = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const RULES = JSON.parse(readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'));

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.classes = new Set();
  }

  add(...names) {
    names.forEach((name) => this.classes.add(name));
    this.sync();
  }

  remove(...names) {
    names.forEach((name) => this.classes.delete(name));
    this.sync();
  }

  toggle(name, force) {
    if (force === true) this.classes.add(name);
    else if (force === false) this.classes.delete(name);
    else if (this.classes.has(name)) this.classes.delete(name);
    else this.classes.add(name);
    this.sync();
  }

  contains(name) {
    return this.classes.has(name);
  }

  sync() {
    this.element.className = Array.from(this.classes).join(' ');
  }
}

class FakeElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.style = {};
    this.eventListeners = {};
    this.attributes = {};
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.src = '';
    this.alt = '';
    this.className = '';
    this.classList = new FakeClassList(this);
    this._textContent = '';
    this._innerHTML = '';
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentNode) return;
    const index = this.parentNode.children.indexOf(this);
    if (index !== -1) this.parentNode.children.splice(index, 1);
    this.parentNode = null;
  }

  addEventListener(type, listener) {
    this.eventListeners[type] ||= [];
    this.eventListeners[type].push(listener);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  focus() {}
  select() {}

  closest(selector) {
    if (matchesSelector(this, selector)) return this;
    return this.parentNode?.closest?.(selector) ?? null;
  }

  querySelector(selector) {
    return findFirst(this, selector);
  }

  querySelectorAll(selector) {
    return findAll(this, selector);
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent).join('');
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this._textContent = '';
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  get innerText() {
    return this.textContent;
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
    this.eventListeners = {};
    this.activeElement = null;
    this.head = this.register(new FakeElement('head', 'head'));
    this.body = this.register(new FakeElement('body', 'body'));
    this.body.classList.add('dark-theme');
    this.diffButtons = ['easy', 'medium', 'hard'].map((diff) => {
      const button = this.register(new FakeElement('button'));
      button.classList.add('diff-btn');
      button.dataset.diff = diff;
      return button;
    });
    this.modeButtons = ['mode-pvp', 'mode-pve', 'mode-online'].map((id) => {
      const button = this.getElementById(id);
      button.classList.add('mode-btn');
      return button;
    });
    this.columnArrows = Array.from({ length: 7 }, (_, col) => {
      const arrow = this.register(new FakeElement('div'));
      arrow.classList.add('col-arrow');
      arrow.dataset.col = String(col);
      return arrow;
    });
  }

  register(element) {
    if (element.id) this.elements.set(element.id, element);
    return element;
  }

  getElementById(id) {
    if (!this.elements.has(id)) {
      const element = new FakeElement(id === 'confetti-canvas' ? 'canvas' : 'div', id);
      if (id.startsWith('input-') || id === 'online-share-url') element.value = '';
      if (id === 'p1-name-text') element.textContent = 'Red Player';
      if (id === 'p2-name-text') element.textContent = 'Yellow Player';
      if (id === 'input-p1-name') element.value = 'Red Player';
      if (id === 'input-p2-name') element.value = 'Yellow Player';
      if (id === 'coach-toggle') element.checked = true;
      if (id === 'settings-drawer') {
        const overlay = new FakeElement('div');
        overlay.classList.add('drawer-overlay');
        element.appendChild(overlay);
      }
      if (id === 'confetti-canvas') {
        element.getContext = () => ({
          beginPath() {},
          clearRect() {},
          lineTo() {},
          moveTo() {},
          stroke() {},
          set lineWidth(_) {},
          set strokeStyle(_) {}
        });
      }
      this.register(element);
    }
    return this.elements.get(id);
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  addEventListener(type, listener) {
    this.eventListeners[type] ||= [];
    this.eventListeners[type].push(listener);
  }

  querySelectorAll(selector) {
    if (selector === '.diff-btn') return this.diffButtons;
    if (selector === '.mode-btn') return this.modeButtons;
    if (selector === '.col-arrow') return this.columnArrows;
    return findAll(this.body, selector).concat(
      Array.from(this.elements.values()).flatMap((element) => findAll(element, selector))
    );
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

function matchesSelector(element, selector) {
  if (selector.startsWith('.')) {
    const className = selector.slice(1);
    return element.classList.contains(className) || element.className.split(/\s+/).includes(className);
  }
  if (selector.startsWith('#')) return element.id === selector.slice(1);
  return element.tagName.toLowerCase() === selector.toLowerCase();
}

function findFirst(root, selector) {
  for (const child of root.children) {
    if (matchesSelector(child, selector)) return child;
    const descendant = findFirst(child, selector);
    if (descendant) return descendant;
  }
  return null;
}

function findAll(root, selector, matches = []) {
  for (const child of root.children) {
    if (matchesSelector(child, selector)) matches.push(child);
    findAll(child, selector, matches);
  }
  return matches;
}

function makeStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

function loadGame(storageSeed = {}, options = {}) {
  const document = new FakeDocument();
  let nextTimerId = 1;
  const queuedTimers = new Map();
  const setTimeoutImpl = (fn) => {
    const id = nextTimerId++;
    if (options.deferTimeouts) queuedTimers.set(id, fn);
    else fn();
    return id;
  };
  const context = {
    console,
    document,
    localStorage: makeStorage(storageSeed),
    window: {
      innerWidth: 1280,
      innerHeight: 720,
      location: { search: '' },
      addEventListener() {},
      AudioContext: undefined,
      webkitAudioContext: undefined
    },
    URLSearchParams,
    alert() {},
    confirm: () => true,
    setInterval: () => 1,
    clearInterval() {},
    setTimeout: setTimeoutImpl,
    clearTimeout(id) {
      queuedTimers.delete(id);
    },
    requestAnimationFrame() {},
    Peer: class {}
  };
  context.globalThis = context;
  vm.runInNewContext(`${ONLINE_SOURCE}\n${APP_SOURCE}\nglobalThis.__exports = { Game, ConnectFourOnlineState };`, context);
  const game = new context.__exports.Game();
  game.sounds.enabled = false;
  const flushTimers = () => {
    while (queuedTimers.size > 0) {
      const timers = Array.from(queuedTimers.entries());
      queuedTimers.clear();
      timers.forEach(([, fn]) => fn());
    }
  };
  return { context, document, flushTimers, game, queuedTimers };
}

function loadEngine() {
  const context = { console, performance };
  context.globalThis = context;
  vm.runInNewContext(ENGINE_SOURCE, context);
  return context.ConnectFourEngine;
}

function loadOnlineState() {
  const context = { console, Date };
  context.globalThis = context;
  vm.runInNewContext(ONLINE_SOURCE, context);
  return context.ConnectFourOnlineState;
}

test('CSS defines a reusable hidden utility for initially hidden settings groups', () => {
  assert.match(CSS_SOURCE, /(^|\n)\.hidden\s*\{/);
});

test('player-facing copy does not use fake quantum AI branding', () => {
  const playerFacingSource = [APP_SOURCE, HTML_SOURCE, README_SOURCE].join('\n');

  assert.doesNotMatch(playerFacingSource, /Quantum/i);
  assert.doesNotMatch(playerFacingSource, /AI Coach/i);
  assert.doesNotMatch(playerFacingSource, /Vs .*AI/i);
  assert.doesNotMatch(playerFacingSource, /AI is computing/i);
  assert.doesNotMatch(playerFacingSource, /AI's Turn/i);
});

test('fresh pass and play games announce the named first player', () => {
  const { document } = loadGame();

  assert.equal(document.getElementById('turn-text').textContent, "Red Player's Turn");
});

test('hover preview updates when the active player changes', () => {
  const { game, document } = loadGame();

  game.showMovePreview(3);
  assert.equal(document.getElementById('preview-row').children[0].className, 'preview-token player1');

  game.activePlayer = 2;
  game.updateTurnUI();

  assert.equal(document.getElementById('preview-row').children[0].className, 'preview-token player2');
  assert.equal(document.querySelectorAll('.col-arrow')[3].classList.contains('active-yellow'), true);
});

test('score pillar captions stay presentation-focused after stats refresh', () => {
  const { game, document } = loadGame();

  game.allTimeScores['Red Player'] = 3;
  game.allTimeScores['Yellow Player'] = 2;
  game.updateAllTimeScoreUI();

  assert.equal(document.getElementById('p1-alltime').textContent, 'CONNECT 4');
  assert.equal(document.getElementById('p2-alltime').textContent, 'CONNECT 4');
  assert.equal(document.getElementById('p1-alltime').getAttribute('title'), 'Red Player lifetime wins: 3');
});

test('restart clears visible move history and resets the move counter', () => {
  const { game, document } = loadGame();

  game.makeMove(5, 3);
  game.makeMove(5, 2);
  assert.equal(document.getElementById('tracker-list').innerText.includes('D'), true);

  game.restartGame();

  assert.equal(game.moveHistory.length, 0);
  assert.equal(game.moveCount, 1);
  assert.equal(document.getElementById('tracker-list').innerText, '');
});

test('undo rebuilds visible move history to match remaining moves', () => {
  const { game, document } = loadGame();

  game.makeMove(5, 3);
  game.makeMove(5, 2);
  game.undoMove();

  assert.equal(game.moveHistory.length, 1);
  assert.equal(game.moveCount, 1);
  assert.equal(document.getElementById('tracker-list').innerText, '1.D');
});

test('restored games rebuild the move tracker and next move number', () => {
  const storedState = {
    board: [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 2, 1, 0, 0, 0]
    ],
    moveHistory: [
      { row: 5, col: 3, player: 1 },
      { row: 5, col: 2, player: 2 }
    ],
    activePlayer: 1,
    gameMode: 'pvp',
    difficulty: 'medium',
    scores: {
      pvp: { p1: 0, p2: 0, draws: 0 },
      pve: { p1: 0, p2: 0, draws: 0 },
      online: { p1: 0, p2: 0, draws: 0 }
    },
    p1_name: 'Ada',
    p2_name_display: 'Grace',
    p2_name_input: 'Grace',
    timerSeconds: 12,
    gameOver: false
  };

  const { game, document } = loadGame({
    connect4_active_game: JSON.stringify(storedState)
  });

  assert.equal(game.moveCount, 2);
  assert.equal(document.getElementById('tracker-list').innerText, '1.DC');
});

test('restored computer games migrate old fake player names', () => {
  const storedState = {
    board: [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 2, 0, 0]
    ],
    moveHistory: [
      { row: 5, col: 3, player: 1 },
      { row: 5, col: 4, player: 2 }
    ],
    activePlayer: 1,
    gameMode: 'pve',
    difficulty: 'medium',
    scores: {
      pvp: { p1: 0, p2: 0, draws: 0 },
      pve: { p1: 0, p2: 0, draws: 0 },
      online: { p1: 0, p2: 0, draws: 0 }
    },
    p1_name: 'Red Player',
    p2_name_display: 'Quantum AI',
    p2_name_input: 'Yellow Player',
    timerSeconds: 8,
    gameOver: false
  };

  const { document } = loadGame({
    connect4_active_game: JSON.stringify(storedState)
  });

  assert.equal(document.getElementById('p2-name-text').textContent, 'Computer');
});

test('saved active game state preserves each player input separately', () => {
  const { game, document, context } = loadGame();
  document.getElementById('input-p1-name').value = 'Ada';
  document.getElementById('p1-name-text').textContent = 'Ada';
  document.getElementById('input-p2-name').value = 'Grace';
  document.getElementById('p2-name-text').textContent = 'Grace';

  game.saveActiveGameState();

  const stored = JSON.parse(context.localStorage.getItem('connect4_active_game'));
  assert.equal(stored.p1_name_input, 'Ada');
  assert.equal(stored.p2_name_input, 'Grace');
});

test('fresh games do not start the stopwatch before the first move', () => {
  const { game } = loadGame();

  assert.equal(game.timerInterval, null);
  assert.equal(game.timerSeconds, 0);
});

test('new game cancels a pending token completion from the old board', () => {
  const { game, flushTimers } = loadGame({}, { deferTimeouts: true });

  game.makeMove(5, 3);
  game.restartGame();
  flushTimers();

  assert.equal(game.moveHistory.length, 0);
  assert.equal(game.activePlayer, 1);
  assert.equal(game.gameOver, false);
});

test('new game cancels a pending computer reply', () => {
  const { game, flushTimers } = loadGame({}, { deferTimeouts: true });
  game.gameMode = 'pve';
  game.activePlayer = 2;

  game.triggerComputerMove();
  game.restartGame();
  flushTimers();

  assert.equal(game.moveHistory.length, 0);
  assert.equal(game.activePlayer, 1);
});

test('undoing a finished game rolls back session and all-time scores', () => {
  const { game } = loadGame();
  const columns = [0, 1, 0, 1, 0, 1, 0];
  columns.forEach((col) => game.makeMove(game.getNextOpenRow(game.board, col), col));

  assert.equal(game.gameOver, true);
  assert.equal(game.scores.pvp.p1, 1);
  assert.equal(game.allTimeScores['Red Player'], 1);

  game.undoMove();

  assert.equal(game.gameOver, false);
  assert.equal(game.scores.pvp.p1, 0);
  assert.equal(game.allTimeScores['Red Player'] ?? 0, 0);
});

test('restored timed games account for elapsed time away from the page', () => {
  const state = {
    board: Array.from({ length: 6 }, (_, row) => row === 5 ? [0, 0, 0, 1, 0, 0, 0] : Array(7).fill(0)),
    moveHistory: [{ row: 5, col: 3, player: 1 }],
    activePlayer: 2,
    gameMode: 'pvp',
    difficulty: 'medium',
    scores: {
      pvp: { p1: 0, p2: 0, draws: 0 },
      pve: { p1: 0, p2: 0, draws: 0 },
      online: { p1: 0, p2: 0, draws: 0 }
    },
    timerSeconds: 2,
    timeControl: 15,
    p1TimeRemaining: 15,
    p2TimeRemaining: 15,
    savedAt: Date.now() - 3500,
    gameOver: false
  };

  const { game } = loadGame({ connect4_active_game: JSON.stringify(state) });

  assert.equal(game.timerSeconds, 5);
  assert.equal(game.p1TimeRemaining, 15);
  assert.equal(game.p2TimeRemaining, 12);
});

test('legacy computer names cannot leak back into pass and play', () => {
  const fakeName = ['Quant', 'um AI'].join('');
  const storedState = {
    board: Array.from({ length: 6 }, () => Array(7).fill(0)),
    moveHistory: [],
    activePlayer: 1,
    gameMode: 'pve',
    difficulty: 'medium',
    scores: {
      pvp: { p1: 0, p2: 0, draws: 0 },
      pve: { p1: 0, p2: 0, draws: 0 },
      online: { p1: 0, p2: 0, draws: 0 }
    },
    p1_name: 'Red Player',
    p2_name_display: fakeName,
    p2_name_input: fakeName,
    timerSeconds: 0,
    gameOver: false
  };
  const { game, document } = loadGame({ connect4_active_game: JSON.stringify(storedState) });

  game.switchMode('pvp');

  assert.equal(document.getElementById('input-p2-name').value, 'Yellow Player');
  assert.equal(document.getElementById('p2-name-text').textContent, 'Yellow Player');
});

test('engine finds immediate wins and compulsory blocks', () => {
  const engine = loadEngine();
  const winningBoard = Array.from({ length: 6 }, () => Array(7).fill(0));
  winningBoard[5] = [2, 2, 2, 0, 1, 0, 0];
  const blockingBoard = Array.from({ length: 6 }, () => Array(7).fill(0));
  blockingBoard[5] = [1, 1, 1, 0, 2, 0, 0];

  assert.equal(engine.analyze(winningBoard, 2, 'medium').bestCol, 3);
  assert.equal(engine.analyze(blockingBoard, 2, 'medium').bestCol, 3);
});

test('engine detects horizontal, vertical, and both diagonal wins', () => {
  const engine = loadEngine();
  const positions = [
    [[5, 0], [5, 1], [5, 2], [5, 3]],
    [[5, 0], [4, 0], [3, 0], [2, 0]],
    [[5, 0], [4, 1], [3, 2], [2, 3]],
    [[2, 0], [3, 1], [4, 2], [5, 3]]
  ];

  positions.forEach((cells) => {
    const board = Array.from({ length: 6 }, () => Array(7).fill(0));
    cells.forEach(([row, col]) => { board[row][col] = 1; });
    assert.equal(engine.checkWin(board).player, 1);
  });
});

test('authoritative online state rejects stale turns and full columns', () => {
  const online = loadOnlineState();
  let state = online.createInitialState({ roundId: 'A'.repeat(22), now: 1 });

  assert.equal(online.applyMove(state, 3, 2, 2), null);
  for (let index = 0; index < 6; index++) {
    state = online.applyMove(state, 3, state.activePlayer, index + 2);
  }

  assert.equal(online.applyMove(state, 3, state.activePlayer, 10), null);
  assert.equal(state.moveHistory.length, 6);
});

test('authoritative snapshots fully hydrate reconnecting players', () => {
  const online = loadOnlineState();
  let hostState = online.createInitialState({ roundId: 'B'.repeat(22), now: 1 });
  [3, 2, 3, 4, 2].forEach((col) => {
    hostState = online.applyMove(hostState, col, hostState.activePlayer, hostState.revision + 2);
  });

  const guestState = online.normalizeState(JSON.parse(JSON.stringify(hostState)));

  assert.deepEqual(JSON.parse(JSON.stringify(guestState.board)), JSON.parse(JSON.stringify(hostState.board)));
  assert.deepEqual(JSON.parse(JSON.stringify(guestState.moveHistory)), JSON.parse(JSON.stringify(hostState.moveHistory)));
  assert.equal(guestState.revision, 5);
  assert.equal(guestState.activePlayer, 2);
});

test('online wins and resets update scores exactly once', () => {
  const online = loadOnlineState();
  let state = online.createInitialState({ roundId: 'C'.repeat(22), now: 1 });
  [0, 1, 0, 1, 0, 1, 0].forEach((col) => {
    state = online.applyMove(state, col, state.activePlayer, state.revision + 2);
  });

  assert.equal(state.gameOver, true);
  assert.equal(state.winner, 1);
  assert.equal(state.scores.p1, 1);
  assert.equal(online.applyMove(state, 2, 2, 20), null);

  const reset = online.resetState(state, {
    timeControl: 30,
    matchTargetWins: 3,
    roundId: 'D'.repeat(22),
    now: 21
  });
  assert.equal(reset.scores.p1, 1);
  assert.equal(reset.moveHistory.length, 0);
  assert.equal(reset.p1Time, 30);
  assert.equal(reset.revision, state.revision + 1);
});

test('host clock transactions produce one authoritative timeout result', () => {
  const online = loadOnlineState();
  let state = online.createInitialState({ timeControl: 15, roundId: 'E'.repeat(22), now: 1 });
  state = online.applyMove(state, 3, 1, 2);
  state = online.advanceClock(state, 15, 15, 17);

  assert.equal(state.gameOver, true);
  assert.equal(state.resultType, 'timeout');
  assert.equal(state.winner, 1);
  assert.equal(state.scores.p1, 1);
  assert.equal(online.advanceClock(state, 1, 15, 18), null);
});

test('online database rules deny root reads and require unguessable room ids', () => {
  assert.equal(RULES.rules['.read'], false);
  assert.equal(RULES.rules['.write'], false);
  assert.match(RULES.rules.rooms.$roomId['.read'], /\{22\}/);
  assert.match(RULES.rules.rooms.$roomId['.read'], /expiresAt/);
  assert.match(RULES.rules.rooms.$roomId['.read'], /auth != null/);
  assert.match(RULES.rules.rooms.$roomId['.write'], /hostUid/);
});

test('Firebase is removed from the critical render path', () => {
  assert.doesNotMatch(HTML_SOURCE, /firebase-app\.js/);
  assert.match(APP_SOURCE, /ensureFirebase/);
});

test('tablet layout covers the former 601 to 700 pixel breakpoint gap', () => {
  assert.match(CSS_SOURCE, /@media\s*\(min-width:\s*601px\)\s*and\s*\(max-width:\s*1180px\)/);
});
