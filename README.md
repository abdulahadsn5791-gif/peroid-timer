# Period Timer

A countdown timer for class periods, with a live notification that keeps
counting on the lock screen and a home-screen widget.

- **Live progress notification** — real progress bar plus chronometer, anchored
  by exact alarms so it survives the screen turning off
- **Home-screen widget** — next period and time remaining at a glance
- **Reboot-surviving** — alarms are rescheduled after a restart
- **Offline** — everything stays on the phone (MMKV), no account, no network
- **All Android ABIs** in one APK, so phones *and* Android Studio emulators work

Built with Expo SDK 57 / React Native 0.86 on the New Architecture.

## Download

**→ [Download the latest APK](https://github.com/abdulahadsn5791-gif/timer/releases/latest/download/period-timer.apk)**

That link always serves the newest release, so you never need to hunt for a
version. Prefer a page to read first? See the releases page for notes and
checksums.

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

```sh
bun scripts/release-mode.mjs          # dev: keep the Expo dev client
bunx expo prebuild
cd android && ./gradlew assembleRelease
# android/app/build/outputs/apk/release/app-release.apk
```

Release builds are signed with the real key only when one is supplied, and the
Expo dev client is dropped from them — see `scripts/release-mode.mjs` and
`plugins/withPeriodTimerAndroid.js`. Without a keystore, `assembleRelease` falls
back to the debug key, which is fine for local testing but must not be
published.

To cut a release, push a tag and let CI do it:

```sh
git tag v1.0.0 && git push origin v1.0.0
```

The tag drives everything: `v1.2.3` becomes `versionName 1.2.3` and
`versionCode 10203`, and the workflow publishes `period-timer.apk` to the
release. It fails if the tag disagrees with `expo.version` in `app.json`.

Signing secrets are read from `PERIOD_TIMER_KEYSTORE`,
`PERIOD_TIMER_STORE_PASSWORD`, `PERIOD_TIMER_KEY_ALIAS`,
`PERIOD_TIMER_KEY_PASSWORD`, `PERIOD_TIMER_VERSION_CODE` and
`PERIOD_TIMER_VERSION_NAME`.

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
| `native/android` | Kotlin sources, resources, widget |
| `plugins` | the Expo config plugin |
| `tests` | domain, application and architecture tests |
| `docs` | commands, design rules, known limits, test checklist |

## License

See `LICENSE`.
