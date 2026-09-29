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

### The release key

The keystore lives outside the repository, in `~/keys/period-timer.jks` (mode
600, alongside its password in `period-timer.credentials.txt`). **Lose it and no
future release can install over an existing one**, so keep a second copy off this
machine. Fingerprint of the certificate every published APK is signed with:

```
SHA256: AE:DC:06:EA:CB:98:DE:25:7A:87:A6:4F:AA:4F:7A:8B:03:AB:95:F6:05:0C:7F:1D:2E:6C:40:86:87:6C:5E:BC
```

Compare an installed build against it with:
```sh
$ANDROID_HOME/build-tools/*/aapt2 dump badging <app.apk>
apksigner verify --print-certs <app.apk>
```

### Fingerprints are compared format-blind

The CI check (`.github/workflows/release.yml`, "Collect the APK") reads the
signing cert with `apksigner verify --print-certs` and compares it to the
`EXPECTED` constant above. The two sides never look alike on paper:
apksigner prints **lowercase hex without colons**
(`aedc06eacb98...`), while the documented fingerprint is uppercase with
colons. Both are normalized — colons stripped, lowercased — before the
comparison, so formatting can never fail a correctly signed APK.

Don't reach for `keytool -printcert -jarfile` here: it only reads v1 (JAR)
signatures, and with minSdk 24 AGP emits v2/v3 signatures only, so keytool
prints nothing and the check would false-fail. If you verify by hand,
normalize the same way CI does:

```sh
apksigner verify --print-certs <app.apk> \
  | grep -o 'certificate SHA-256 digest:.*' | sed 's/^[^:]*: *//' \
  | tr -d ':' | tr '[:upper:]' '[:lower:]'
```

If the release key is ever replaced, update both the fingerprint above and
the `EXPECTED` constant in `release.yml` in the same commit.

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

## Git commit hygiene

Commit messages contain the change description only. No agent/tool/AI
attribution of any kind: no "Generated with …" trailers, no `Co-Authored-By`
agent lines. See the rule in `AGENTS.md`.
