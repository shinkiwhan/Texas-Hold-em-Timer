const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const central = fs.readFileSync('poker_timer-2.html', 'utf8');
const participant = fs.readFileSync('participant.html', 'utf8');

test('central creates and restores rooms by mode', () => {
  assert.match(central, /PokerDialog\.choose/);
  assert.match(central, /p_mode:\s*selectedMode/);
  assert.match(central, /setActiveMode\(room\.mode/);
  assert.match(central, /mode:\s*activeMode\.id/);
  assert.match(central, /buildRebuyCutoffOptions/);
  assert.match(central, /restoreTimerSnapshot/);
});

test('both screens resolve levels through shared mode profiles', () => {
  assert.match(central, /PokerCore\.getMode/);
  assert.match(participant, /PokerCore\.getMode/);
  assert.doesNotMatch(participant, /const LEVELS\s*=\s*\[/);
});

test('participant displays and applies the room mode', () => {
  assert.match(participant, /id="mobile-mode"/);
  assert.match(participant, /const profile = PokerCore\.getMode\(room\.mode\)/);
  assert.match(participant, /profile\.levels/);
  assert.match(participant, /profile\.label/);
});
