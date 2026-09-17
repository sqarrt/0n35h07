#!/usr/bin/env python3
"""Cut a region out of a parity frame and enlarge it (nearest neighbour) for close-up comparisons in reports.

Usage: python3 tools/parity/crop.py <frame.png> <out.png> <x> <y> <width> <height> [<scale>]

Pure Python (reuses measure.read_png; writes an 8-bit RGB PNG), no Pillow needed.
"""
import struct
import sys
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from measure import read_png  # noqa: E402

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
RGB_COLOR_TYPE = 2
BIT_DEPTH = 8
RGB = 3
NO_FILTER = b"\x00"
DEFAULT_SCALE = 1


def chunk(kind: bytes, payload: bytes) -> bytes:
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))


def write_png(path, width, height, rows):
    header = struct.pack(">IIBBBBB", width, height, BIT_DEPTH, RGB_COLOR_TYPE, 0, 0, 0)
    raw = b"".join(NO_FILTER + bytes(row) for row in rows)
    Path(path).write_bytes(PNG_SIGNATURE + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw))
                           + chunk(b"IEND", b""))


def crop(source, out, x, y, width, height, scale=DEFAULT_SCALE):
    bpp, rows = read_png(source)
    result = []
    for row in rows[y:y + height]:
        pixels = [row[(x + i) * bpp:(x + i) * bpp + RGB] for i in range(width)]
        line = bytearray()
        for pixel in pixels:
            line += bytes(pixel) * scale
        result.extend([line] * scale)
    write_png(out, width * scale, height * scale, result)


def main():
    args = sys.argv[1:]
    source, out = args[0], args[1]
    x, y, width, height = (int(v) for v in args[2:6])
    scale = int(args[6]) if len(args) > 6 else DEFAULT_SCALE
    crop(source, out, x, y, width, height, scale)
    print(out)


if __name__ == "__main__":
    main()
