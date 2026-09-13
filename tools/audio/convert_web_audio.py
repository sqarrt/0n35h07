#!/usr/bin/env python3
"""Convert the web game's audio (Opus, which Godot cannot import) into Ogg Vorbis assets for the Godot port.

Music stems get the web loudness normalisation baked in (web WebAudioMusicEngine normGainFor: RMS toward 0.10,
multiplier clamped to 0.25..4 and the peak kept under 0.9, measured on the decoded PCM of every channel) and import
as 8-second loops on a 120 bpm / 16-beat grid for AudioStreamInteractive bar transitions. SFX keep their level; only
the shield and ghost loops loop. A manifest records the web stem order (from the music oracle fixture), the gains and
the measured loudness.

    python3 tools/audio/convert_web_audio.py
"""
import array
import json
import math
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WEB_MUSIC = ROOT / "web-reference/src/assets/music"
WEB_SFX = ROOT / "web-reference/src/assets/sfx"
ORACLE = ROOT / "tests/fixtures/music_oracle.json"
OUT_MUSIC = ROOT / "assets/audio/music"
OUT_SFX = ROOT / "assets/audio/sfx"
MANIFEST = OUT_MUSIC / "manifest.json"

SOURCE_EXT = ".opus"
TARGET_EXT = ".ogg"
VORBIS_QUALITY = "6"
SAMPLE_FORMAT = "f32le"
ROLES = ["bass", "kicks", "lead", "sfx"]
NORM_TARGET_RMS = 0.10
NORM_MIN_GAIN = 0.25
NORM_MAX_GAIN = 4.0
NORM_PEAK_CEILING = 0.9
LOOP_SECONDS = 8.0
LOOP_BPM = 120
LOOP_BEATS = 16
BAR_BEATS = 4
LOOPING_SFX = {"shield_loop", "ghost_loop"}
GAIN_DIGITS = 6


def decode(source: Path) -> array.array:
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(source), "-f", SAMPLE_FORMAT, "-acodec", "pcm_f32le", "-"],
                         capture_output=True, check=True).stdout
    samples = array.array("f")
    samples.frombytes(pcm)
    return samples


def loudness(samples: array.array) -> tuple[float, float]:
    """RMS and peak over every channel (web analyzeLoudness)."""
    if not samples:
        return 0.0, 0.0
    return math.sqrt(sum(x * x for x in samples) / len(samples)), max(abs(x) for x in samples)


def norm_gain(rms: float, peak: float) -> float:
    """web normGainFor: toward the target RMS, but the peak-safe cap wins."""
    if rms <= 0:
        return 1.0
    gain = min(NORM_MAX_GAIN, max(NORM_MIN_GAIN, NORM_TARGET_RMS / rms))
    if peak > 0 and peak * gain > NORM_PEAK_CEILING:
        gain = NORM_PEAK_CEILING / peak
    return gain


def encode(source: Path, target: Path, gain: float = 1.0) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(source), "-af", f"volume={gain:.{GAIN_DIGITS}f}",
                    "-c:a", "libvorbis", "-q:a", VORBIS_QUALITY, str(target)], check=True)


def write_import(target: Path, loop: bool, bpm: int = 0, beats: int = 0) -> None:
    """Import parameters Godot keeps when it (re)imports the file."""
    target.with_name(target.name + ".import").write_text(
        '[remap]\n\nimporter="oggvorbisstr"\ntype="AudioStreamOggVorbis"\n\n[params]\n\n'
        f"loop={str(loop).lower()}\nloop_offset=0\nbpm={bpm}\nbeat_count={beats}\nbar_beats={BAR_BEATS}\n")


def main() -> None:
    oracle_order = json.loads(ORACLE.read_text())["library"]
    manifest = {"loop_seconds": LOOP_SECONDS, "bpm": LOOP_BPM, "beat_count": LOOP_BEATS, "roles": {}, "gains": {},
                "loudness": {}, "sfx": [], "sfx_loops": sorted(LOOPING_SFX)}
    for role in ROLES:
        names = sorted(p.stem for p in (WEB_MUSIC / role).glob(f"*{SOURCE_EXT}"))
        ids = [f"{role}/{name}" for name in names]
        if sorted(oracle_order[role]) != ids:
            raise SystemExit(f"{role}: the stems differ from the oracle fixture; re-run parity-oracle-music.mjs")
        manifest["roles"][role] = oracle_order[role]   # the web localeCompare order
        for name in names:
            source = WEB_MUSIC / role / f"{name}{SOURCE_EXT}"
            rms, peak = loudness(decode(source))
            gain = norm_gain(rms, peak)
            target = OUT_MUSIC / role / f"{name}{TARGET_EXT}"
            encode(source, target, gain)
            write_import(target, True, LOOP_BPM, LOOP_BEATS)
            stem_id = f"{role}/{name}"
            manifest["gains"][stem_id] = round(gain, GAIN_DIGITS)
            manifest["loudness"][stem_id] = {"rms": round(rms, GAIN_DIGITS), "peak": round(peak, GAIN_DIGITS)}
            print(f"music {stem_id}: gain {gain:.3f}")
    for source in sorted(WEB_SFX.glob(f"*{SOURCE_EXT}")):
        target = OUT_SFX / f"{source.stem}{TARGET_EXT}"
        encode(source, target)
        write_import(target, source.stem in LOOPING_SFX)
        manifest["sfx"].append(source.stem)
        print(f"sfx {source.stem}")
    MANIFEST.write_text(json.dumps(manifest, indent=1) + "\n")
    print(f"MANIFEST {MANIFEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
