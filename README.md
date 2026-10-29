# leb128-unsigned-utils

Encodes and decodes unsigned little-endian base 128 (LEB128) variable-length integers, the compact format used by WebAssembly and DWARF for indices, offsets, and lengths.

```js
import { encodeUnsignedLeb128, decodeUnsignedLeb128 } from 'leb128-unsigned-utils';

const bytes = encodeUnsignedLeb128(624485); // [0xe5, 0x8e, 0x26]
const { value, bytesConsumed } = decodeUnsignedLeb128(bytes); // 624485, 3
```

## Why this exists

WebAssembly and DWARF both need a compact, self-delimiting encoding for unsigned integers: small values take one byte, large values take only as many as needed. LEB128 is the standard, but it is easy to get the continuation-bit and shift logic subtly wrong. This library exists to provide a focused, dependency-free implementation that handles the boundary cases correctly.

The trade-off: this library operates on JavaScript `number` values, not `bigint`. That covers every realistic WebAssembly index or DWARF offset (the safe-integer range goes up to 2^53-1), keeps the API simple, and avoids pulling in arbitrary-precision arithmetic. If you need to encode values above `Number.MAX_SAFE_INTEGER`, use a bigint-based codec instead.

## Edge cases worth knowing

- `encodeUnsignedLeb128` throws a `RangeError` for negative values, non-integers, and values outside the safe-integer range.
- `decodeUnsignedLeb128` throws if the byte stream is truncated (every byte has the continuation bit set but no terminator arrives) or if a single byte decodes to a value above `Number.MAX_SAFE_INTEGER`.
- `decodeUnsignedLeb128` returns `{ value, bytesConsumed }` rather than just the number, because LEB128 integers are usually embedded in a larger stream and the caller needs to know where the next field begins.
- The encoder produces a plain `number[]` of byte values (0-255), not a `Buffer` or `Uint8Array`, so the library stays dependency-free and runtime-agnostic. The decoder accepts both `number[]` and `Uint8Array`.
