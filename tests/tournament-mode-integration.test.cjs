const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const central = fs.readFileSync('poker_timer-2.html', 'utf8');
const participant = fs.readFileSync('participant.html', 'utf8');
const migrationPath = 'supabase/migrations/20260924000100_tournament_modes.sql';

test('central creates and restores rooms by mode', () => {
  assert.match(central, /PokerDialog\.choose/);
  assert.match(central, /p_mode:\s*selectedMode/);
  assert.match(central, /setActiveMode\(room\.mode/);
  assert.match(central, /mode:\s*activeMode\.id/);
  assert.match(central, /buildRebuyCutoffOptions/);
  assert.match(central, /restoreTimerSnapshot/);
});

test('mode chooser descriptions only show blind duration', () => {
  assert.match(central, /description:\s*'블라인드 7분'/);
  assert.match(central, /description:\s*'블라인드 10분'/);
  assert.doesNotMatch(central, /현재 스트럭처/);
  assert.doesNotMatch(central, /5레벨마다 5분 휴식/);
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

test('migration stores and validates tournament mode', () => {
  assert.ok(fs.existsSync(migrationPath), 'tournament mode migration must exist');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  assert.match(migration, /add column if not exists mode text not null default 'daily'/i);
  assert.match(migration, /mode in \('daily', 'satellite'\)/i);
  assert.match(migration, /p_mode text/i);
  assert.match(migration, /p_mode not in \('daily', 'satellite'\)/i);
  assert.match(migration, /current_level between 0 and 63/i);
});
