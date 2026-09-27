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
  const save = new SaveSettingsUseCase(repo, wall, draft, planner);
  const close = new CloseSettingsUseCase(wall, draft);

  return { clock, repo, wall, alerts, snapshot, draft, planner, openSettings, previewPalette, previewAccent, save, close };
}

describe("Settings flow", () => {
  test("opening spawns a draft and does not touch committed settings", () => {
    const { openSettings, repo, draft } = setup();
    const vm = openSettings.open();
    expect(draft.isOpen()).toBe(true);
    expect(vm.paletteIndex).toBe(0);
    expect(vm.dirty).toBe(false);
    expect(repo.load().paletteIndex).toBe(0); // committed unchanged
  });

  test("previews mutate the draft and mark it dirty", () => {
    const { openSettings, previewAccent, draft } = setup();
    openSettings.open();
    const afterAccent = previewAccent.preview("#DC2626");
    expect(afterAccent.accentColor).toBe("#DC2626");
    expect(draft.isDirty).toBe(true);
  });

  test("saving persists, applies the background plan, and closes the draft", async () => {
    const { openSettings, previewPalette, save, repo, snapshot, alerts, draft } = setup();
    openSettings.open();
    previewPalette.preview(2); // Twilight

    await save.save();

    expect(repo.load().paletteIndex).toBe(2);
    expect(draft.isOpen()).toBe(false);
    expect(snapshot.last?.version).toBe(4);
    expect(alerts.scheduled).toHaveLength(1);
    expect(alerts.startLiveCalls).toBe(1);
    expect(snapshot.last?.segments).toHaveLength(4);
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

  test("switching lock-screen presence is gone; saving always keeps alarms + live notification", async () => {
    const { openSettings, save, alerts } = setup();
    openSettings.open();
    await save.save();
    expect(alerts.scheduled).toHaveLength(1);
    expect(alerts.startLiveCalls).toBe(1);
    expect(alerts.stopLiveCalls).toBe(0);
  });

  test("saving an empty period list is refused", async () => {
    const { repo, save, draft, openSettings } = setup();
    repo.save(settingsWith({ periods: [] }));
    draft.commitFromSettings(repo.load());
    openSettings.open();
    await expect(save.save()).rejects.toThrow("At least one period is required");
  });

  test("closing restores the committed draft", () => {
    const { openSettings, previewPalette, close, draft } = setup();
    openSettings.open();
    previewPalette.preview(3);
    close.close();
    expect(draft.isOpen()).toBe(false);
    expect(draft.getDraft().paletteIndex).toBe(0);
  });

  test("settingsWith and defaultSettings used elsewhere", () => {
    expect(settingsWith({}).soundEnabled).toBe(true);
    expect(defaultSettings().soundEnabled).toBe(true);
  });
});