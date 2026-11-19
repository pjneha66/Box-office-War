# Working APK release pipeline

The signed APK is built by Capacitor + Gradle. Two supported paths:

- **CI (recommended):** push a `v*` tag or run **Actions → Release APK**. The
  workflow installs the Android SDK, materialises the keystore from repository
  secrets, builds, verifies the bundled `app-version`, and publishes the
  GitHub release with the APK attached. See `.github/workflows/release-apk.yml`.
- **Local:** `bash release.sh <version>` from the repo root (works on macOS and
  Linux; the script discovers the JDK and Android SDK, or honours
  `JAVA_HOME` / `ANDROID_HOME`).

The zip-swap + jarsigner pipeline is **not** installable on modern Android
(v1 signature only; targetSdk 30+ requires v2). Always use the Gradle pipeline.

## What the build does

```bash
# 1. package the game into apk/www/ (index.html, style.css, data.js, engine.js,
#    ui.js, the module files, manifest, icons)
node apk/build-www.js

# 2. sync the web assets into the android project
cd apk && node node_modules/@capacitor/cli/bin/capacitor sync android

# 3. signed release build
cd android && ./gradlew assembleRelease --no-daemon

# output: app/build/outputs/apk/release/app-release.apk (v2-signed, aligned)
```

`release.sh` wraps all of this, then runs a hard gate: it refuses to publish an
APK whose bundled `index.html` `app-version` does not match the release version,
so stale web assets can never ship.

## Signing

The keystore is **not** committed. It is provided to CI through repository
secrets and written into `apk/signing/` only for the duration of the build:

| Secret | Contents |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | base64 of `boxofficewar.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | store password |
| `ANDROID_KEY_ALIAS` | key alias (`bow`) |
| `ANDROID_KEY_PASSWORD` | key password |

For a local build, either set `ANDROID_KEYSTORE_PATH`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`, or
create `apk/android/keystore.properties` (gitignored).

**Keep this key safe.** The game's saves live in the app's local storage, and
installing an update signed with a different key forces an uninstall that wipes
them. Losing the keystore means every existing player must lose their save to
get the next update.

For Play Store distribution upload an **AAB** (`./gradlew bundleRelease`) with
Play App Signing instead of a self-signed APK.

Verified on v44.0: package `com.pjneha66.boxofficewar`, versionCode 57,
versionName 44.0, v2 signature block, assets/public/* contains the full game.
