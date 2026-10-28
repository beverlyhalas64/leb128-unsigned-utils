/**
 * LEB128 (Little-Endian Base 128) unsigned integer codec.
 *
 * Used by WebAssembly and DWARF to encode variable-length unsigned integers
 * into a byte stream where each byte carries 7 payload bits and a high
 * continuation bit.
 */

/**
 * Encodes a non-negative integer as unsigned LEB128 bytes.
 *
 * We deliberately take `number` (not `bigint`) because the intended use is
 * WebAssembly/DWARF indices and offsets, which fit comfortably inside the
 * 53-bit safe-integer range. If you need arbitrary precision, this is the
 * wrong library and a bigint-based codec would be more appropriate.
 *
 * @param {number} value - Non-negative integer to encode.
 * @returns {number[]} Array of byte values (0-255), little-endian.
 * @throws {RangeError} If `value` is negative, not a safe integer, or not an integer.
 */
export function encodeUnsignedLeb128(value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new RangeError(
      'encodeUnsignedLeb128 requires a safe integer; received ' + String(value)
    );
  }
  if (value < 0) {
    throw new RangeError('encodeUnsignedLeb128 requires a non-negative integer');
  }

  const out = [];
  let remaining = value;
  do {
    // Take the low 7 bits of the current value.
    let byte = remaining & 0x7f;
    // Shift off those 7 bits.  Use a floor division so the result is an
    // integer even when JS bitwise ops would produce it for free here.
    remaining = Math.floor(remaining / 0x80);
    if (remaining !== 0) {
      // High bit set means "more bytes follow".
      byte |= 0x80;
    }
    out.push(byte);
  } while (remaining !== 0);

  return out;
}

/**
 * Decodes an unsigned LEB128 integer from a sequence of byte values.
 *
 * The input is an array of numbers in the 0-255 range, not a Buffer or
 * string.  This keeps the library dependency-free and lets the caller choose
 * the I/O representation.
 *
 * We guard against a missing continuation terminator (a runaway encoding that
 * never clears the high bit) because a truncated or corrupt stream would
 * otherwise loop or produce a silently wrong value.
 *
 * @param {number[]|Uint8Array} bytes - LEB128-encoded bytes.
 * @returns {{value: number, bytesConsumed: number}} The decoded value and how
 *   many input bytes were consumed.
 * @throws {RangeError} If the input is empty, contains an out-of-range byte,
 *   never terminates, or exceeds the safe-integer range.
 */
export function decodeUnsignedLeb128(bytes) {
  const len = bytes.length;
  if (len === 0) {
    throw new RangeError('decodeUnsignedLeb128 received an empty byte array');
  }

  let result = 0;
  let shift = 0;
  let index = 0;

  while (true) {
    if (index >= len) {
      // We entered this loop because the previous byte had the continuation
      // bit set, but no more bytes are available.  The encoding is truncated.
      throw new RangeError('decodeUnsignedLeb128: stream ended before terminator byte');
    }

    const byte = bytes[index];
    if (typeof byte !== 'number' || !Number.isInteger(byte) || byte < 0 || byte > 255) {
      throw new RangeError(
        'decodeUnsignedLeb128: every byte must be an integer in [0, 255]; got ' + String(byte)
      );
    }

    const payload = byte & 0x7f;
    // `result` is always non-negative here, so addition is safe and exact
    // as long as the running value stays within the safe-integer range.
    result += payload * Math.pow(2, shift);

    if (result > Number.MAX_SAFE_INTEGER) {
      // This is the awkward edge: beyond 2^53-1 JS loses integer precision,
      // and we refuse to return a value we cannot represent exactly.
      throw new RangeError(
        'decodeUnsignedLeb128: decoded value exceeds Number.MAX_SAFE_INTEGER'
      );
    }

    index += 1;

    // High bit clear means this was the final byte.
    if ((byte & 0x80) === 0) {
      return { value: result, bytesConsumed: index };
    }

    shift += 7;
  }
}
