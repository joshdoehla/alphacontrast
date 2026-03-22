/**
 * Alpha Contrast v2.0 — Node.js tests
 *
 * Tests the module-export path and all non-DOM helpers that can run
 * without a real browser (resolveFilter, mode registry, public API shape).
 *
 * Run:  node test/alphacontrast.test.js
 */

'use strict';

var assert = require('assert');

// The UMD wrapper detects `module.exports` and exports the factory result.
var AlphaContrast = require('../alphacontrast');

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  \u2714 ' + name);
  } catch (e) {
    failed++;
    console.log('  \u2718 ' + name);
    console.log('    ' + e.message);
  }
}

console.log('\nAlpha Contrast v2.0 — tests\n');

/* ─── Module export ───────────────────────────────────────────── */

test('exports an object', function () {
  assert.strictEqual(typeof AlphaContrast, 'object');
  assert.notStrictEqual(AlphaContrast, null);
});

test('exposes expected API methods', function () {
  var methods = ['init', 'scan', 'refresh', 'setMode', 'destroy', 'destroyAll', 'registerMode'];
  methods.forEach(function (m) {
    assert.strictEqual(typeof AlphaContrast[m], 'function', m + ' should be a function');
  });
});

test('exposes modes object', function () {
  assert.strictEqual(typeof AlphaContrast.modes, 'object');
});

/* ─── Built-in modes ──────────────────────────────────────────── */

test('has invert mode', function () {
  assert.strictEqual(AlphaContrast.modes.invert, 'invert(1)');
});

test('has complement mode', function () {
  assert.strictEqual(AlphaContrast.modes.complement, 'hue-rotate(180deg)');
});

test('has bw mode with threshold placeholder', function () {
  assert.ok(AlphaContrast.modes.bw.indexOf('__THRESHOLD__') !== -1);
});

test('has luminance mode', function () {
  assert.strictEqual(AlphaContrast.modes.luminance, 'invert(1) hue-rotate(180deg)');
});

/* ─── registerMode ────────────────────────────────────────────── */

test('registerMode adds a new mode', function () {
  var ret = AlphaContrast.registerMode('sepia', 'sepia(1)');
  assert.strictEqual(AlphaContrast.modes.sepia, 'sepia(1)');
  assert.strictEqual(ret, AlphaContrast, 'should return AlphaContrast for chaining');
});

test('registerMode can overwrite an existing mode', function () {
  AlphaContrast.registerMode('invert', 'invert(0.8)');
  assert.strictEqual(AlphaContrast.modes.invert, 'invert(0.8)');
  // restore
  AlphaContrast.registerMode('invert', 'invert(1)');
});

/* ─── API chaining ────────────────────────────────────────────── */

test('destroy returns AlphaContrast (no-op, no element)', function () {
  // Calling destroy on a non-initialised element is a safe no-op
  var ret = AlphaContrast.destroy({});
  assert.strictEqual(ret, AlphaContrast);
});

test('destroyAll returns AlphaContrast', function () {
  var ret = AlphaContrast.destroyAll();
  assert.strictEqual(ret, AlphaContrast);
});

test('setMode returns AlphaContrast for unknown element', function () {
  var ret = AlphaContrast.setMode({}, 'invert');
  assert.strictEqual(ret, AlphaContrast);
});

test('refresh returns AlphaContrast', function () {
  var ret = AlphaContrast.refresh();
  assert.strictEqual(ret, AlphaContrast);
});

/* ─── Summary ─────────────────────────────────────────────────── */

console.log('\n  ' + passed + ' passed, ' + failed + ' failed\n');

if (failed > 0) process.exit(1);
