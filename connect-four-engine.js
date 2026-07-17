(function attachConnectFourEngine(globalScope) {
  'use strict';

  const ROWS = 6;
  const COLS = 7;
  const WIN_SCORE = 1000000;
  const CENTER_ORDER = [3, 2, 4, 1, 5, 0, 6];

  function nextOpenRow(board, col) {
    for (let row = ROWS - 1; row >= 0; row--) {
      if (board[row][col] === 0) return row;
    }
    return -1;
  }

  function validMoves(board) {
    return CENTER_ORDER.filter((col) => board[0][col] === 0);
  }

  function checkWin(board) {
    const directions = [[0, 1], [1, 0], [1, 1], [-1, 1]];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const player = board[row][col];
        if (!player) continue;
        for (const [rowStep, colStep] of directions) {
          const cells = [];
          for (let index = 0; index < 4; index++) {
            const nextRow = row + rowStep * index;
            const nextCol = col + colStep * index;
            if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS) break;
            if (board[nextRow][nextCol] !== player) break;
            cells.push([nextRow, nextCol]);
          }
          if (cells.length === 4) return { player, cells };
        }
      }
    }
    return null;
  }

  function evaluateWindow(window) {
    const computer = window.filter((value) => value === 2).length;
    const human = window.filter((value) => value === 1).length;
    const empty = 4 - computer - human;
    if (computer && human) return 0;
    if (computer === 4) return 100000;
    if (human === 4) return -100000;
    if (computer === 3 && empty === 1) return 120;
    if (human === 3 && empty === 1) return -135;
    if (computer === 2 && empty === 2) return 12;
    if (human === 2 && empty === 2) return -14;
    return 0;
  }

  function evaluateBoard(board) {
    let score = 0;
    for (let row = 0; row < ROWS; row++) {
      if (board[row][3] === 2) score += 7;
      if (board[row][3] === 1) score -= 7;
    }

    const addWindow = (cells) => {
      score += evaluateWindow(cells.map(([row, col]) => board[row][col]));
    };

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col <= COLS - 4; col++) {
        addWindow([[row, col], [row, col + 1], [row, col + 2], [row, col + 3]]);
      }
    }
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row <= ROWS - 4; row++) {
        addWindow([[row, col], [row + 1, col], [row + 2, col], [row + 3, col]]);
      }
    }
    for (let row = 0; row <= ROWS - 4; row++) {
      for (let col = 0; col <= COLS - 4; col++) {
        addWindow([[row, col], [row + 1, col + 1], [row + 2, col + 2], [row + 3, col + 3]]);
      }
    }
    for (let row = 3; row < ROWS; row++) {
      for (let col = 0; col <= COLS - 4; col++) {
        addWindow([[row, col], [row - 1, col + 1], [row - 2, col + 2], [row - 3, col + 3]]);
      }
    }
    return score;
  }

  function orderedMoves(board, player) {
    const opponent = player === 1 ? 2 : 1;
    return validMoves(board)
      .map((col) => {
        const row = nextOpenRow(board, col);
        let priority = 20 - Math.abs(3 - col);
        board[row][col] = player;
        if (checkWin(board)) priority += 10000;
        board[row][col] = opponent;
        if (checkWin(board)) priority += 5000;
        board[row][col] = 0;
        return { col, priority };
      })
      .sort((a, b) => b.priority - a.priority)
      .map(({ col }) => col);
  }

  function boardKey(board, player) {
    return `${player}:${board.map((row) => row.join('')).join('')}`;
  }

  function minimax(board, depth, alpha, beta, player, deadline, table) {
    if (performance.now() > deadline) throw new Error('SEARCH_TIMEOUT');
    const winner = checkWin(board);
    if (winner) return winner.player === 2 ? WIN_SCORE + depth : -WIN_SCORE - depth;
    const moves = validMoves(board);
    if (depth === 0 || moves.length === 0) return evaluateBoard(board);

    const key = boardKey(board, player);
    const cached = table.get(key);
    if (cached && cached.depth >= depth) {
      if (cached.flag === 'exact') return cached.score;
      if (cached.flag === 'lower') alpha = Math.max(alpha, cached.score);
      if (cached.flag === 'upper') beta = Math.min(beta, cached.score);
      if (alpha >= beta) return cached.score;
    }

    const alphaStart = alpha;
    const betaStart = beta;
    const maximizing = player === 2;
    let best = maximizing ? -Infinity : Infinity;

    for (const col of orderedMoves(board, player)) {
      const row = nextOpenRow(board, col);
      board[row][col] = player;
      const score = minimax(board, depth - 1, alpha, beta, player === 1 ? 2 : 1, deadline, table);
      board[row][col] = 0;
      if (maximizing) {
        best = Math.max(best, score);
        alpha = Math.max(alpha, best);
      } else {
        best = Math.min(best, score);
        beta = Math.min(beta, best);
      }
      if (alpha >= beta) break;
    }

    let flag = 'exact';
    if (best <= alphaStart) flag = 'upper';
    else if (best >= betaStart) flag = 'lower';
    table.set(key, { depth, score: best, flag });
    return best;
  }

  function searchAtDepth(board, player, depth, deadline) {
    const table = new Map();
    const moveScores = {};
    const moves = orderedMoves(board, player);
    let bestScore = player === 2 ? -Infinity : Infinity;
    let bestMoves = [];

    for (const col of moves) {
      const row = nextOpenRow(board, col);
      board[row][col] = player;
      const score = minimax(board, depth - 1, -Infinity, Infinity, player === 1 ? 2 : 1, deadline, table);
      board[row][col] = 0;
      moveScores[col] = score;
      const improves = player === 2 ? score > bestScore : score < bestScore;
      if (improves) {
        bestScore = score;
        bestMoves = [col];
      } else if (score === bestScore) {
        bestMoves.push(col);
      }
    }
    return { bestCol: bestMoves[0] ?? null, bestMoves, bestScore, moveScores, depth };
  }

  function analyze(board, player, difficulty = 'medium') {
    const moves = validMoves(board);
    if (moves.length === 0) return { bestCol: null, bestMoves: [], bestScore: 0, moveScores: {}, depth: 0 };
    if (difficulty === 'easy') {
      const bestCol = moves[Math.floor(Math.random() * moves.length)];
      return { bestCol, bestMoves: [bestCol], bestScore: 0, moveScores: {}, depth: 0 };
    }

    const settings = {
      medium: { maxDepth: 4, budgetMs: 180 },
      hard: { maxDepth: 7, budgetMs: 650 },
      expert: { maxDepth: 10, budgetMs: 1600 }
    }[difficulty] || { maxDepth: 4, budgetMs: 180 };
    const deadline = performance.now() + settings.budgetMs;
    let completed = { bestCol: moves[0], bestMoves: [moves[0]], bestScore: 0, moveScores: {}, depth: 0 };

    for (let depth = 1; depth <= settings.maxDepth; depth++) {
      try {
        completed = searchAtDepth(board, player, depth, deadline);
        if (Math.abs(completed.bestScore) >= WIN_SCORE) break;
      } catch (error) {
        if (error.message !== 'SEARCH_TIMEOUT') throw error;
        break;
      }
    }
    return completed;
  }

  globalScope.ConnectFourEngine = {
    analyze,
    checkWin,
    evaluateBoard,
    nextOpenRow,
    validMoves
  };
})(typeof self !== 'undefined' ? self : globalThis);
