#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# Box Office War — Linux/CI Android toolchain bootstrap
#
#   bash apk/tools/setup-toolchain.sh          # install JDK 21 + SDK 36 + apk deps
#   source apk/tools/setup-toolchain.sh env    # only export JAVA_HOME/ANDROID_HOME
#
# The Mac pipeline in apk/RELEASE-PIPELINE.md assumes Homebrew paths; this
# script is the Debian/Linux equivalent so a release can be built on a clean
# box (or CI runner) with nothing but root + network access.
#
# Installs: openjdk-21-jdk-headless, Android cmdline-tools, platform-tools,
#           platforms;android-36, build-tools;36.0.0, and apk/node_modules.
# Never writes the keystore or keystore.properties — signing stays in the repo.
# ════════════════════════════════════════════════════════════════════
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/android-sdk}"
CMDLINE_VERSION="${CMDLINE_VERSION:-13114758}"
BUILD_TOOLS="${BUILD_TOOLS:-36.0.0}"
PLATFORM="${PLATFORM:-android-36}"

export_java_home() {
  local jh=""
  # Debian trixie installs /usr/lib/jvm/java-21-openjdk-<arch> with a versioned
  # alias (/usr/lib/jvm/java-1.21.0-openjdk-<arch>), so glob rather than guess.
  for c in /usr/lib/jvm/java-21-openjdk-amd64 /usr/lib/jvm/java-21-openjdk-arm64 \
           /usr/lib/jvm/java-1.21.0-openjdk-amd64 /usr/lib/jvm/java-1.21.0-openjdk-arm64 \
           /usr/lib/jvm/java-21-openjdk /usr/lib/jvm/openjdk-21; do
    [ -x "$c/bin/javac" ] && { jh="$c"; break; }
  done
  if [ -z "$jh" ]; then
    for c in /usr/lib/jvm/*/bin/javac; do
      [ -x "$c" ] || continue
      case "$(basename "$(dirname "$(dirname "$c")")")" in *21*) jh="$(dirname "$(dirname "$c")")"; break;; esac
    done
  fi
  if [ -z "$jh" ]; then
    echo "✗ no JDK 21 found under /usr/lib/jvm — run 'bash apk/tools/setup-toolchain.sh' first" >&2
    return 1
  fi
  export JAVA_HOME="$jh"
  export PATH="$JAVA_HOME/bin:$PATH"
  export ANDROID_HOME="$SDK_ROOT"
  export ANDROID_SDK_ROOT="$SDK_ROOT"
  export PATH="$SDK_ROOT/cmdline-tools/latest/bin:$SDK_ROOT/platform-tools:$PATH"
  echo "JAVA_HOME=$JAVA_HOME"
  echo "ANDROID_HOME=$ANDROID_HOME"
}

if [ "${1:-install}" = "env" ]; then
  export_java_home
  return 0 2>/dev/null || exit 0
fi

echo "── 1/4 JDK 21 ─────────────────────────────────────────────"
if [ ! -x /usr/lib/jvm/java-21-openjdk-amd64/bin/javac ]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq openjdk-21-jdk-headless
fi
export_java_home
java -version 2>&1 | head -1

echo "── 2/4 Android cmdline-tools ──────────────────────────────"
mkdir -p "$SDK_ROOT/cmdline-tools"
command -v unzip >/dev/null 2>&1 || { export DEBIAN_FRONTEND=noninteractive; apt-get update -qq; apt-get install -y -qq unzip; }
if [ ! -x "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]; then
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/cmdline-tools.zip" \
    "https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_VERSION}_latest.zip"
  unzip -q -o "$tmp/cmdline-tools.zip" -d "$tmp/unpack"
  rm -rf "$SDK_ROOT/cmdline-tools/latest"
  mv "$tmp/unpack/cmdline-tools" "$SDK_ROOT/cmdline-tools/latest"
  rm -rf "$tmp"
fi
echo "sdkmanager: $("$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" --version 2>/dev/null | head -1)"

echo "── 3/4 SDK platform + build tools ─────────────────────────"
yes | "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" --licenses >/dev/null 2>&1 || true
"$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" --install \
  "platform-tools" "platforms;${PLATFORM}" "build-tools;${BUILD_TOOLS}" >/dev/null
ls "$SDK_ROOT/platforms" "$SDK_ROOT/build-tools"

echo "── 4/4 apk/ node deps + local.properties ──────────────────"
printf 'sdk.dir=%s\n' "$SDK_ROOT" > "$REPO_ROOT/apk/android/local.properties"
if [ ! -d "$REPO_ROOT/apk/node_modules/@capacitor/cli" ]; then
  ( cd "$REPO_ROOT/apk" && npm install --no-audit --no-fund )
fi
echo "capacitor: $(node "$REPO_ROOT/apk/node_modules/@capacitor/cli/bin/capacitor" --version 2>/dev/null || echo missing)"

echo
echo "✓ toolchain ready — build with:"
echo "  source apk/tools/setup-toolchain.sh env"
echo "  node apk/build-www.js"
echo "  ( cd apk && node node_modules/@capacitor/cli/bin/capacitor sync android )"
echo "  ( cd apk/android && ./gradlew assembleRelease --no-daemon )"
