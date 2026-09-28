# Period Timer

A countdown timer for class periods, with a live notification that keeps
counting on the lock screen and a home-screen widget.

[![Release](https://img.shields.io/github/v/release/abdulahadsn5791-gif/peroid-timer)](https://github.com/abdulahadsn5791-gif/peroid-timer/releases)
[![Download page](https://img.shields.io/badge/download-Android-brightgreen)](https://abdulahadsn5791-gif.github.io/peroid-timer/)
[![License](https://img.shields.io/github/license/abdulahadsn5791-gif/peroid-timer)](./LICENSE)

- **Live progress notification** — real progress bar plus chronometer, anchored
  by exact alarms so it survives the screen turning off
- **Home-screen widget** — next period and time remaining at a glance
- **Reboot-surviving** — alarms are rescheduled after a restart
- **Editable weekly timetable** — one preset per weekday; an empty day means
  "no lectures" and the app stays completely silent
- **Custom alarm ringtone** — pick any audio file; it rings natively even when
  the app is closed, with the built-in tone as fallback
- **Theming** — accent colour, ring palettes, and optional colour for the clock,
  notification and active bars
- **Offline** — everything stays on the phone (MMKV), no account, no network
- **All Android ABIs** in one APK, so phones *and* Android Studio emulators work

Built with Expo SDK 57 / React Native 0.86 on the New Architecture.

> The app ships with four sample periods (08:30–11:25) on every day. Open
> **Settings** to give each weekday its own preset — clear the days you have
> no lectures and the timer, alarms and notifications switch off for them.

## Get the app

**→ [Download page](https://abdulahadsn5791-gif.github.io/peroid-timer/)** — friendlier
for sharing, with install notes and a checksum.

**→ [Direct APK](https://github.com/abdulahadsn5791-gif/peroid-timer/releases/latest/download/period-timer.apk)**

That direct link always serves the newest release, so you never need to hunt for
a version. The [releases page](https://github.com/abdulahadsn5791-gif/peroid-timer/releases)
has the notes and a `SHA256SUMS` file for verifying the download.

| | |
| --- | --- |
| Current release | `v1.0.0` — `versionCode 10000` |
| Size | ~107 MB (one APK holds all four ABIs) |
| ABIs | `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` |
| Signing | release key, so future versions install over this one cleanly |

### Installing on Android

1. Tap the link and let the file download.
2. Open the downloaded `period-timer.apk` from your notification or the Files
   app.
3. Android will ask you to allow **Install unknown apps** for whichever app
   downloaded it. Grant that once — it is a per-app permission.
4. Install, then open **Period Timer**.

On first launch the app asks for notification and exact-alarm permission. Give
both, or the live countdown will not survive the screen turning off.

### After you install

Vendors like Samsung, Xiaomi, OnePlus and Oppo kill background work aggressively.
If the notification goes stale:

- Grant exact alarms: **Settings → Alarms & reminders**
- Add Period Timer to the OEM's "protected" / "no battery optimisation" list
- Restrict battery use to **Unrestricted** under **App battery management**

`docs/KNOWN-LIMITS.md` documents the behaviour in more detail, including OEM
notes and what is deliberately not implemented.

## What this build does not do

- No lock-screen presence mode and no full-screen alarm. The app never touches
  your wallpaper. See `docs/KNOWN-LIMITS.md`.
- iOS is not released; notifications there are not implemented in this pass.

## Building from source

Dev tooling is Bun-first. Node 22.13+ is on `PATH` for the Expo/Metro tooling.

```sh
bun install            # deps (bun.lock is committed)
bun test               # domain + application + architecture tests
bun typecheck          # tsc --noEmit
bun beep               # regenerate assets/period-end.wav
```

Run the app:

```sh
bunx expo start        # dev server
bunx expo run:android  # prebuild if needed, build, install on a device/emulator
```

### Release APK

For a local build, always switch to release mode first. It drops the Expo dev
client so it is not compiled into a distributed APK.

```sh
PERIOD_TIMER_RELEASE=1 bun scripts/release-mode.mjs   # shipping: drop dev client
bunx expo prebuild
cd android && ./gradlew assembleRelease
# android/app/build/outputs/apk/release/app-release.apk
```

**The env var is the whole switch.** The script reads `PERIOD_TIMER_RELEASE=1`;
run it bare and it does the opposite, putting the dev client back for
day-to-day `expo run:android` work:

```sh
bun scripts/release-mode.mjs   # dev: keep expo-dev-client
```

It rewrites the `expo.autolinking` block in `package.json` in place, so commit
the dev-mode version rather than the release-mode one.

Release builds are signed with the real key only when one is supplied, and the
Expo dev client is dropped from them — see `scripts/release-mode.mjs` and
`plugins/withPeriodTimerAndroid.js`. Without a keystore, `assembleRelease` falls
back to the debug key, which is fine for local testing but must not be
published.

### Cutting a release

Tag and push; CI does the rest:

```sh
git tag v1.0.2 && git push origin v1.0.2
```

**Skip `v1.0.1`.** `versionCode` is derived from the tag — `v1.2.3` becomes
`versionCode 10203` — so the next patch release has to keep moving forward.
Never re-push an existing tag either; the workflow publishes to that tag's
release.

The build takes roughly **85 minutes** on GitHub's runners, because one release
carries all four ABIs. The tag drives everything, and the run fails if the tag
disagrees with `expo.version` in `app.json`.

Signing secrets are read from `PERIOD_TIMER_KEYSTORE`,
`PERIOD_TIMER_STORE_PASSWORD`, `PERIOD_TIMER_KEY_ALIAS`,
`PERIOD_TIMER_KEY_PASSWORD`, `PERIOD_TIMER_VERSION_CODE` and
`PERIOD_TIMER_VERSION_NAME`. The key's fingerprint is recorded in
`docs/COMMANDS.md`.

## Native code

`expo prebuild` regenerates `android/`, so nothing in it is edited by hand.
Kotlin sources and Android resources live in `native/android/` and are copied in
by the config plugin `plugins/withPeriodTimerAndroid.js`, which also patches the
manifest and wires up release signing. Native code never holds schedule rules —
it only reads the snapshot the app writes.

## Project layout

| Path | What lives there |
| --- | --- |
| `src/domain` | entities, value objects, period rules |
| `src/application` | use cases and ports |
| `src/adapters` | storage, notifications, Android bridges |
| `src/composition-root.ts` | wires the layers together |
| `native/android` | Kotlin sources, resources, widget |
| `plugins` | the Expo config plugin |
| `scripts` | release-mode toggle |
| `tests` | domain, application and architecture tests |
| `docs` | commands, design rules, known limits, test checklist |
| `site` | the static download page published via GitHub Pages |

`docs/preview.html` is a static mock of the main screen, useful for reviewing
design changes without a build.

## License

MIT © 2026 abdulahadsn5791-gif. See `LICENSE` for the full text.
