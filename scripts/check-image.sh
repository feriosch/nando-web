#!/usr/bin/env bash
# Runs the built image and checks how its nginx serves the app and the kanji model folder.
#
#   scripts/check-image.sh <image>
#
# The model folder is a small stand-in mounted over public/models/kanji/, so this works
# whether or not the real model has been merged.
set -euo pipefail
image=$1
port=8099
base="http://127.0.0.1:$port"

models=$(mktemp -d)
printf '{\n  "version": "v-test"\n}\n' > "$models/version.json"
printf '%50000s' '' > "$models/kanji.tflite"  # 50 KB that gzip can shrink; no pipe, so pipefail can't trip
chmod 755 "$models" && chmod 644 "$models"/*  # mktemp makes it 700, but nginx's worker is another user
container=$(docker run -d -p "127.0.0.1:$port:8080" -v "$models:/usr/share/nginx/html/models/kanji:ro" "$image")
trap 'docker rm -f "$container" >/dev/null; rm -rf "$models"' EXIT

for _ in $(seq 30); do curl -fs -o /dev/null "$base/" && break; sleep 1; done

failures=0
# check <description> <expected> <actual>
check() {
  if [[ "$3" == *"$2"* ]]; then echo "ok    $1"; else echo "FAIL  $1: expected '$2', got '$3'"; failures=$((failures + 1)); fi
}
status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
header() { local name=$1; shift; curl -s -o /dev/null -D - "$@" | tr -d '\r' | grep -i "^$name:" || true; }

check "a client route falls back to the app" "200" "$(status "$base/settings")"
check "a missing asset is a real 404" "404" "$(status "$base/assets/missing.js")"
check "a missing model file is a real 404" "404" "$(status "$base/models/kanji/missing.tflite")"
check "version.json is always revalidated" "no-cache" "$(header Cache-Control "$base/models/kanji/version.json")"
check "a versioned model file is cached for good" "immutable" "$(header Cache-Control "$base/models/kanji/kanji.tflite?v=v-test")"
check "an unversioned model file is revalidated" "no-cache" "$(header Cache-Control "$base/models/kanji/kanji.tflite")"
check "the model is gzipped" "gzip" "$(header Content-Encoding -H 'Accept-Encoding: gzip' "$base/models/kanji/kanji.tflite?v=v-test")"

exit "$failures"
