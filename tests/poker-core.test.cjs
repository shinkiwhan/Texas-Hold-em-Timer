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

test('mode lookup defaults to daily and preserves legacy levels', () => {
  assert.equal(core.getMode().id, 'daily');
  assert.equal(core.getMode('unknown').id, 'daily');
  assert.equal(core.getMode('daily').levels, core.LEVELS);
  assert.equal(core.MODES.daily.levels.length, 17);
  assert.ok(Object.isFrozen(core.MODES));
  assert.ok(Object.isFrozen(core.MODES.satellite.levels));
});

test('satellite structure uses ten-minute blinds and five-level breaks', () => {
  const levels = core.MODES.satellite.levels;
  const blinds = levels.filter(level => level.type === 'blind');
  assert.equal(blinds.length, 26);
  assert.deepEqual(blinds.slice(0, 10).map(({ sb, bb }) => [sb, bb]), [
    [100, 200], [200, 400], [300, 600], [400, 800], [500, 1000],
    [600, 1200], [800, 1600], [1000, 2000], [1500, 3000], [2000, 4000],
  ]);
  assert.ok(blinds.every(level => level.minutes === 10));
  assert.deepEqual(levels.filter(level => level.type === 'break').map(level => level.minutes), [5, 5, 5, 5, 5]);
  for (const stage of [5, 11, 17, 23, 29]) assert.equal(levels[stage].type, 'break');
});

test('satellite elapsed catch-up crosses a break correctly', () => {
  const levels = core.MODES.satellite.levels;
  const result = core.advanceExpired(4, -(5 * 60000 + 30000), levels);
  assert.equal(result.currentLevel, 6);
  assert.equal(result.remainingMs, 9.5 * 60000);
});
