# Known limits & OEM notes

Honest scope so nobody discovers these the hard way.

## Weekly presets & empty days
- Every weekday has its own period list (Settings → weekday tabs). An empty
  preset means "no lectures this day": no countdown, no live notification,
  no alarms, no sounds — native code treats a zero-segment snapshot as
  "nothing scheduled" and stays off for the whole day.
- Existing single-timetable installs migrate to "every day", so nothing
  disappears after an upgrade. Use **Copy to all days** / **Clear this day**
  to reshape the week quickly.

## Live progress notification (Android)
- Android provides an ongoing public notification with a real **progress bar**
  + chronometer countdown, delivered by the `PeriodForegroundService`
  (1 tick/sec screen-on, 5 sec screen-off) and re-anchored by one exact alarm
  per schedule transition. This is the primary "any screen" surface.
- There is **no lock-screen presence mode anymore**: the old live-wallpaper
  option and the full-screen alarm activity were removed. The app never touches
  your phone's wallpaper. The in-app "App background" photo is decorative only
  and is never shown outside the app.
- iOS: no lock-screen replacement allowed by Apple; only standard
  notifications. Not implemented in this pass.

## Custom alarm ringtone
- **Choose** a ringtone in Settings → Alarm sound (system audio picker). The
  file is copied into the app's documents directory, so the selection survives
  restarts and cache clears.
- The alarm fires natively (exact alarm → notification on the alarm channel
  with `USAGE_ALARM` audio), so it rings **even when the app is closed** and
  on the lock screen. If the picked file is ever deleted by the system, the
  platform default alarm sound plays instead — the alarm never goes silent.
- The ringtone follows the phone's **alarm volume** slider, not media volume.
  The channel is republished with `USAGE_ALARM` attributes before each alert
  because Android 8+ ignores a notification builder's `setSound` once the
  channel exists — the channel's own sound is what actually plays.
- **Stopping it** takes two routes: a "Stop alarm" action on the notification
  and a matching button in the app's end-of-period toast. Cancelling the
  notification is what silences the channel sound. Stopping one alarm never
  disables the schedule; the next period end still fires.

## The two alert toggles are independent
- **Period-end notifications** off: nothing is posted at a period end, and any
  still-ringing alarm is silenced.
- **Sound when a period ends** off: a quiet heads-up still appears, with no
  ringtone and no vibration.
- Both off: a period end is completely silent. `notificationsEnabled` travels
  to the native receiver in the day snapshot (v6); before that it was saved
  and displayed but never reached the alarm path.

## Play Protect / "harmful app" flag
The flag was caused by a legacy permission combination, not by any behaviour:
- The manifest now declares `USE_EXACT_ALARM` (the policy-approved way for
  alarm-clock apps to get exact alarms on Android 13+) and keeps the legacy
  `SCHEDULE_EXACT_ALARM` only up to Android 12L (`maxSdkVersion=32`), where it
  needs no user toggle and no Play declaration.
- `VIBRATE` was added explicitly (vibration without it is flagged).
- The boot receiver had to stay exported for the system `BOOT_COMPLETED`
  broadcast; the custom re-schedule action is now gated so foreign apps can
  not spoof it.
- Rebuild with `bunx expo prebuild` after this change and **ship a new
  versionCode** — old installed builds keep their old manifest. If Play
  Protect still warns over an APK from an unknown source, it is the
  "unknown apps" install path, not the app; a Play listing removes it.

## Battery / background execution
Android vendors aggressively kill background work. If notifications go stale:
- Grant exact alarms (Settings → Alarms & reminders).
- Add the app to the OEM "protected"/"no battery optimization" list:
  - Xiaomi: Security → Battery & performance → App battery saver → no restrictions.
  - OPPO/Realme/OnePlus: Settings → Battery → App Battery Management → Allow.
  - vivo: Settings → Battery → Background Power Consumption Management → allow.
  - Huawei: Settings → Battery → App launch → Manage manually → allow all
    background activity.
  - Samsung: Settings → Battery → Background usage limits → app → Allow.
  - Stock/Pixel (policed): disable "Restrict background" for the app.
- The foreground service is `specialUse` (declared in the manifest); some OEM
  DND/battery policies may still suppress it until whitelisted above.
- If the app is force-stopped by the OS, alarms stop; the widget/notification
  then show the last written snapshot (data is fine, timing is stale) until a
  reboot receiver re-anchors.

## Exact vs inexact alarms
- Without `SCHEDULE_EXACT_ALARM`, alarms can drift up to ~10 minutes on some
  devices. The app degrades gracefully; the UI never breaks.

## Widget refresh
- AppWidget `updatePeriodMillis` maps to 30 min minimum; our transition alarms
  push faster updates, but a static truth change without a transition (edit +
  save) refreshes on next alarm/update only.
- The widget counts **down** (chronometer, API 24+); below Android 7 it shows
  static remaining text updated on alarm broadcasts.

## Native dir is source of truth
- `android/` is generated by `expo prebuild`; edit `native/android/` + the
  config plugin instead. Rebuild with `bunx expo prebuild && ./gradlew assembleRelease`.