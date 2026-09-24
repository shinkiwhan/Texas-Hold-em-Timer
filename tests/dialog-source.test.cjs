const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('poker-dialog.js', 'utf8');

test('dialog exposes accessible choice buttons', () => {
  assert.match(source, /choose\(options\)/);
  assert.match(source, /poker-dialog-choice/);
  assert.match(source, /config\.choices/);
  assert.match(source, /choice\.description/);
});
