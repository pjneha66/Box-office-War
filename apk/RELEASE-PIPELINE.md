# Working APK release pipeline (proven — v42.5 & v42.8)

The zip-swap + jarsigner pipeline is NOT installable on modern Android
(v1 signature only; targetSdk 30+ requires v2). Use the Capacitor gradle
pipeline — this is how v42.5 and v42.8 were built:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools

# 1. package the game (game/ -> apk/www/, 44 files incl. cast banks + cameo.js)
node apk/build-www.js --rebuild

# 2. stage into the Capacitor working tree (copy of the repo at /tmp/bow-main)
cp apk/www/* /tmp/bow-main/apk/www/

# 3. bump apk/android/app/build.gradle: versionCode / versionName

# 4. sync web assets into the android project + signed release build
cd /tmp/bow-main/apk && node node_modules/@capacitor/cli/bin/capacitor sync android
cd android && ./gradlew assembleRelease --no-daemon -q

# 5. output: app/build/outputs/apk/release/app-release.apk  (v2-signed, aligned)
```

Verified on v42.8: package com.pjneha66.boxofficewar, versionCode 54,
versionName 42.8, v2 signature block, assets/public/* contains the full game.
