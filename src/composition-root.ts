/**
 * COMPOSITION ROOT — the only module that news up adapters and wires them into
 * use cases. Manual constructor injection; no DI framework. Nothing imports
 * adapters except this file (and the type-only AppDeps surface in the ui
 * ports folder).
 */
import { SystemClock } from "@adapters/outbound/clock/SystemClock";
import { MmkvSettingsRepository } from "@adapters/outbound/storage/MmkvSettingsRepository";
import { FileWallpaperStore } from "@adapters/outbound/wallpaper/FileWallpaperStore";
import { ExpoImagePicker } from "@adapters/outbound/image-picker/ExpoImagePicker";
import { ExpoAudioPlayer } from "@adapters/outbound/audio/ExpoAudioPlayer";
import { DocumentPickerSoundPicker } from "@adapters/outbound/sound-picker/SoundPicker";
import { NativeAlertScheduler } from "@adapters/outbound/notifications/NativeAlertScheduler";
import { FileSnapshotWriter } from "@adapters/outbound/lock-screen/FileSnapshotWriter";
import {
  registerNotificationResponseHandler,
  configureNotificationChannels,
  requestNotificationPermission,
} from "@adapters/inbound/os-entrypoints/NotificationHandler";

import { SettingsDraftStore } from "@application/state/SettingsDraftStore";
import { BackgroundPlanner } from "@application/state/BackgroundPlanner";
import { GetHomeViewUseCase } from "@application/use-cases/GetHomeViewUseCase";
import { OpenSettingsUseCase } from "@application/use-cases/OpenSettingsUseCase";
import {
  PreviewAccentUseCase,
  PreviewColorClockUseCase,
  PreviewColorNotificationUseCase,
  PreviewColorActiveBarsUseCase,
  PreviewNotificationsUseCase,
  PreviewPaletteUseCase,
  PreviewSoundUseCase,
  PreviewThemeUseCase,
  PreviewWallpaperBlurUseCase,
} from "@application/use-cases/PreviewUseCases";
import { DraftPeriodsUseCase } from "@application/use-cases/DraftPeriodsUseCase";
import {
  SetWeekdayUseCase,
  ClearDayUseCase,
  CopyToAllDaysUseCase,
} from "@application/use-cases/WeeklyScheduleUseCases";
import {
  PickAlarmSoundUseCase,
  ClearAlarmSoundUseCase,
} from "@application/use-cases/AlarmSoundUseCases";
import { PickWallpaperUseCase, RemoveWallpaperUseCase } from "@application/use-cases/WallpaperUseCases";
import { SaveSettingsUseCase } from "@application/use-cases/SaveSettingsUseCase";
import { CloseSettingsUseCase } from "@application/use-cases/CloseSettingsUseCase";
import { CheckForPeriodEndUseCase } from "@application/use-cases/CheckForPeriodEndUseCase";
import { ApplyBackgroundPlanUseCase } from "@application/use-cases/ApplyBackgroundPlanUseCase";

import type { HomeView, SettingsDraftVM, PeriodEndTickResult } from "@application/ports/view-models/ViewModels";
import type { AppDeps, SettingsActions } from "@adapters/inbound/ui/ports";

export class PeriodTimerApp implements AppDeps {
  readonly getHomeView: () => HomeView;
  readonly openSettings: () => void;
  readonly settingsActions: SettingsActions;
  readonly checkPeriodEnd: () => Promise<PeriodEndTickResult>;

  private readonly settingsIsOpenRef: () => boolean;
  private readonly getDraftRef: () => SettingsDraftVM;
  private readonly subscribeDraftRef: (listener: () => void) => () => void;
  private readonly clock: SystemClock;
  private readonly applyPlan: ApplyBackgroundPlanUseCase;
  private readonly audio: ExpoAudioPlayer;
  private refreshListeners = new Set<() => void>();
  private lastBoundary = 0;
  private lastSoundUri: string | null | undefined = undefined;

  constructor(deps: {
    getHomeView: () => HomeView;
    openSettings: () => void;
    settingsIsOpen: () => boolean;
    getDraft: () => SettingsDraftVM;
    subscribeDraft: (listener: () => void) => () => void;
    settingsActions: SettingsActions;
    checkPeriodEnd: () => Promise<PeriodEndTickResult>;
    clock: SystemClock;
    applyPlan: ApplyBackgroundPlanUseCase;
    audio: ExpoAudioPlayer;
  }) {
    this.getHomeView = deps.getHomeView;
    this.openSettings = deps.openSettings;
    this.settingsIsOpenRef = deps.settingsIsOpen;
    this.getDraftRef = deps.getDraft;
    this.subscribeDraftRef = deps.subscribeDraft;
    this.settingsActions = deps.settingsActions;
    this.checkPeriodEnd = deps.checkPeriodEnd;
    this.clock = deps.clock;
    this.applyPlan = deps.applyPlan;
    this.audio = deps.audio;
  }

  settingsIsOpen(): boolean {
    return this.settingsIsOpenRef();
  }

  getDraft(): SettingsDraftVM {
    return this.getDraftRef();
  }

  subscribeDraft(listener: () => void): () => void {
    const unsub = this.subscribeDraftRef(listener);
    this.refreshListeners.add(listener);
    return () => {
      unsub();
      this.refreshListeners.delete(listener);
    };
  }

  onBackgroundTick(): void {
    const boundary = this.clock.todayBoundaryEpochSec();
    if (boundary !== this.lastBoundary) {
      this.lastBoundary = boundary;
      void this.applyPlan.run();
    }
  }

  async runBootstrap(): Promise<void> {
    registerNotificationResponseHandler(() => this.refreshHome());
    await configureNotificationChannels();
    await requestNotificationPermission();
    this.onBackgroundTick();
    await this.applyPlan.run();
    setInterval(() => this.onBackgroundTick(), 60_000);
  }

  private refreshHome(): void {
    for (const listener of this.refreshListeners) listener();
  }
}

export function createApp(): AppDeps {
  const clock = new SystemClock();
  const settingsRepository = new MmkvSettingsRepository();
  const wallpaperStore = new FileWallpaperStore();
  const imagePicker = new ExpoImagePicker();
  const sound = new ExpoAudioPlayer();
  const soundPicker = new DocumentPickerSoundPicker();
  const alerts = new NativeAlertScheduler();
  const snapshot = new FileSnapshotWriter();

  const draftStore = new SettingsDraftStore(settingsRepository.load());
  const planner = new BackgroundPlanner(clock, snapshot, alerts);

  const getHomeView = new GetHomeViewUseCase(clock, settingsRepository, wallpaperStore, draftStore);
  const openSettings = new OpenSettingsUseCase(settingsRepository, wallpaperStore, draftStore);
  const previewPalette = new PreviewPaletteUseCase(draftStore, wallpaperStore);
  const previewAccent = new PreviewAccentUseCase(draftStore, wallpaperStore);
  const previewColorClock = new PreviewColorClockUseCase(draftStore, wallpaperStore);
  const previewColorNotification = new PreviewColorNotificationUseCase(draftStore, wallpaperStore);
  const previewColorActiveBars = new PreviewColorActiveBarsUseCase(draftStore, wallpaperStore);
  const previewSound = new PreviewSoundUseCase(draftStore, wallpaperStore);
  const previewWallpaperBlur = new PreviewWallpaperBlurUseCase(draftStore, wallpaperStore);
  const previewNotifications = new PreviewNotificationsUseCase(draftStore, wallpaperStore);
  const previewTheme = new PreviewThemeUseCase(draftStore, wallpaperStore);
  const periods = new DraftPeriodsUseCase(draftStore, wallpaperStore);
  const setWeekday = new SetWeekdayUseCase(draftStore, wallpaperStore);
  const clearDay = new ClearDayUseCase(draftStore, wallpaperStore);
  const copyToAllDays = new CopyToAllDaysUseCase(draftStore, wallpaperStore);
  const pickAlarmSound = new PickAlarmSoundUseCase(soundPicker, draftStore, wallpaperStore);
  const clearAlarmSound = new ClearAlarmSoundUseCase(draftStore, wallpaperStore);
  const pickWallpaper = new PickWallpaperUseCase(imagePicker, wallpaperStore, draftStore);
  const removeWallpaper = new RemoveWallpaperUseCase(wallpaperStore, draftStore);
  const saveSettings = new SaveSettingsUseCase(settingsRepository, wallpaperStore, draftStore, planner);
  const closeSettings = new CloseSettingsUseCase(wallpaperStore, draftStore);
  const checkPeriodEnd = new CheckForPeriodEndUseCase(clock, settingsRepository, sound);
  const applyPlan = new ApplyBackgroundPlanUseCase(settingsRepository, planner, sound);

  // Keep the JS-side audio player on the committed ringtone (in-app alerts);
  // the native alarm uses the same URI from the snapshot (closed-app alerts).
  const initialSettings = settingsRepository.load();
  if ("setCustomSource" in sound) {
    (sound as { setCustomSource(uri: string | null): void }).setCustomSource(initialSettings.alarmSoundUri);
  }

  const settingsActions: SettingsActions = {
    previewPalette: (i) => void previewPalette.preview(i),
    previewAccent: (hex) => void previewAccent.preview(hex),
    previewColorClock: (b) => void previewColorClock.preview(b),
    previewColorNotification: (b) => void previewColorNotification.preview(b),
    previewColorActiveBars: (b) => void previewColorActiveBars.preview(b),
    previewSound: (b) => void previewSound.preview(b),
    previewWallpaperBlur: (blur) => void previewWallpaperBlur.preview(blur),
    previewNotifications: (b) => void previewNotifications.preview(b),
    previewTheme: (t) => void previewTheme.preview(t),
    updatePeriod: (id, patch) => void periods.updatePeriod(id, patch),
    moveUp: (i) => void periods.moveUp(i),
    moveDown: (i) => void periods.moveDown(i),
    remove: (i) => void periods.remove(i),
    addPeriod: () => void periods.addDefault(),
    setWeekday: (w) => void setWeekday.setWeekday(w),
    clearDay: () => void clearDay.clearDay(),
    copyToAllDays: () => void copyToAllDays.copyToAllDays(),
    pickAlarmSound: () =>
      void pickAlarmSound.pick().then((vm) => {
        if ("setCustomSource" in sound) {
          (sound as { setCustomSource(uri: string | null): void }).setCustomSource(vm.alarmSoundUri);
        }
      }),
    clearAlarmSound: () => {
      void clearAlarmSound.clear();
      if ("setCustomSource" in sound) {
        (sound as { setCustomSource(uri: string | null): void }).setCustomSource(null);
      }
    },
    pickWallpaper: () => pickWallpaper.pick().then(() => undefined),
    removeWallpaper: () => void removeWallpaper.removeWallpaper(),
    save: () => saveSettings.save(),
    close: () => closeSettings.close(),
  };

  return new PeriodTimerApp({
    getHomeView: () => getHomeView.getHomeView(),
    openSettings: () => void openSettings.open(),
    settingsIsOpen: () => draftStore.isOpen(),
    getDraft: () => openSettings.getDraft(),
    subscribeDraft: (listener) => draftStore.subscribe(listener),
    settingsActions,
    checkPeriodEnd: () => checkPeriodEnd.tick(),
    clock,
    applyPlan,
    audio: sound,
  });
}
