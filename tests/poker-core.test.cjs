const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../poker-core.js');

test('blind numbering ignores breaks', () => {
  assert.equal(core.blindNumber(0), 1);
  assert.equal(core.blindNumber(5), 5);
  assert.equal(core.blindNumber(6), 6);
  assert.equal(core.blindNumber(11), 10);
  assert.equal(core.blindNumber(16), 15);
});

test('time formatting rounds up active seconds', () => {
  assert.equal(core.formatMs(7 * 60000), '07:00');
  assert.equal(core.formatMs(1001), '00:02');
  assert.equal(core.formatMs(-1), '00:00');
});

test('elapsed time advances through multiple levels and breaks', () => {
  const result = core.advanceExpired(4, -(5 * 60000 + 30000));
  assert.equal(result.currentLevel, 6);
  assert.equal(result.remainingMs, 6.5 * 60000);
  assert.equal(result.advanced, 2);
  assert.equal(result.finished, false);
});

test('elapsed time stops at tournament end', () => {
  const result = core.advanceExpired(core.LEVELS.length - 1, -1000);
  assert.deepEqual(result, {
    currentLevel: core.LEVELS.length - 1,
    remainingMs: 0,
    advanced: 0,
    finished: true,
  });
});

test('rebuy status enforces cutoff and per-player maximum', () => {
  assert.equal(core.rebuyStatus({ currentLevel: 4, rebuyUntilStage: 4, buyin: 2, maxRebuys: 2 }).allowed, true);
  assert.equal(core.rebuyStatus({ currentLevel: 5, rebuyUntilStage: 4, buyin: 1, maxRebuys: null }).open, false);
  assert.equal(core.rebuyStatus({ currentLevel: 2, rebuyUntilStage: 4, buyin: 3, maxRebuys: 2 }).limited, true);
});
