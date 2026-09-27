# Test checklist

Real device manual checks, grouped by goal. `bun test` + `bun typecheck`
cover the domain/application layer and the dependency-direction rules; the items
below are the native notification/widget behaviors that need hands-on
verification on Android 13/14+.

## 1. Home screen parity (web → app)
- [ ] Ring renders with 60 ticks; numbers scale (H:MM:SS shows when ≥1h).
- [ ] Phase colors: >30% / 15–30% / last 15% of a period.
- [ ] "Also color the clock" toggle changes number color behavior live.
- [ ] Schedule rows: passed (dimmed) / current (pulsing dot + progress) / upcoming.
- [ ] Palette + accent previews apply live behind the open settings sheet.
- [ ] App background photo renders only behind the app home screen; the phone's
      own wallpaper is never touched.

## 2. Live progress notification (Android)
- [ ] Ongoing notification shows a **progress bar** that shrinks across a period,
      with a live chronometer countdown ("Period 2 · ends in 24:37").
- [ ] Notification stays live (foreground service) with the app killed and the
      process dead; big-text style shows current/next period + start/end labels.
- [ ] Transition alarms fire with the app killed and the process dead.
- [ ] "Period ended" notification arrives at each transition; sound respects the
      sound toggle; only one alert per period end.

## 3. Home-screen widget
- [ ] Widget shows period name, live chronometer **countdown** (counts down,
      never up), progress %, updates at each transition, dims when
      between/all-done.

## 4. Sessions across restarts
- [ ] Force-stop the app: alarms + notification still fire from the snapshot.
- [ ] Reboot: TimerBootReceiver rebuilds alarms; notification re-posts.

## 5. Battery honesty
- [ ] Locked overnight: battery drain is flat-line (screen-off ticks throttle to
      ~5s; only exact-alarm wakes at transitions).
- [ ] Settings → Alarms & reminders → "Period Timer" exact-alarm access row
      appears (Android 12+); without grant the app still works, inexactly.

## 6. Data integrity
- [ ] Edit periods → Save → reboot → widget/notification reflect new times.
- [ ] Delete all-but-one handled gracefully (never blocks the sheet).
- [ ] OEM battery managers (Xiaomi Mi Battery Saver / OPPO / Vivo / Huawei
      Protected apps / OnePlus / Samsung Sleeping apps) — see KNOWN-LIMITS.md.