# Period Timer — Rules & Info

Light-theme, feel-like-your-own-OS design rules, the hexagonal architecture contract, and the honest platform limits for the React Native + Android lock-screen build.

---

## 1. Design language (light / white theme, native OS surface)

The app must feel like a system settings surface — as if you opened a native OS, not a webpage.

### 1.1 Tokens
| Token | Value | Use |
|---|---|---|
| `canvas` | `#F3F4F6` | root background |
| `surface-1` | `#F9FAFB` | base panels, list rows |
| `surface-2/3/4` | `#FFFFFF` | cards, sheets, raised chrome |
| `accent` | `#2563EB` default | one accent only, sparingly |
| `success` | `#15803D` | passed rows, checks |
| `warning` | `#B45309` | low-time phase 2 |
| `danger` | `#DC2626` | last-phase timing, alerts |
| text | black at `1 / 0.6 / 0.4` opacity | primary / secondary / tertiary |
| borders | black at `0.05–0.10` | hairline depth, never heavy |
| radius | `8 / 14 / 20 / 28 / full` | nested elements use *one step smaller* than parent |
| shadows | `0 1px 2px`, `0 4px 12px`, `0 12px 28px` at black `0.06/0.08/0.14` | resting / raised / modal |
| blur | real `expo-blur` (24px) | frosted panels |

### 1.2 Hard rules
1. **No gradients anywhere.** No `bg-gradient-*`, no `from/to/transparent`, no gradient inside arbitrary values. Depth comes from flat surface layering + hairlines + low-opacity shadows + real blur.
2. **Flat fills only** — a single flat token color per element.
3. **One accent color only.** Accent is used for the single most important action per screen and the current-period highlight.
4. **Minimum tap target 44×44px**, 44px row height floor, `gap` in 4px units, content padding `16–24px`.
5. **Motion 150–300 ms** with `cubic-bezier(0.32, 0.72, 0, 1)`, only in response to an action (open sheet, toggle switch, save). No decorative/looping entrance motion. The only repeat is the current-period pulsing dot and the end-of-period flash.
6. **Typography:** system font stack; large-title bold `tracking-tight` for "Today"; the big clock is thin weight with `tabular-nums`; body default; captions black/60; micro black/40.
7. **Radius nesting:** a child inside `rounded-xl` uses `rounded-lg`, never the same value — corners read concentric.
8. **App background:** when an app background photo is set, primary text becomes near-white `rgba(255,255,255,0.97)`, secondary `rgba(255,255,255,0.8)`, and frosted panels lighten to `rgba(255,255,255,0.14)` with `rgba(255,255,255,0.22)` borders over a `rgba(0,0,0,0.28)` scrim. The photo only ever decorates the app home screen — it never touches the phone's wallpaper.

### 1.3 Width responsiveness in RN
- Default target: **360px floor** (single column, full-bleed).
- `width >= 768` (tablet): two panes — ring left, schedule list right.

---

## 2. Hexagonal architecture (mandatory)

Dependency rule — **dependencies point inward only**:

```
adapters  ->  application  ->  domain
```

- `domain/` imports **nothing** (zero dependencies).
- `application/` imports only `domain/`.
- `adapters/` imports `application` + `domain`. Nothing imports adapters except `src/composition-root.ts` (the composition root).
- Native Kotlin/Swift contains **no schedule logic**: it only reads the `DayTimeline` snapshot the app writes and looks up *"what is true at time T"*.

### 2.1 Folder structure
```
src/
  domain/entities, domain/value-objects, domain/services
  application/ports/inbound, application/ports/outbound, application/ports/view-models,
               application/use-cases, application/state
  adapters/inbound/ui (design-system, components, screens, hooks),
           inbound/os-entrypoints, adapters/outbound/*  (one folder per port)
  composition-root.ts
native/android, native/ios        (Kotlin / Swift, adapter-tier, snapshot-driven)
tests/                            (Bun tests + fakes + architecture test)
scripts/                          (Bun-only dev scripts)
```

### 2.4 Weekly schedule (v5 snapshot)
- `Settings.weekSchedule` holds one `Period[]` per weekday (0 = Sunday … 6 =
  Saturday, matching `Date.getDay()`). An empty list is the "no lectures"
  preset: the day timeline snapshot gets zero segments and native stays off —
  no live notification, no alarms, no sound.
- The native snapshot (`DayTimeline` v5) always describes ONE resolved day and
  carries `weekday` + `alarmSoundUri`. End-of-period dedupe keys are
  `"weekday:periodId"` so the same period rings again on other days.

### 2.2 Rules
1. `domain/` and `application/` must not import `react`, `react-native`, `expo-*`, `@react-native-*`, any `adapters/` path, or any Bun/Node API.
2. **No business logic in UI, hooks, native code, or storage** — time math, phase selection, colors-by-phase, "up next", formatting live only in `domain/services`; orchestration lives in `application/use-cases`.
3. UI receives ready-made **view models** and only renders. Time enters only through `ClockPort` — no `Date.now()`/`new Date()` outside `SystemClock`.
4. Every outbound port has an **in-memory fake** in `tests/fakes/` used by tests.
5. Adding a new adapter must require **zero edits** to `domain/` or `application/`.
6. `tests/architecture.test.ts` scans imports and **fails CI** on any violation.

### 2.3 Outbound ports (driven by use-cases)
| Port | Signature |
|---|---|
| `ClockPort` | `now(): ClockSnapshot { epochMs, minutesOfDay }` · `todayBoundaryEpochSec(): number` |
| `SettingsRepositoryPort` | `load(): Settings` · `save(s: Settings): void` |
| `ImagePickerPort` | `pickImage(): Promise<{ uri: string; width: number; height: number } \| null>` |
| `WallpaperStorePort` | `getStoredUri(): string \| null` · `setPreviewImage(src): Promise<string \| null>` · `clearPreview(): void` · `commitPreview(): Promise<string \| null>` · `rollbackPreview(): void` · `removeStored(): Promise<void>` |
| `SoundPort` | `playEndSound(): Promise<void>` |
| `AlertSchedulerPort` | `scheduleTransitionAlerts(timeline: DayTimeline): Promise<void>` · `scheduleEndOfPeriodAlert(timeline: DayTimeline): Promise<void>` · `startLiveNotification(): Promise<void>` · `stopLiveNotification(): Promise<void>` · `hasExactAlarmAccess(): Promise<boolean>` · `requestExactAlarmAccess(): Promise<boolean>` |
| `SoundPickerPort` | `pickSound(): Promise<{ uri: string; name: string } \| null>` |
| `LockScreenSnapshotPort` | `write(timeline: DayTimeline): Promise<void>` · `read(): DayTimeline \| null` |

Inbound ports are the use-case interfaces (`GetHomeView`, `OpenSettings`, `PreviewPalette`, `PreviewAccent`, `PreviewColorClock`, `PreviewSound`, `DraftPeriods`, `PickWallpaper`, `RemoveWallpaper`, `SaveSettings`, `CloseSettings`, `CheckForPeriodEnd`).

---

## 3. Bun (dev tooling only)
- `bun` is the package manager + script runner: `bun install`, `bun run`, `bunx expo …`, `bun test`.
- The shipped app runs on **Hermes** → **no Bun runtime APIs** (`Bun.file`, `Bun.serve`, `bun:*`) anywhere in `src/`. Bun APIs only in `scripts/` and `tests/`.
- Expo CLI / Metro still execute under **Node** internally (Expo CLI is a Node program). Commands work through `bunx expo …`; a Node ≥ 20 LTS install is required for `create-expo-app` extraction and is the guaranteed-compatible runtime.
- TypeScript strict; path aliases `@domain/*`, `@application/*`, `@adapters/*`, `@tests/*` (enabled in Metro via `experiments.tsconfigPaths`).

---

## 4. Honest platform rules (never fake a feature)
- **We never bypass or disable the system lock, PIN, or biometrics.** The app never touches your wallpaper — it only renders inside its own app surface.
- **Stock Android has no third-party lock-screen widgets.** The ongoing notification is the only always-visible "on any screen" surface; the home-screen widget sits on the home screen.
- **iOS does not allow replacing the lock screen** — the app ships notification-only live coverage (the foreground service is Android-only; iOS/web fall back to standard notifications).
- Battery numbers are given honestly, not claimed zero.

---

## 5. Live progress notification (always on, Android)
1. **Ongoing notification (Google-Maps-style):** an ongoing public notification with a real **progress bar** (`setProgress`) shrinking as the period elapses, a system **chronometer** live countdown (`"Period 2 · ends in 24:37"`) on Android 7+ (static text before that), and BigText detail lines with the current and next period + start/end labels.
2. It is delivered by a **foreground service** (`PeriodForegroundService`, 1 tick/sec while the screen is on, 5 sec when off) plus one exact alarm per schedule transition, so the countdown bar stays live in the shade while the app is closed.
3. End-of-period **sound + notification** stays independent (driven by the sound toggle).

---

## 6. Battery & background honesty
- Exact alarms (`SCHEDULE_EXACT_ALARM`): a handful per day; measured impact negligible. Denied? Fall back to inexact `setAndAllowWhileIdle`.
- Live notification: a foreground service refreshes the progress bar ~1×/sec while screen on, throttled to ~5 sec while screen off; zero CPU while it self-stops between periods.
- Manufacturers (Xiaomi/MIUI/HyperOS, OPPO, Vivo, Realme, Samsung, Huawei, OnePlus) kill background services by default — see whitelist instructions in `docs/KNOWN-LIMITS.md`.