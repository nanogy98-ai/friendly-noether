'use strict';

importScripts('connect-four-engine.js?v=1');

self.addEventListener('message', (event) => {
  const { id, type, payload } = event.data;
  try {
    if (type !== 'best-move' && type !== 'analyze') throw new Error('Unknown engine request');
    const result = self.ConnectFourEngine.analyze(payload.board, payload.player, payload.difficulty);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error.message || 'Engine failure' });
  }
});
