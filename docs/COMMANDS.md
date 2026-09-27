# Commands

Dev tooling is Bun-first. Expo CLI/Metro are Node programs, so the portable Node
runtime (v22, `~/.local/nodejs`) is on `PATH`; `bunx` bridges them.

## Everyday
```sh
bun install                 # install deps (bun.lock is committed)
bun test                    # domain + application + architecture tests (~65 tests)
bun typecheck               # tsc --noEmit over the whole project
bun beep                    # (re)generate assets/period-end.wav from scripts/make-beep.ts
```

## App lifecycle
```sh
bunx expo start             # dev server (Expo Go / dev client)
bunx expo run:android       # prebuild (if needed) + build + install dev build on device
bunx expo prebuild          # regenerate android/ + plugins/withPeriodTimerAndroid.js runs
bunx expo prebuild --clean  # start android/ from scratch
```

## Release APK (without EAS)
```sh
bun scripts/release-mode.mjs    # dev: keep the Expo dev client (default)
bunx expo prebuild
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

`--release` builds with New Architecture on by default (Expo SDK 57 template).

Anything you hand to a user should be a release build:
```sh
PERIOD_TIMER_RELEASE=1 bun scripts/release-mode.mjs
```
That drops the dev launcher and developer menu from the app, and the
`app.config.js` half of the switch drops their config plugin. Without a
keystore, `assembleRelease` still falls back to the debug key — fine for local
testing, never publish that.

## Publishing a release

Pushing a tag is the whole release:
```sh
git tag v1.2.3 && git push origin v1.2.3
```
`.github/workflows/release.yml` builds the APK and attaches it to a GitHub
release as `period-timer.apk`, which keeps
`releases/latest/download/period-timer.apk` a permanent, always-current link.
The tag drives the version: `v1.2.3` → `versionName 1.2.3`,
`versionCode 10203` (major·10000 + minor·100 + patch). The run fails if the tag
disagrees with `expo.version` in `app.json`.

Signing secrets (repository secrets, never in git):
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`. The plugin turns them into
`PERIOD_TIMER_KEYSTORE` / `_STORE_PASSWORD` / `_KEY_ALIAS` / `_KEY_PASSWORD` and
refuses to build if `PERIOD_TIMER_KEYSTORE` points at a file that is not there,
so a typo can't quietly publish a debug-signed APK.

## What the config plugin does (steps 1–4 run automatically inside prebuild)
1. Patches `AndroidManifest` — FGS + exact-alarm permissions, the
   `PeriodForegroundService` (specialUse), alarm/boot receivers, home widget.
2. Adds `PeriodTimerPackage` to `MainApplication.kt` `getPackages()`.
3. Copies `native/android/kotlin/*.kt` and `native/android/res/**` into the
   generated project, plus `assets/period-end.wav` → `res/raw/period_end.wav`.
4. Patches `app/build.gradle` — a `signingConfigs.release` read from the
   environment (the template points releases at the *debug* key), and
   `versionCode` / `versionName` from `PERIOD_TIMER_VERSION_CODE` /
   `PERIOD_TIMER_VERSION_NAME`. Only applies the real key when a keystore
   exists, so `expo run:android` is untouched.

So native code changes live in `native/android/` and are never edited in the
generated `android/` folder.