import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const APP_SOURCE = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const CSS_SOURCE = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const HTML_SOURCE = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const README_SOURCE = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

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

function loadGame(storageSeed = {}) {
  const document = new FakeDocument();
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
    setTimeout: (fn) => {
      fn();
      return 1;
    },
    requestAnimationFrame() {},
    Peer: class {}
  };
  context.globalThis = context;
  vm.runInNewContext(`${APP_SOURCE}\nglobalThis.__exports = { Game };`, context);
  const game = new context.__exports.Game();
  game.sounds.enabled = false;
  return { context, document, game };
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
