#!/usr/bin/env bash
# Creates voice-engine/.venv with pinned versions and downloads the models the voices use.
#
#   ./setup.sh            # venv + models
#   ./setup.sh --no-models
#
# Needs: uv (brew install uv), Python 3.11 (brew install python@3.11), ffmpeg (brew install ffmpeg).
set -euo pipefail
cd "$(dirname "$0")"

PY="${PYTHON:-/opt/homebrew/bin/python3.11}"
command -v uv >/dev/null || { echo "uv is required: brew install uv" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg is required: brew install ffmpeg" >&2; exit 1; }
[ -x "$PY" ] || { echo "Python 3.11 not found at $PY (set PYTHON=...)" >&2; exit 1; }

if [ ! -x .venv/bin/python ]; then
  uv venv .venv --python "$PY"
fi
uv pip install --python .venv/bin/python -r requirements.lock.txt
# mlx-whisper declares torch, which it only needs to convert checkpoints; install it without.
uv pip install --python .venv/bin/python --no-deps "mlx-whisper==0.4.3"

if [ "${1:-}" != "--no-models" ]; then
  HF=.venv/bin/hf
  # Pinned revisions: the same ones voices/registry.json names.
  "$HF" download mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16 --revision a6eb4f68e4b056f1215157bb696209bc82a6db48
  "$HF" download mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-bf16 --revision 52f4770fd9726457eae3d3b6aa92047a25a10776
  "$HF" download mlx-community/VoxCPM2-bf16 --revision a7fb80d9056983135a54ca3f71fcc5a637ccddf5
  "$HF" download mlx-community/Kokoro-82M-bf16 --revision a71e4d38b236d968966a2002c4c895dbd12b1c3c \
    config.json kokoro-v1_0.safetensors voices/if_sara.safetensors voices/im_nicola.safetensors
  "$HF" download mlx-community/whisper-large-v3-turbo --revision a4aaeec0636e6fef84abdcbe3544cb2bf7e9f6fb
  # Only to design new voices (tools/bakeoff.py qwen-design):
  if [ "${WITH_DESIGN:-0}" = "1" ]; then
    "$HF" download mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16 --revision 7d3824abff87e49756bb0f83fb5411de75d160c4
  fi
fi

.venv/bin/python -m pytest tests -q
echo "voice engine ready: DATABASE_URL=... .venv/bin/python worker.py"
