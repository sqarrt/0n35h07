#!/usr/bin/env python3
"""Measure calibration pixels on parity frames (1280x720, Arena, camera on spawn 0 looking down -Z).

Usage: python3 tools/parity/measure.py <frame.png> [<frame.png> ...]

Fills (sky, floor, walls) report the median of a small window so single grid lines and noise don't skew them;
the grid line reports the brightest pixel across a window that straddles the centre vertical line.
Pure Python (zlib + PNG unfiltering), no Pillow needed.
"""
import statistics
import struct
import sys
import zlib

PNG_SIGNATURE_LEN = 8
CHUNK_OVERHEAD = 12
CHANNELS_BY_COLOR_TYPE = {2: 3, 6: 4}   # RGB, RGBA (8-bit)
FILL_RADIUS = 4                          # 9x9 median window
FILL_POINTS = {
    "sky": (640, 200),
    "floor": (700, 600),
    "wall_left": (100, 360),
    "wall_right": (1180, 360),
}
LINE_WINDOW = (range(630, 651), 600)     # x span across the centre vertical grid line, at row y (above HUD bars)


def read_png(path):
    data = open(path, "rb").read()
    pos, idat = PNG_SIGNATURE_LEN, b""
    width = height = color_type = 0
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        pos += CHUNK_OVERHEAD + length
        if kind == b"IHDR":
            width, height, _depth, color_type = struct.unpack(">IIBB", chunk[:10])
        elif kind == b"IDAT":
            idat += chunk
        elif kind == b"IEND":
            break
    raw = zlib.decompress(idat)
    bpp = CHANNELS_BY_COLOR_TYPE[color_type]
    stride = width * bpp
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(height):
        filt = raw[i]
        i += 1
        line = bytearray(raw[i:i + stride])
        i += stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if filt == 1:
                line[x] = (line[x] + a) & 255
            elif filt == 2:
                line[x] = (line[x] + b) & 255
            elif filt == 3:
                line[x] = (line[x] + ((a + b) >> 1)) & 255
            elif filt == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else (b if pb <= pc else c))) & 255
        rows.append(line)
        prev = line
    return bpp, rows


def hex_color(rgb):
    return "#%02x%02x%02x" % tuple(rgb)


def measure(path):
    bpp, rows = read_png(path)

    def pixel(x, y):
        return tuple(rows[y][x * bpp:x * bpp + 3])

    out = {}
    for name, (cx, cy) in FILL_POINTS.items():
        window = [pixel(x, y) for y in range(cy - FILL_RADIUS, cy + FILL_RADIUS + 1)
                  for x in range(cx - FILL_RADIUS, cx + FILL_RADIUS + 1)]
        out[name] = hex_color(int(statistics.median(p[ch] for p in window)) for ch in range(3))
    xs, y = LINE_WINDOW
    out["grid_line"] = hex_color(max((pixel(x, y) for x in xs), key=sum))
    return out


def main():
    for path in sys.argv[1:]:
        print(path, measure(path))


if __name__ == "__main__":
    main()
