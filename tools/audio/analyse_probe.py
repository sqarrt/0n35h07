#!/usr/bin/env python3
"""Analyse a tools/audio_probe.gd recording: where the kicks slot's next-bar switch lands and the crossfade curve.

The recording is modelled as wa * A + wb * B + wbass * bass, where A is the first kick stem looping from the start
offset, B the second kick stem starting at a candidate boundary and bass the bass stem. The start offset comes from
cross-correlating the recording's opening with A + bass; per short window around the expected 8-second boundary a
least-squares fit gives the weights, so the switch position and the fade shape can be read off.

    python3 tools/audio/analyse_probe.py <recording.wav> <kicks A id> <kicks B id> [bass id] [switch request s]
"""
import array
import json
import subprocess
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MUSIC_DIR = ROOT / "assets/audio/music"
DEFAULT_BASS = "bass/kutting"
DEFAULT_REQUEST_S = 4.0
LOOP_SECONDS = 8.0
PCM16_SCALE = 32768.0
OFFSET_SEARCH_S = 0.5            # the stems start within this long after recording begins
CORRELATE_S = 0.25               # opening span used to find the start offset (after the first transient)
CORRELATE_STRIDE = 2             # samples skipped while correlating
COARSE_LAG_STEP = 16             # coarse pass over every 16th lag, then a fine pass around the best one
WINDOW_S = 0.005                 # fit window
SPAN_S = 0.25                    # analysed span on each side of the boundary
MIN_ENERGY = 1e-9


def read_wav(path: Path) -> tuple[list[float], int]:
    with wave.open(str(path)) as wav:
        rate, channels, width = wav.getframerate(), wav.getnchannels(), wav.getsampwidth()
        if width != 2:
            raise SystemExit(f"expected 16-bit PCM, got {width * 8}-bit")
        data = array.array("h")
        data.frombytes(wav.readframes(wav.getnframes()))
    mono = [sum(data[i + c] for c in range(channels)) / channels / PCM16_SCALE for i in range(0, len(data), channels)]
    return mono, rate


def decode(stem_id: str, rate: int) -> list[float]:
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(MUSIC_DIR / f"{stem_id}.ogg"), "-ac", "1",
                          "-ar", str(rate), "-f", "f32le", "-acodec", "pcm_f32le", "-"],
                         capture_output=True, check=True).stdout
    samples = array.array("f")
    samples.frombytes(pcm)
    return list(samples)


def looped(source: list[float], index: int) -> float:
    return source[index % len(source)] if index >= 0 else 0.0


def start_offset(recording: list[float], a: list[float], bass: list[float], rate: int) -> int:
    span = int(CORRELATE_S * rate)
    reference = [a[i] + bass[i] for i in range(span)]

    def best_lag(lags) -> int:
        return max(lags, key=lambda lag: sum(recording[lag + i] * reference[i] for i in range(0, span, CORRELATE_STRIDE)))

    coarse = best_lag(range(0, int(OFFSET_SEARCH_S * rate), COARSE_LAG_STEP))
    return best_lag(range(max(0, coarse - COARSE_LAG_STEP), coarse + COARSE_LAG_STEP + 1))


def solve3(m: list[list[float]], v: list[float]) -> list[float]:
    """Solve a 3x3 system by Cramer's rule (zeros when singular)."""
    def det(x):
        return (x[0][0] * (x[1][1] * x[2][2] - x[1][2] * x[2][1]) - x[0][1] * (x[1][0] * x[2][2] - x[1][2] * x[2][0])
                + x[0][2] * (x[1][0] * x[2][1] - x[1][1] * x[2][0]))
    d = det(m)
    if abs(d) < MIN_ENERGY:
        return [0.0, 0.0, 0.0]
    out = []
    for col in range(3):
        mc = [row[:] for row in m]
        for r in range(3):
            mc[r][col] = v[r]
        out.append(det(mc) / d)
    return out


def main() -> None:
    wav, a_id, b_id = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
    bass_id = sys.argv[4] if len(sys.argv) > 4 else DEFAULT_BASS
    request_s = float(sys.argv[5]) if len(sys.argv) > 5 else DEFAULT_REQUEST_S
    recording, rate = read_wav(wav)
    a, b, bass = decode(a_id, rate), decode(b_id, rate), decode(bass_id, rate)
    loop = int(LOOP_SECONDS * rate)
    offset = start_offset(recording, a, bass, rate)
    boundary = offset + loop * (int(request_s // LOOP_SECONDS) + 1)
    window, span = int(WINDOW_S * rate), int(SPAN_S * rate)
    rows = []
    for start in range(boundary - span, boundary + span, window):
        basis = [[looped(a, i - offset) for i in range(start, start + window)],
                 [looped(b, i - boundary) if i >= boundary else 0.0 for i in range(start, start + window)],
                 [looped(bass, i - offset) for i in range(start, start + window)]]
        target = recording[start:start + window]
        gram = [[sum(p * q for p, q in zip(basis[r], basis[c])) for c in range(3)] for r in range(3)]
        rhs = [sum(p * t for p, t in zip(basis[r], target)) for r in range(3)]
        wa, wb, wbass = solve3(gram, rhs)
        fit = [wa * x + wb * y + wbass * z for x, y, z in zip(*basis)]
        energy = sum(t * t for t in target)
        residual = sum((t - f) ** 2 for t, f in zip(target, fit)) / energy if energy > MIN_ENERGY else 0.0
        rows.append({"ms": round((start - boundary) / rate * 1000, 1), "a": round(wa, 3), "b": round(wb, 3),
                     "bass": round(wbass, 3), "residual": round(residual, 4)})
    print(json.dumps({"rate": rate, "offset_samples": offset, "boundary_samples": boundary, "windows": rows}, indent=1))


if __name__ == "__main__":
    main()
