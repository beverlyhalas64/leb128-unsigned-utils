import { test } from 'node:test';
import assert from 'node:assert/strict';

import { encodeUnsignedLeb128, decodeUnsignedLeb128 } from '../src/index.js';

test('encodes zero as a single zero byte', () => {
  assert.deepEqual(encodeUnsignedLeb128(0), [0x00]);
});

test('encodes values that fit in one byte without a continuation bit', () => {
  assert.deepEqual(encodeUnsignedLeb128(1), [0x01]);
  assert.deepEqual(encodeUnsignedLeb128(127), [0x7f]);
});

test('encodes 128 with a continuation byte', () => {
  // 128 = 0b10000000 -> low 7 bits 0, continuation set; then a final 0x01.
  assert.deepEqual(encodeUnsignedLeb128(128), [0x80, 0x01]);
});

test('encodes the canonical WebAssembly 624485 example', () => {
  // Classic LEB128 example from the WebAssembly spec.
  assert.deepEqual(encodeUnsignedLeb128(624485), [0xe5, 0x8e, 0x26]);
});

test('encodes MAX_SAFE_INTEGER', () => {
  // 2^53-1 = 9007199254740991.  This is the largest value we support.
  const encoded = encodeUnsignedLeb128(Number.MAX_SAFE_INTEGER);
  // Round-trip is the meaningful check; the exact byte length is a sanity check.
  assert.equal(encoded.length, 8);
  const decoded = decodeUnsignedLeb128(encoded);
  assert.equal(decoded.value, Number.MAX_SAFE_INTEGER);
  assert.equal(decoded.bytesConsumed, encoded.length);
});

test('decode returns the value and the number of bytes consumed', () => {
  const result = decodeUnsignedLeb128([0xe5, 0x8e, 0x26]);
  assert.equal(result.value, 624485);
  assert.equal(result.bytesConsumed, 3);
});

test('decode stops at the terminator and ignores trailing bytes', () => {
  // The trailing 0xff should be ignored because the first byte has no
  // continuation bit.  This mirrors reading from a stream where more
  // data follows the integer.
  const result = decodeUnsignedLeb128([0x7f, 0xff]);
  assert.equal(result.value, 127);
  assert.equal(result.bytesConsumed, 1);
});

test('decode accepts a Uint8Array, not just a plain array', () => {
  const bytes = new Uint8Array([0xe5, 0x8e, 0x26]);
  const result = decodeUnsignedLeb128(bytes);
  assert.equal(result.value, 624485);
  assert.equal(result.bytesConsumed, 3);
});

test('encode rejects negative values', () => {
  assert.throws(() => encodeUnsignedLeb128(-1), RangeError);
});

test('encode rejects non-integer values', () => {
  assert.throws(() => encodeUnsignedLeb128(1.5), RangeError);
  assert.throws(() => encodeUnsignedLeb128('127'), RangeError);
});

test('decode rejects an empty byte array', () => {
  assert.throws(() => decodeUnsignedLeb128([]), RangeError);
});

test('decode rejects a truncated stream that never terminates', () => {
  // Every byte has the continuation bit set, so there is no terminator.
  assert.throws(() => decodeUnsignedLeb128([0x80, 0x80, 0x80]), RangeError);
});

test('decode rejects out-of-range byte values', () => {
  assert.throws(() => decodeUnsignedLeb128([256]), RangeError);
});
