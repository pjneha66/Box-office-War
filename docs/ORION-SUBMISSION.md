# Orion Store submission

Paste-ready payload for the [Orion Store](https://www.orionstore.net) catalogue. Orion has no backend — the catalogue is `apps.json` in `RookieEnough/Orion-Data`, and entries arrive through an issue, not a form.

## How the submission is processed

1. Open an issue in `RookieEnough/Orion-Data` whose **title contains `App Submission`**.
2. Put the JSON array in the **first code fence** of the body. `.github/workflows/app_submission.yml` parses exactly that block.
3. A maintainer applies the `approved` label and runs the workflow (it is `workflow_dispatch` only). The script dedupes on `id` / `githubRepo` / `repoUrl`, appends to `apps.json`, commits, and closes the issue.
4. From then on the app updates itself: `mirror_generator.py` scans every entry with a `githubRepo`, pulls its GitHub releases, and rebuilds `mirror.json` every 6 hours.

**The asset name is a contract.** `releaseKeyword` is matched as a case-insensitive substring against release **asset** names (falling back to the release name/tag). `BoxOfficeWar` matches `BoxOfficeWar-41.1.apk`. Renaming the asset or shipping an AAB-only release silently drops the app out of the store.

Current submission: https://github.com/RookieEnough/Orion-Data/issues/2583

## Payload

```json
[
  {
    "id": "box-office-war",
    "name": "Box Office War",
    "description": "An offline Hollywood studio simulation. Greenlight films, package talent through agencies, build soundstages, fight box office wars, grow franchises, and run streaming, TV, games, merch and Broadway divisions. 36 simulation modules, a full weekly economy and 52-week release calendar. No accounts, no telemetry, no network calls: every save lives in local storage, so it plays entirely offline.",
    "icon": "https://raw.githubusercontent.com/pjneha66/Box-office-War/main/icon-512.png",
    "version": "Latest",
    "latestVersion": "Latest",
    "downloadUrl": "#",
    "repoUrl": "https://github.com/pjneha66/Box-office-War",
    "githubRepo": "pjneha66/Box-office-War",
    "releaseKeyword": "BoxOfficeWar",
    "packageName": "com.pjneha66.boxofficewar",
    "category": "Games",
    "platform": "Android",
    "size": "19 MB",
    "author": "pjneha66",
    "officialSite": "https://box-office-war.vercel.app",
    "screenshots": [
      "https://raw.githubusercontent.com/pjneha66/Box-office-War/main/assets/store/screenshot-dashboard-desktop.png",
      "https://raw.githubusercontent.com/pjneha66/Box-office-War/main/assets/store/screenshot-studiolot-desktop.png",
      "https://raw.githubusercontent.com/pjneha66/Box-office-War/main/assets/store/screenshot-boxoffice-desktop.png",
      "https://raw.githubusercontent.com/pjneha66/Box-office-War/main/assets/store/screenshot-empire-desktop.png",
      "https://raw.githubusercontent.com/pjneha66/Box-office-War/main/assets/store/screenshot-home-mobile.png"
    ]
  }
]
```

## Submission details

- **APK asset:** `BoxOfficeWar-41.1.apk` — signed universal release, `minSdk 24`, `targetSdk 36`, 19 MB (20,219,187 bytes).
- **Release:** https://github.com/pjneha66/Box-office-War/releases/tag/v41.1
- **License:** MIT (`LICENSE`).
- **Permissions:** none beyond the Android default. Fully bundled offline build; no runtime network calls.
- **Signing:** same key on every release, so updates install over the previous version without wiping local saves.
- **Screenshots:** four desktop views at 2880×1800 and one phone view at 2532×1170. The phone shot is landscape because the APK is landscape-locked (`sensorLandscape`); a portrait shot would misrepresent the app.

## When re-submitting

Only `size` and the release tag need refreshing between releases — the client resolves versions from GitHub, so `version` / `latestVersion` stay `"Latest"`. Metadata changes (name, description, screenshots, category) need an update request, since the catalogue row is static JSON.
