"""
Audio post-processing shared by the engine, the worker and the bake-off.

Every clip leaves here the same way, so clips sound alike next to each other:
  - mono, 24 kHz;
  - about 40 ms of silence before the first sound and 250 ms after the last;
  - loudness-normalised to -18 LUFS (ITU-R BS.1770 via pyloudnorm), true peak at or
    below -1.5 dBTP (4x oversampled peak limiter);
  - AAC-LC in an MP4 container (.m4a, faststart), about 48 kbps, encoded by macOS's
    own AudioToolbox encoder through ffmpeg (aac_at), falling back to ffmpeg's aac.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass

import numpy as np
import pyloudnorm
import soundfile as sf
from scipy.ndimage import minimum_filter1d
from scipy.signal import resample_poly

TARGET_SR = 24000
TARGET_LUFS = -18.0
TRUE_PEAK_DBTP = -1.5
LEAD_S = 0.040
TAIL_S = 0.250
BITRATE = "48k"

FFMPEG = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
FFPROBE = shutil.which("ffprobe") or "/opt/homebrew/bin/ffprobe"


def to_mono(audio) -> np.ndarray:
    """Any array-like (mlx, numpy, 1-D or 2-D) as float32 mono."""
    x = np.asarray(audio, dtype=np.float32)
    if x.ndim == 2:
        # (channels, samples) or (samples, channels): average the short axis.
        x = x.mean(axis=0 if x.shape[0] < x.shape[1] else 1)
    return np.nan_to_num(x.reshape(-1)).astype(np.float32)


def resample(audio: np.ndarray, sr: int, target: int = TARGET_SR) -> np.ndarray:
    if sr == target:
        return audio.astype(np.float32)
    g = np.gcd(int(sr), int(target))
    return resample_poly(audio, target // g, sr // g).astype(np.float32)


# --------------------------------------------------------------------------- #
# Speech activity                                                             #
# --------------------------------------------------------------------------- #

FRAME_S = 0.020
HOP_S = 0.010


def frame_db(audio: np.ndarray, sr: int) -> np.ndarray:
    """RMS level per 20 ms frame (10 ms hop), in dBFS."""
    n = int(FRAME_S * sr)
    h = int(HOP_S * sr)
    if len(audio) < n:
        audio = np.pad(audio, (0, n - len(audio)))
    count = 1 + (len(audio) - n) // h
    idx = np.arange(n)[None, :] + h * np.arange(count)[:, None]
    frames = audio[idx]
    rms = np.sqrt(np.mean(frames.astype(np.float64) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(rms + 1e-12)


def speech_threshold(db: np.ndarray) -> float:
    """Level above which a frame counts as sound: 38 dB under the loud frames, floor -62 dBFS."""
    if len(db) == 0:
        return -62.0
    ref = float(np.percentile(db, 95))
    return max(ref - 38.0, -62.0)


def speech_mask(audio: np.ndarray, sr: int) -> tuple[np.ndarray, float]:
    """Per-frame sound/silence, ignoring blips shorter than 40 ms."""
    db = frame_db(audio, sr)
    thr = speech_threshold(db)
    mask = db > thr
    # Remove isolated blips (clicks) shorter than 4 frames.
    out = mask.copy()
    i = 0
    while i < len(mask):
        if mask[i]:
            j = i
            while j < len(mask) and mask[j]:
                j += 1
            if j - i < 4:
                out[i:j] = False
            i = j
        else:
            i += 1
    return out, thr


def speech_bounds(audio: np.ndarray, sr: int) -> tuple[int, int]:
    """Sample index of the first and last sound (end exclusive); (0, 0) for silence."""
    mask, _ = speech_mask(audio, sr)
    on = np.flatnonzero(mask)
    if len(on) == 0:
        return 0, 0
    h = int(HOP_S * sr)
    n = int(FRAME_S * sr)
    start = int(on[0] * h)
    end = min(len(audio), int(on[-1] * h + n))
    return start, end


def silences(audio: np.ndarray, sr: int, min_s: float = 0.25) -> list[tuple[float, float]]:
    """Silent stretches inside the speech (start, length) in seconds, longest first."""
    mask, _ = speech_mask(audio, sr)
    on = np.flatnonzero(mask)
    if len(on) == 0:
        return []
    out = []
    i = on[0]
    last = on[-1]
    while i <= last:
        if not mask[i]:
            j = i
            while j <= last and not mask[j]:
                j += 1
            length = (j - i) * HOP_S
            if length >= min_s:
                out.append((i * HOP_S, length))
            i = j
        else:
            i += 1
    return sorted(out, key=lambda s: -s[1])


# --------------------------------------------------------------------------- #
# Trim, loudness, limiter                                                     #
# --------------------------------------------------------------------------- #


def _fade(n: int, rising: bool) -> np.ndarray:
    t = np.linspace(0, np.pi / 2, n, dtype=np.float32)
    w = np.sin(t) ** 2
    return w if rising else w[::-1]


def trim(audio: np.ndarray, sr: int, lead: float = LEAD_S, tail: float = TAIL_S) -> np.ndarray:
    """Keeps `lead` s before the first sound and `tail` s after the last (padding with zeros)."""
    start, end = speech_bounds(audio, sr)
    if end <= start:
        return np.zeros(int((lead + tail) * sr), dtype=np.float32)
    a = max(0, start - int(lead * sr))
    b = min(len(audio), end + int(tail * sr))
    out = audio[a:b].astype(np.float32).copy()
    pad_front = int(lead * sr) - (start - a)
    pad_back = int(tail * sr) - (b - end)
    if pad_front > 0:
        out = np.concatenate([np.zeros(pad_front, np.float32), out])
    if pad_back > 0:
        out = np.concatenate([out, np.zeros(pad_back, np.float32)])
    # Gentle fades over the silent margins, so no click at either end.
    fi = int(0.02 * sr)
    fo = int(0.12 * sr)
    if len(out) > fi + fo:
        out[:fi] *= _fade(fi, True)
        out[-fo:] *= _fade(fo, False)
    return out


def loudness(audio: np.ndarray, sr: int) -> float:
    """Integrated loudness in LUFS (BS.1770); -inf for silence."""
    meter = pyloudnorm.Meter(sr)
    x = audio
    if len(x) < int(0.5 * sr):  # the meter needs at least one 400 ms block
        x = np.pad(x, (0, int(0.5 * sr) - len(x)))
    try:
        return float(meter.integrated_loudness(x.astype(np.float64)))
    except Exception:
        return float("-inf")


def true_peak_db(audio: np.ndarray, sr: int) -> float:
    up = resample_poly(audio.astype(np.float64), 4, 1)
    peak = float(np.max(np.abs(up))) if len(up) else 0.0
    return 20 * np.log10(peak + 1e-12)


def limit(audio: np.ndarray, sr: int, ceiling_db: float = TRUE_PEAK_DBTP) -> np.ndarray:
    """Look-ahead peak limiter on 4x-oversampled peaks; transparent when nothing exceeds."""
    ceiling = 10 ** (ceiling_db / 20)
    x = audio.astype(np.float64)
    up = resample_poly(x, 4, 1)
    peaks = np.abs(up)[: 4 * len(x)].reshape(-1, 4).max(axis=1)
    if len(peaks) < len(x):
        peaks = np.pad(peaks, (0, len(x) - len(peaks)), mode="edge")
    gain = np.minimum(1.0, ceiling / np.maximum(peaks, 1e-12))
    if gain.min() >= 1.0:
        return audio
    win = max(1, int(0.005 * sr))
    g = minimum_filter1d(gain, size=2 * win + 1)
    g = np.convolve(g, np.ones(win) / win, mode="same")
    return (x * np.minimum(g, 1.0)).astype(np.float32)


def normalize_loudness(
    audio: np.ndarray, sr: int, target: float = TARGET_LUFS, tp: float = TRUE_PEAK_DBTP
) -> np.ndarray:
    lufs = loudness(audio, sr)
    if not np.isfinite(lufs):
        return audio
    out = (audio * 10 ** ((target - lufs) / 20)).astype(np.float32)
    for _ in range(3):
        if true_peak_db(out, sr) <= tp:
            break
        out = limit(out, sr, tp - 0.2)
    return out


@dataclass
class Finished:
    audio: np.ndarray  # 24 kHz mono, trimmed, normalised
    sr: int
    duration_s: float
    lufs: float
    true_peak: float


def change_tempo(audio: np.ndarray, sr: int, tempo: float) -> np.ndarray:
    """Speech sped up or slowed down without changing its pitch (ffmpeg's atempo).

    Some locked voices pray slower or faster than a person does (the French ones at about
    three quarters of a natural pace); their registry entry carries a `tempo` that brings
    them back to a normal human pace. Factors stay close to 1, where atempo is clean.
    """
    if abs(tempo - 1.0) < 1e-3:
        return audio
    tempo = min(2.0, max(0.5, float(tempo)))
    proc = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "pipe:0",
            "-filter:a", f"atempo={tempo:.4f}",
            "-f", "f32le", "-ar", str(sr), "-ac", "1", "pipe:1",
        ],
        input=np.ascontiguousarray(audio, dtype=np.float32).tobytes(),
        capture_output=True,
        check=True,
    )
    return np.frombuffer(proc.stdout, dtype=np.float32).copy()


def finish(audio, sr: int, tempo: float = 1.0) -> Finished:
    """Model output -> the clip as stored: mono 24 kHz, at the voice's tempo, trimmed,
    loudness-normalised."""
    x = resample(to_mono(audio), sr, TARGET_SR)
    x = change_tempo(x, TARGET_SR, tempo)
    x = trim(x, TARGET_SR)
    x = normalize_loudness(x, TARGET_SR)
    return Finished(
        audio=x,
        sr=TARGET_SR,
        duration_s=len(x) / TARGET_SR,
        lufs=loudness(x, TARGET_SR),
        true_peak=true_peak_db(x, TARGET_SR),
    )


# --------------------------------------------------------------------------- #
# Encoding and probing                                                        #
# --------------------------------------------------------------------------- #

_AAC_ENCODER: str | None = None


def _aac_encoder() -> str:
    global _AAC_ENCODER
    if _AAC_ENCODER is None:
        try:
            out = subprocess.run(
                [FFMPEG, "-hide_banner", "-encoders"], capture_output=True, text=True, timeout=20
            ).stdout
        except Exception:
            out = ""
        _AAC_ENCODER = "aac_at" if " aac_at " in out else "aac"
    return _AAC_ENCODER


def encode_m4a(audio: np.ndarray, sr: int, path: str | None = None, bitrate: str = BITRATE) -> bytes:
    """AAC-LC .m4a (faststart, mono). Returns the bytes; also writes `path` when given."""
    with tempfile.TemporaryDirectory(prefix="ve-enc-") as tmp:
        wav = os.path.join(tmp, "in.wav")
        out = os.path.join(tmp, "out.m4a")
        sf.write(wav, audio.astype(np.float32), sr, subtype="FLOAT")
        enc = _aac_encoder()
        cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", wav, "-ac", "1", "-c:a", enc]
        if enc == "aac_at":
            cmd += ["-aac_at_mode", "cbr", "-b:a", bitrate]
        else:
            cmd += ["-b:a", bitrate]
        cmd += ["-movflags", "+faststart", "-f", "mp4", out]
        subprocess.run(cmd, check=True, capture_output=True, timeout=120)
        data = open(out, "rb").read()
    if path:
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
    return data


def probe(data: bytes) -> dict:
    """ffprobe of encoded audio bytes: codec, profile, sample rate, channels, duration."""
    with tempfile.NamedTemporaryFile(suffix=".m4a") as f:
        f.write(data)
        f.flush()
        out = subprocess.run(
            [FFPROBE, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", f.name],
            capture_output=True,
            text=True,
            timeout=30,
            check=True,
        ).stdout
    info = json.loads(out)
    s = next((st for st in info.get("streams", []) if st.get("codec_type") == "audio"), {})
    fmt = info.get("format", {})
    return {
        "codec": s.get("codec_name"),
        "profile": s.get("profile"),
        "sample_rate": int(s.get("sample_rate", 0) or 0),
        "channels": s.get("channels"),
        "duration_s": float(fmt.get("duration", s.get("duration", 0)) or 0),
        "bit_rate": int(fmt.get("bit_rate", 0) or 0),
        "format": fmt.get("format_name"),
    }


def decode(data: bytes, sr: int = TARGET_SR) -> np.ndarray:
    """Encoded audio bytes -> float32 mono at `sr` (to check a stored clip really plays)."""
    with tempfile.NamedTemporaryFile(suffix=".m4a") as f:
        f.write(data)
        f.flush()
        raw = subprocess.run(
            [FFMPEG, "-v", "error", "-i", f.name, "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"],
            capture_output=True,
            timeout=60,
            check=True,
        ).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def write_flac(audio: np.ndarray, sr: int, path: str) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    sf.write(path, np.clip(audio, -1, 1).astype(np.float32), sr, format="FLAC", subtype="PCM_16")


def read_audio(path: str) -> tuple[np.ndarray, int]:
    x, sr = sf.read(path, dtype="float32", always_2d=False)
    return to_mono(x), int(sr)
