#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# Box Office War — one-command release
#
#   bash release.sh <version>          e.g.  bash release.sh 28.16
#   bash release.sh                    auto-bumps the last version's patch digit
#   bash release.sh 28.16 --dry-run    everything except commit/push/release
#   bash release.sh 28.16 --skip-tests   (not recommended)
#
# Does, in order:
#   1. preflight: clean tree, node --check every JS file, full npm test
#   2. bump versions: sw.js CACHE + APK versionName/versionCode
#                     + index.html app-version meta + version.json (live update check)
#   3. rebuild the Android APK (signed, from apk/)
#   4. commit + push  (main branch carries version.json for the in-app update check)
#   5. GitHub release tagged <version> with the APK attached
#   6. post-flight: verifies the live site serves the new build
# ════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"

DRY_RUN=false; SKIP_TESTS=false; VERSION=""
for a in "$@"; do
  case "$a" in
    --dry-run) DRY_RUN=true ;;
    --skip-tests) SKIP_TESTS=true ;;
    *) VERSION="$a" ;;
  esac
done

echo "── 1/6 preflight ──────────────────────────────────────────"
if [ "$DRY_RUN" = false ] && [ -n "$(git status --porcelain)" ]; then
  echo "✗ working tree is dirty — commit or stash first (or use --dry-run)"; exit 1
fi

for f in data.js engine.js industry-expansion-suite.js studio-nextwave-suite.js i18n.js ui.js sw.js finance-tools.js v31-features.js \
         challenge-leaderboard.js theater-chains.js dynamic-soundtrack.js dynasty-legacy.js \
         bow-shorts.js talent-agency.js film-restoration.js festival-pr.js \
         studio-facilities.js syndication-tv.js talent-contracts.js bond-market.js \
         clash-analytics.js cinematic-universe.js location-scouting.js production-insurance.js \
         awards-campaign.js board-targets.js fan-conventions.js test-screenings.js \
         studio-espionage.js merch-licensing.js territory-licensing.js custom-sandbox.js \
         demographics-audiences.js exhibition-plf-concessions.js hollywood-crises-pr.js \
         marketing-blitz-engine.js production-creativity-suite.js \
         studio-lot-engine.js studio-lot-2d.js \
         box-office-sim-2-cast.js gamestudio-gdd-engine.js social-viral-network.js \
         sports-stadium-deals.js kairo-theme-suite.js box-office-collection-engine.js test/smoke.js test/smoke-body.js test/ui-test.mjs; do node --check "$f"; done
echo "✓ syntax clean (all core and modular engine files)"
if [ "$SKIP_TESTS" = false ]; then
  npm test > /tmp/bow-test.log 2>&1 || { echo "✗ tests failed — see /tmp/bow-test.log"; grep -E "✗|ERRORS|FAILED" /tmp/bow-test.log | head; exit 1; }
  echo "✓ full test suite green (smoke + UI + balance + scenarios)"
fi

echo "── 2/6 version bump ───────────────────────────────────────"
CUR_VER=$(grep -o 'versionName "[0-9.]*"' apk/android/app/build.gradle | grep -o '[0-9.]*')
CUR_CODE=$(grep -o 'versionCode [0-9]*'  apk/android/app/build.gradle | grep -o '[0-9]*')
CUR_SW=$(grep -o 'bow-v[0-9]*-cache' sw.js | grep -o '[0-9]*')
if [ -z "$VERSION" ]; then
  VERSION=$(echo "$CUR_VER" | awk -F. '{ $NF=$NF+1; print }' OFS=".")
  echo "  auto-bump: ${CUR_VER} -> ${VERSION}"
fi
[ "$VERSION" = "$CUR_VER" ] && { echo "✗ version $VERSION already released — pick a new one"; exit 1; }
if [ "$DRY_RUN" = false ]; then
  node -e '
    const fs=require("fs");
    const [ver,code,sw]=[process.argv[1],process.argv[2],process.argv[3]];
    let g=fs.readFileSync("apk/android/app/build.gradle","utf8");
    g=g.replace(/versionCode \d+/,"versionCode "+code).replace(/versionName "[0-9.]+"/,"versionName \""+ver+"\"");
    fs.writeFileSync("apk/android/app/build.gradle",g);
    let s=fs.readFileSync("sw.js","utf8");
    s=s.replace(/bow-v\d+-cache/,"bow-v"+sw+"-cache");
    fs.writeFileSync("sw.js",s);
    let idx=fs.readFileSync("index.html","utf8");
    if(!/name="app-version"/.test(idx)) throw new Error("app-version meta missing in index.html");
    idx=idx.replace(/(name="app-version" content=")[0-9.]+(")/,"$1"+ver+"$2");
    const qv=(idx.match(/\.(?:css|js)\?v=/g)||[]).length;
    if(qv<5) throw new Error("expected 5 ?v= cache-busters in index.html, found "+qv);
    idx=idx.replace(/(\.(?:css|js)\?v=)[0-9.]+(")/g,"$1"+ver+"$2");
    fs.writeFileSync("index.html",idx);
    let vj=fs.readFileSync("version.json","utf8");
    if(!/"v"/.test(vj)) throw new Error("version.json missing its v field");
    vj=vj.replace(/"v":\s*"[0-9.]+"/,"\"v\": \""+ver+"\"");
    fs.writeFileSync("version.json",vj);
    let pj=fs.readFileSync("package.json","utf8");
    pj=pj.replace(/"version":\s*"[0-9.]+"/,"\"version\": \""+(ver.split(".").length===2?ver+".0":ver)+"\"");
    fs.writeFileSync("package.json",pj);
    console.log("  bumped: APK "+ver+" (code "+code+"), SW cache v"+sw+", app meta + version.json + package.json "+ver);
  ' "$VERSION" "$((CUR_CODE+1))" "$((CUR_SW+1))"
else
  echo "  (dry-run) would bump: APK ${CUR_VER} -> ${VERSION}, SW cache v${CUR_SW} -> v$((CUR_SW+1))"
fi

echo "── 3/6 rebuild APK ────────────────────────────────────────"
# ── toolchain discovery (macOS Homebrew, Linux, CI) ────────────
# The old script hardcoded /opt/homebrew paths, so it only ran on one Mac.
# Resolve JDK 17+ and the Android SDK from the environment first, then fall
# back to the usual install locations on each platform.
find_jdk() {
  if [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ]; then echo "$JAVA_HOME"; return 0; fi
  if command -v java >/dev/null 2>&1; then
    local jh; jh=$(java -XshowSettings:properties -version 2>&1 | awk -F'= ' '/java.home/{print $2; exit}')
    [ -n "$jh" ] && echo "$jh" && return 0
  fi
  local c
  for c in /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
           /usr/lib/jvm/java-21-openjdk-amd64 /usr/lib/jvm/java-17-openjdk-amd64 \
           /usr/lib/jvm/java-21-openjdk /usr/lib/jvm/default-java \
           "${ANDROID_STUDIO_JDK:-}"; do
    [ -n "$c" ] && [ -x "$c/bin/java" ] && echo "$c" && return 0
  done
  return 1
}
find_sdk() {
  if [ -n "${ANDROID_HOME:-}" ] && [ -d "$ANDROID_HOME" ]; then echo "$ANDROID_HOME"; return 0; fi
  if [ -n "${ANDROID_SDK_ROOT:-}" ] && [ -d "$ANDROID_SDK_ROOT" ]; then echo "$ANDROID_SDK_ROOT"; return 0; fi
  local c
  for c in /opt/homebrew/share/android-commandlinetools "$HOME/Android/Sdk" "$HOME/Library/Android/sdk" /usr/local/lib/android/sdk; do
    [ -d "$c" ] && echo "$c" && return 0
  done
  return 1
}
JDK_DIR=$(find_jdk) || { echo "✗ no JDK found — install JDK 17+ or set JAVA_HOME"; exit 1; }
SDK_DIR=$(find_sdk) || { echo "✗ no Android SDK found — install it or set ANDROID_HOME"; exit 1; }
export JAVA_HOME="$JDK_DIR"
export ANDROID_HOME="$SDK_DIR"
echo "  JDK: $JAVA_HOME"
echo "  SDK: $ANDROID_HOME"
node apk/build-www.js
# cap sync copies apk/www into the Android assets gradle actually packs —
# without it the APK ships whatever web code was synced during the FIRST build
( cd apk && node node_modules/@capacitor/cli/bin/capacitor sync android )
( cd apk/android && ./gradlew assembleRelease --no-daemon -q )
mkdir -p apk/dist
# in dry-run the version bump wasn't applied, so the built APK is still CUR_VER
OUT_VER="$VERSION"; [ "$DRY_RUN" = true ] && OUT_VER="$CUR_VER"
cp apk/android/app/build/outputs/apk/release/app-release.apk "apk/dist/BoxOfficeWar-$OUT_VER.apk"
# convenience copy — only when there is a Downloads folder (Linux/CI usually hasn't)
if [ -d "$HOME/Downloads" ]; then
  cp "apk/dist/BoxOfficeWar-$OUT_VER.apk" "$HOME/Downloads/BoxOfficeWar.apk"
  echo "✓ apk/dist/BoxOfficeWar-$OUT_VER.apk + ~/Downloads/BoxOfficeWar.apk"
else
  echo "✓ apk/dist/BoxOfficeWar-$OUT_VER.apk"
fi
# hard gate: refuse to ship an APK whose bundled index.html isn't this version
APK_META=$(unzip -p "apk/dist/BoxOfficeWar-$OUT_VER.apk" assets/public/index.html | grep -o 'name="app-version" content="[0-9.]*"')
if [ "$APK_META" != "name=\"app-version\" content=\"$OUT_VER\"" ]; then
  echo "✗ APK content check FAILED: bundled app-version is '$APK_META' (expected $OUT_VER) — web assets are stale, aborting."; exit 1
fi
echo "✓ APK content verified: bundled app-version $OUT_VER"

if [ "$DRY_RUN" = true ]; then
  echo "── dry-run complete — next steps skipped ──────────────────"
  echo "  would: commit version bump → push →"
  echo "  gh release create v$VERSION with the APK attached → verify live"
  exit 0
fi

echo "── 4/6 commit + push ──────────────────────────────────────"
git add sw.js apk/android/app/build.gradle index.html version.json package.json
git commit -m "v$VERSION: release — SW cache v$((CUR_SW+1)), APK $VERSION"
git push origin main
echo "✓ pushed to main"

echo "── 5/6 GitHub release ─────────────────────────────────────"
NOTES=$(mktemp)
{ echo "Box Office War v$VERSION"; echo;
  echo "Web: https://github.com/pjneha66/Box-office-War (source on main)";
  echo "Android: download the APK below — fully offline, installs over previous versions without losing saves."; echo;
  echo "Changes since v$CUR_VER:"; git log --oneline "v$CUR_VER..HEAD" --no-decorate 2>/dev/null | sed 's/^/- /' || echo "- (tag v$CUR_VER not found — add notes manually)"; } > "$NOTES"
gh release create "v$VERSION" "apk/dist/BoxOfficeWar-$VERSION.apk" \
  --title "v$VERSION — Android APK (fully offline)" --notes-file "$NOTES"
echo "✓ https://github.com/pjneha66/Box-office-War/releases/tag/v$VERSION"

echo "── 6/6 verify published version ───────────────────────────"
sleep 20
LIVEV=$(curl -s https://raw.githubusercontent.com/pjneha66/Box-office-War/main/version.json | grep -o '"v": *"[0-9.]*"')
echo "  published version.json: $LIVEV (expect \"v\": \"$VERSION\")"
[ "$LIVEV" = "\"v\": \"$VERSION\"" ] && echo "[SUCCESS] RELEASE COMPLETE -- main + GitHub release + Android APK" \
  || echo "[WAIT] raw.githubusercontent.com still caching -- re-check in a minute"
