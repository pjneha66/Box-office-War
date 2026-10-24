#!/usr/bin/env bash
# Installs the Android APK build workflow into .github/workflows/.
#
# It can't be committed from an Arena/GitHub-App session: GitHub refuses pushes
# that create or modify files under .github/workflows unless the token carries
# the `workflows` permission. So the canonical copy lives here and this script
# drops it into place; commit + push with your own credentials once.
#
#   bash apk/ci/install-ci.sh
#   git add .github apk/ci && git commit -m "ci: Android APK build" && git push
#
# Once it is on a branch, every push that touches the Android wrapper, its build
# script or the workflow itself builds the APK on a GitHub runner, and
# Actions -> "Android APK" -> Run workflow (tick publish_release) publishes it
# to the GitHub release v<version>.
set -euo pipefail
cd "$(dirname "$0")/../.."

SRC="apk/ci/android-apk.yml"
DST=".github/workflows/android-apk.yml"

mkdir -p "$(dirname "$DST")"
cp "$SRC" "$DST"
echo "✓ installed $DST (from $SRC)"
echo
echo "next:"
echo "  git add .github && git commit -m 'ci: build the signed APK on GitHub Actions' && git push"
echo "  then watch it:  gh run list --workflow android-apk.yml"
echo "  publish later:  gh workflow run android-apk.yml -f publish_release=true"
