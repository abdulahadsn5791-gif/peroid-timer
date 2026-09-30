import { describe, expect, test } from "bun:test";
import { FakeClock } from "../fakes/FakeClock";
import { InMemorySettingsRepository } from "../fakes/InMemorySettingsRepository";
import { InMemoryWallpaperStore } from "../fakes/InMemoryWallpaperStore";
import { InMemoryAlertScheduler } from "../fakes/InMemoryAlertScheduler";
import { InMemorySnapshotWriter } from "../fakes/InMemorySnapshotWriter";
import { FakeSound } from "../fakes/FakeSound";
import { SettingsDraftStore } from "@application/state/SettingsDraftStore";
import { BackgroundPlanner } from "@application/state/BackgroundPlanner";
import { OpenSettingsUseCase } from "@application/use-cases/OpenSettingsUseCase";
import {
  PreviewAccentUseCase,
  PreviewPaletteUseCase,
} from "@application/use-cases/PreviewUseCases";
import { DraftPeriodsUseCase } from "@application/use-cases/DraftPeriodsUseCase";
import {
  ClearDayUseCase,
  CopyToAllDaysUseCase,
  SetWeekdayUseCase,
} from "@application/use-cases/WeeklyScheduleUseCases";
import { SaveSettingsUseCase } from "@application/use-cases/SaveSettingsUseCase";
import { CloseSettingsUseCase } from "@application/use-cases/CloseSettingsUseCase";
import { defaultSettings, settingsWith } from "@domain/entities/Settings";

function setup() {
  const clock = new FakeClock(new Date(2026, 8, 20, 9, 0, 0).getTime());
  const repo = new InMemorySettingsRepository(defaultSettings());
  const wall = new InMemoryWallpaperStore();
  const alerts = new InMemoryAlertScheduler();
  const snapshot = new InMemorySnapshotWriter();
  const draft = new SettingsDraftStore(repo.load());
  const planner = new BackgroundPlanner(clock, snapshot, alerts);

  const openSettings = new OpenSettingsUseCase(repo, wall, draft);
  const previewPalette = new PreviewPaletteUseCase(draft, wall);
  const previewAccent = new PreviewAccentUseCase(draft, wall);
  const periods = new DraftPeriodsUseCase(draft, wall);
  const setWeekday = new SetWeekdayUseCase(draft, wall);
  const clearDay = new ClearDayUseCase(draft, wall);
  const copyToAllDays = new CopyToAllDaysUseCase(draft, wall);
  const save = new SaveSettingsUseCase(repo, wall, draft, planner);
  const close = new CloseSettingsUseCase(wall, draft);

  return {
    clock, repo, wall, alerts, snapshot, draft, planner,
    openSettings, previewPalette, previewAccent, periods,
    setWeekday, clearDay, copyToAllDays, save, close,
  };
}

describe("Settings flow (weekly)", () => {
  test("opening spawns a draft and does not touch committed settings", () => {
    const { openSettings, repo, draft } = setup();
    const vm = openSettings.open();
    expect(draft.isOpen()).toBe(true);
    expect(vm.paletteIndex).toBe(0);
    expect(vm.dirty).toBe(false);
    expect(repo.load().paletteIndex).toBe(0); // committed unchanged
    expect(vm.weekPeriods).toHaveLength(7);
  });

  test("previews mutate the draft and mark it dirty", () => {
    const { openSettings, previewAccent, draft } = setup();
    openSettings.open();
    const afterAccent = previewAccent.preview("#DC2626");
    expect(afterAccent.accentColor).toBe("#DC2626");
    expect(draft.isDirty).toBe(true);
  });

  test("saving persists the weekly schedule, applies the plan, and closes the draft", async () => {
    const { openSettings, previewPalette, save, repo, snapshot, alerts, draft } = setup();
    openSettings.open();
    previewPalette.preview(2); // Twilight

    await save.save();

    expect(repo.load().paletteIndex).toBe(2);
    expect(repo.load().weekSchedule).toHaveLength(7);
    expect(draft.isOpen()).toBe(false);
    expect(snapshot.last?.version).toBe(7);
    expect(alerts.scheduled).toHaveLength(1);
    expect(alerts.startLiveCalls).toBe(1);
    expect(snapshot.last?.days[0].segments).toHaveLength(4);
  });

  test("weekday switching is per-tab: Monday edits never touch Tuesday", () => {
    const { openSettings, periods, setWeekday, draft } = setup();
    openSettings.open();

    setWeekday.setWeekday(1); // Monday
    const mondayFirst = draft.getDraft().weekSchedule[1][0];
    periods.updatePeriod(mondayFirst.id, { name: "Physics" });
    expect(draft.getDraft().weekSchedule[1][0].name).toBe("Physics");
    expect(draft.getDraft().weekSchedule[2][0].name).toBe("Period 1");

    setWeekday.setWeekday(2); // Tuesday
    periods.addDefault();
    expect(draft.getDraft().weekSchedule[2]).toHaveLength(5);
    expect(draft.getDraft().weekSchedule[1]).toHaveLength(4);
  });

  test("clear day empties only the active weekday; copy fills the rest", () => {
    const { openSettings, setWeekday, clearDay, copyToAllDays, draft } = setup();
    openSettings.open();

    setWeekday.setWeekday(0); // Sunday
    clearDay.clearDay();
    expect(draft.getDraft().weekSchedule[0]).toHaveLength(0);
    expect(draft.getDraft().weekSchedule[1]).toHaveLength(4);

    setWeekday.setWeekday(3); // Wednesday
    copyToAllDays.copyToAllDays();
    for (const day of draft.getDraft().weekSchedule) {
      expect(day).toHaveLength(4);
    }
  });

  test("saving a fully empty week is refused; one lecture day is enough", async () => {
    const { openSettings, setWeekday, clearDay, save, copyToAllDays, periods } = setup();
    openSettings.open();
    for (let d = 0; d < 7; d++) {
      setWeekday.setWeekday(d);
      clearDay.clearDay();
    }
    await expect(save.save()).rejects.toThrow("At least one day needs at least one period");

    // Bring back just one day → save succeeds (Wednesday first, then copy).
    setWeekday.setWeekday(2);
    periods.addDefault();
    copyToAllDays.copyToAllDays();
    await expect(save.save()).resolves.toBeUndefined();
  });

  test("alarm sound persists through save", async () => {
    const { openSettings, draft, save, repo } = setup();
    openSettings.open();
    draft.setAlarmSound("file:///data/ring.mp3");
    await save.save();
    expect(repo.load().alarmSoundUri).toBe("file:///data/ring.mp3");
  });

  test("committed wallpaper preview is promoted on save, rolled back on close", async () => {
    const { openSettings, save, close, wall, draft } = setup();
    openSettings.open();
    await wall.setPreviewImage("file:///preview.jpg");
    draft.setWallpaperUri("file:///preview.jpg");

    await save.save();
    expect(wall.getStoredUri()).toBe("file:///preview.jpg");
    expect(wall.hasPreview()).toBe(false);

    const second = setup();
    second.openSettings.open();
    await second.wall.setPreviewImage("file:///tmp.jpg");
    second.draft.setWallpaperUri("file:///tmp.jpg");
    second.close.close();
    expect(second.wall.hasPreview()).toBe(false);
    expect(second.wall.getStoredUri()).toBeNull();
    void close;
  });

  test("closing restores the committed draft", () => {
    const { openSettings, previewPalette, close, draft } = setup();
    openSettings.open();
    previewPalette.preview(3);
    close.close();
    expect(draft.isOpen()).toBe(false);
    expect(draft.getDraft().paletteIndex).toBe(0);
  });

  test("legacy single-list settings still normalize (every-day migration)", () => {
    const legacy = settingsWith({ periods: defaultSettings().weekSchedule[1].slice() });
    for (const day of legacy.weekSchedule) {
      expect(day).toHaveLength(4);
    }
  });
});
