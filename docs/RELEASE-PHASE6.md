# Phase 6 - APK Release

Version: 42.8

Steps executed:
1. node apk/build-www.js --rebuild
2. python3 apk/tools/patch_axml.py apk/dist/base.apk apk/dist/out-unsigned.apk apk/www 53 42.8
3. jarsigner -keystore apk/signing/boxofficewar.keystore -storepass B0xOfficeWar2026 -keypass B0xOfficeWar2026 -signedjar apk/dist/BoxOfficeWar-42.8.apk apk/dist/out-unsigned.apk bow

Result: APK built and signed successfully.

Artifacts:
- apk/dist/BoxOfficeWar-42.8.apk
- version.json updated to v42.8
