(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PokerCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const LEVELS = Object.freeze([
    { type: 'blind', sb: 100, bb: 200, minutes: 7 },
    { type: 'blind', sb: 200, bb: 400, minutes: 7 },
    { type: 'blind', sb: 300, bb: 600, minutes: 7 },
    { type: 'blind', sb: 400, bb: 800, minutes: 7 },
    { type: 'blind', sb: 500, bb: 1000, minutes: 7 },
    { type: 'break', minutes: 5 },
    { type: 'blind', sb: 1000, bb: 2000, minutes: 7 },
    { type: 'blind', sb: 2000, bb: 4000, minutes: 7 },
    { type: 'blind', sb: 3000, bb: 6000, minutes: 7 },
    { type: 'blind', sb: 4000, bb: 8000, minutes: 7 },
    { type: 'blind', sb: 7000, bb: 14000, minutes: 7 },
    { type: 'break', minutes: 5 },
    { type: 'blind', sb: 10000, bb: 20000, minutes: 7 },
    { type: 'blind', sb: 20000, bb: 40000, minutes: 7 },
    { type: 'blind', sb: 30000, bb: 60000, minutes: 7 },
    { type: 'blind', sb: 40000, bb: 80000, minutes: 7 },
    { type: 'blind', sb: 50000, bb: 100000, minutes: 7 },
  ].map(Object.freeze));

  function blindNumber(stage, levels = LEVELS) {
    let count = 0;
    const last = Math.min(Math.max(Number(stage) || 0, 0), levels.length - 1);
    for (let i = 0; i <= last; i++) if (levels[i]?.type === 'blind') count++;
    return count;
  }

  function formatMs(ms) {
    const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  function advanceExpired(level, remainingMs, levels = LEVELS) {
    let currentLevel = Math.min(Math.max(Number(level) || 0, 0), levels.length - 1);
    let remaining = Number(remainingMs) || 0;
    let advanced = 0;
    while (remaining <= 0 && currentLevel < levels.length - 1) {
      const overdue = Math.max(0, -remaining);
      currentLevel++;
      advanced++;
      remaining = levels[currentLevel].minutes * 60000 - overdue;
    }
    const finished = currentLevel === levels.length - 1 && remaining <= 0;
    return { currentLevel, remainingMs: finished ? 0 : remaining, advanced, finished };
  }

  function rebuyStatus({ currentLevel, rebuyUntilStage, buyin, maxRebuys }) {
    const used = Math.max(0, (Number(buyin) || 0) - 1);
    const open = Number(currentLevel || 0) <= Number(rebuyUntilStage ?? 4);
    const limited = maxRebuys != null && used >= Number(maxRebuys);
    return { open, limited, allowed: open && !limited, used };
  }

  return Object.freeze({ LEVELS, blindNumber, formatMs, advanceExpired, rebuyStatus });
});
