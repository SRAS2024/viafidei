#!/bin/sh
# Installs the ONNX runtime the content translator needs (scripts/translate-content.ts)
# under .cache/translation-runtime — outside the app's node_modules, so `npm ci`
# never prunes it and the web image never carries it. Run once on the
# translator host (the Mac worker host); safe to re-run.
set -eu
cd "$(dirname "$0")/.."
DIR="${TRANSLATION_RUNTIME_DIR:-.cache/translation-runtime}"
# Keep in step with ORT_VERSION in src/lib/translation/engine/ort.ts.
VERSION="1.29.0"
mkdir -p "$DIR"
if [ ! -f "$DIR/package.json" ]; then
  printf '{ "name": "viafidei-translation-runtime", "private": true }\n' > "$DIR/package.json"
fi
# On Linux onnxruntime-node would otherwise download ~600 MB of CUDA libraries;
# the engine only uses the CPU build that ships inside the package.
npm_config_onnxruntime_node_install=skip \
  npm install --prefix "$DIR" --no-audit --no-fund "onnxruntime-node@$VERSION"
echo "onnxruntime-node $VERSION installed in $DIR"
