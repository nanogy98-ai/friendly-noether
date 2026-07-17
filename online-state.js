(function attachOnlineState(globalScope) {
  'use strict';

  const ROWS = 6;
  const COLS = 7;

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  function safeInteger(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
  }

  function normalizeScores(scores) {
    return {
      p1: safeInteger(scores?.p1),
      p2: safeInteger(scores?.p2),
      draws: safeInteger(scores?.draws)
    };
  }

  function isValidBoard(board) {
    return Array.isArray(board)
      && board.length === ROWS
      && board.every((row) => Array.isArray(row)
        && row.length === COLS
        && row.every((cell) => cell === 0 || cell === 1 || cell === 2));
  }

  function normalizeHistory(history) {
    if (!Array.isArray(history)) return [];
    return history
      .filter((move) => Number.isInteger(move?.row)
        && move.row >= 0 && move.row < ROWS
        && Number.isInteger(move?.col)
        && move.col >= 0 && move.col < COLS
        && (move.player === 1 || move.player === 2))
      .slice(0, ROWS * COLS)
      .map(({ row, col, player }) => ({ row, col, player }));
  }

  function findWin(board) {
    const directions = [[0, 1], [1, 0], [1, 1], [-1, 1]];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const player = board[row][col];
        if (!player) continue;
        for (const [rowStep, colStep] of directions) {
          const cells = [];
          for (let index = 0; index < 4; index++) {
            const nextRow = row + (rowStep * index);
            const nextCol = col + (colStep * index);
            if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS
              || board[nextRow][nextCol] !== player) break;
            cells.push([nextRow, nextCol]);
          }
          if (cells.length === 4) return { player, cells };
        }
      }
    }
    return null;
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const board = isValidBoard(raw.board) ? raw.board.map((row) => [...row]) : null;
    if (!board) return null;

    const history = normalizeHistory(raw.moveHistory);
    const occupied = board.flat().filter(Boolean).length;
    if (history.length !== occupied) return null;

    return {
      board,
      moveHistory: history,
      activePlayer: raw.activePlayer === 2 ? 2 : 1,
      gameOver: Boolean(raw.gameOver),
      winner: raw.winner === 1 || raw.winner === 2 ? raw.winner : 0,
      resultType: ['none', 'win', 'draw', 'timeout'].includes(raw.resultType) ? raw.resultType : 'none',
      roundId: typeof raw.roundId === 'string' ? raw.roundId.slice(0, 32) : '',
      revision: safeInteger(raw.revision),
      timerSeconds: safeInteger(raw.timerSeconds),
      p1Time: safeInteger(raw.p1Time),
      p2Time: safeInteger(raw.p2Time),
      scores: normalizeScores(raw.scores),
      lastMove: raw.lastMove && Number.isInteger(raw.lastMove.row) && Number.isInteger(raw.lastMove.col)
        ? { row: raw.lastMove.row, col: raw.lastMove.col, player: raw.lastMove.player === 2 ? 2 : 1 }
        : null,
      updatedAt: safeInteger(raw.updatedAt)
    };
  }

  function createInitialState(options = {}) {
    const timeControl = safeInteger(options.timeControl);
    return {
      board: emptyBoard(),
      moveHistory: [],
      activePlayer: 1,
      gameOver: false,
      winner: 0,
      resultType: 'none',
      roundId: String(options.roundId || ''),
      revision: safeInteger(options.revision),
      timerSeconds: 0,
      p1Time: timeControl,
      p2Time: timeControl,
      scores: normalizeScores(options.scores),
      updatedAt: safeInteger(options.now, Date.now())
    };
  }

  function getOpenRow(board, col) {
    if (!Number.isInteger(col) || col < 0 || col >= COLS) return -1;
    for (let row = ROWS - 1; row >= 0; row--) {
      if (board[row][col] === 0) return row;
    }
    return -1;
  }

  function applyMove(raw, col, player, now = Date.now()) {
    const state = normalizeState(raw);
    if (!state || state.gameOver || state.activePlayer !== player) return null;
    const row = getOpenRow(state.board, col);
    if (row < 0) return null;

    state.board[row][col] = player;
    state.moveHistory.push({ row, col, player });
    state.lastMove = { row, col, player };
    state.revision += 1;
    state.updatedAt = safeInteger(now);

    const win = findWin(state.board);
    if (win) {
      state.gameOver = true;
      state.winner = player;
      state.resultType = 'win';
      state.scores[player === 1 ? 'p1' : 'p2'] += 1;
    } else if (state.moveHistory.length === ROWS * COLS) {
      state.gameOver = true;
      state.winner = 0;
      state.resultType = 'draw';
      state.scores.draws += 1;
    } else {
      state.activePlayer = player === 1 ? 2 : 1;
    }

    return state;
  }

  function resetState(raw, options = {}) {
    const state = normalizeState(raw);
    if (!state) return null;
    const targetWins = safeInteger(options.matchTargetWins);
    const seriesComplete = targetWins > 0
      && (state.scores.p1 >= targetWins || state.scores.p2 >= targetWins);
    return createInitialState({
      timeControl: options.timeControl,
      roundId: options.roundId,
      revision: state.revision + 1,
      scores: seriesComplete ? { p1: 0, p2: 0, draws: 0 } : state.scores,
      now: options.now
    });
  }

  function advanceClock(raw, elapsed, timeControl, now = Date.now()) {
    const state = normalizeState(raw);
    const seconds = safeInteger(elapsed);
    if (!state || state.gameOver || state.moveHistory.length === 0 || seconds < 1) return null;

    state.timerSeconds += seconds;
    if (safeInteger(timeControl) > 0) {
      const clockKey = state.activePlayer === 1 ? 'p1Time' : 'p2Time';
      state[clockKey] = Math.max(0, state[clockKey] - seconds);
      if (state[clockKey] === 0) {
        state.gameOver = true;
        state.winner = state.activePlayer === 1 ? 2 : 1;
        state.resultType = 'timeout';
        state.scores[state.winner === 1 ? 'p1' : 'p2'] += 1;
      }
    }
    state.revision += 1;
    state.updatedAt = safeInteger(now);
    return state;
  }

  globalScope.ConnectFourOnlineState = Object.freeze({
    ROWS,
    COLS,
    advanceClock,
    applyMove,
    createInitialState,
    emptyBoard,
    findWin,
    getOpenRow,
    normalizeState,
    resetState
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
