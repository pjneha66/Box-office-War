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
#   4. commit + push  (push also redeploys box-office-war.vercel.app)
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
for f in data.js engine.js i18n.js ui.js sw.js; do node --check "$f"; done
echo "✓ syntax clean (data/engine/i18n/ui/sw)"
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
    fs.writeFileSync("index.html",idx);
    let vj=fs.readFileSync("version.json","utf8");
    if(!/"v"/.test(vj)) throw new Error("version.json missing its v field");
    vj=vj.replace(/"v":\s*"[0-9.]+"/,"\"v\": \""+ver+"\"");
    fs.writeFileSync("version.json",vj);
    console.log("  bumped: APK "+ver+" (code "+code+"), SW cache v"+sw+", app meta + version.json "+ver);
  ' "$VERSION" "$((CUR_CODE+1))" "$((CUR_SW+1))"
else
  echo "  (dry-run) would bump: APK ${CUR_VER} -> ${VERSION}, SW cache v${CUR_SW} -> v$((CUR_SW+1))"
fi

echo "── 3/6 rebuild APK ────────────────────────────────────────"
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
node apk/build-www.js
( cd apk/android && ./gradlew assembleRelease --no-daemon -q )
mkdir -p apk/dist
# in dry-run the version bump wasn't applied, so the built APK is still CUR_VER
OUT_VER="$VERSION"; [ "$DRY_RUN" = true ] && OUT_VER="$CUR_VER"
cp apk/android/app/build/outputs/apk/release/app-release.apk "apk/dist/BoxOfficeWar-$OUT_VER.apk"
cp "apk/dist/BoxOfficeWar-$OUT_VER.apk" ~/Downloads/BoxOfficeWar.apk
echo "✓ apk/dist/BoxOfficeWar-$OUT_VER.apk + ~/Downloads/BoxOfficeWar.apk"

if [ "$DRY_RUN" = true ]; then
  echo "── dry-run complete — next steps skipped ──────────────────"
  echo "  would: commit version bump → push (Vercel redeploys) →"
  echo "  gh release create v$VERSION with the APK attached → verify live"
  exit 0
fi

echo "── 4/6 commit + push ──────────────────────────────────────"
git add sw.js apk/android/app/build.gradle index.html version.json
git commit -m "v$VERSION: release — SW cache v$((CUR_SW+1)), APK $VERSION"
git push origin main
echo "✓ pushed — Vercel is redeploying"

echo "── 5/6 GitHub release ─────────────────────────────────────"
NOTES=$(mktemp)
{ echo "Box Office War v$VERSION"; echo;
  echo "Web: https://box-office-war.vercel.app (updated automatically)";
  echo "Android: download the APK below — fully offline, installs over previous versions without losing saves."; echo;
  echo "Changes since v$CUR_VER:"; git log --oneline "v$CUR_VER..HEAD" --no-decorate 2>/dev/null | sed 's/^/- /' || echo "- (tag v$CUR_VER not found — add notes manually)"; } > "$NOTES"
gh release create "v$VERSION" "apk/dist/BoxOfficeWar-$VERSION.apk" \
  --title "v$VERSION — Android APK (fully offline)" --notes-file "$NOTES"
echo "✓ https://github.com/pjneha66/Box-office-War/releases/tag/v$VERSION"

echo "── 6/6 verify live deploy ─────────────────────────────────"
sleep 45
LIVE=$(curl -s https://box-office-war.vercel.app/sw.js | grep -o 'bow-v[0-9]*-cache' | head -1)
echo "  live SW: $LIVE (expect bow-v$((CUR_SW+1))-cache)"
LIVEV=$(curl -s https://box-office-war.vercel.app/version.json | grep -o '"v": *"[0-9.]*"')
echo "  live version.json: $LIVEV (expect \"v\": \"$VERSION\")"
[ "$LIVE" = "bow-v$((CUR_SW+1))-cache" ] && echo "✅ RELEASE COMPLETE — web + Android both live" \
  || echo "⚠ Vercel still building — check https://vercel.com/dashboard in a minute"
