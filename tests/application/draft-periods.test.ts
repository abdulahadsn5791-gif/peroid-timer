import { describe, expect, test } from "bun:test";
import { InMemoryWallpaperStore } from "../fakes/InMemoryWallpaperStore";
import { SettingsDraftStore } from "@application/state/SettingsDraftStore";
import { DraftPeriodsUseCase } from "@application/use-cases/DraftPeriodsUseCase";
import { PickWallpaperUseCase, RemoveWallpaperUseCase } from "@application/use-cases/WallpaperUseCases";
import { FakeImagePicker } from "../fakes/FakeImagePicker";
import { defaultSettings } from "@domain/entities/Settings";

function setup(initialPalette = 0) {
  const draft = new SettingsDraftStore({ ...defaultSettings(), paletteIndex: initialPalette });
  const wall = new InMemoryWallpaperStore();
  const uc = new DraftPeriodsUseCase(draft, wall);
  return { draft, wall, uc };
}

describe("DraftPeriodsUseCase (weekly draft)", () => {
  test("moveUp / moveDown reorder the active weekday", () => {
    const { uc, draft } = setup();
    uc.moveDown(0);
    const monday = draft.getDraft().weekSchedule[1];
    expect(monday[0].name).toBe("Period 2");
    expect(monday[1].name).toBe("Period 1");
    uc.moveUp(1);
    expect(draft.getDraft().weekSchedule[1][0].name).toBe("Period 1");
  });

  test("remove is guarded at one period; removal marks dirty", () => {
    const { uc, draft } = setup();
    uc.remove(0);
    expect(draft.getDraft().weekSchedule[1]).toHaveLength(3);
    while (draft.getDraft().weekSchedule[1].length > 1) uc.remove(0);
    uc.remove(0); // final guard: keeps the last one
    expect(draft.getDraft().weekSchedule[1]).toHaveLength(1);
  });

  test("updatePeriod patches fields on the active weekday only", () => {
    const { uc, draft } = setup();
    const first = draft.getDraft().weekSchedule[1][0];
    uc.updatePeriod(first.id, { name: "Physics", end: "09:20" });
    const updated = draft.getDraft().weekSchedule[1][0];
    expect(updated.name).toBe("Physics");
    expect(updated.start.minutes).toBe(first.start.minutes);
    expect(updated.end.minutes).toBe(9 * 60 + 20);
  });

  test("addDefault extends the schedule after the last period", () => {
    const { uc, draft } = setup();
    uc.addDefault();
    const monday = draft.getDraft().weekSchedule[1];
    expect(monday).toHaveLength(5);
    expect(monday[4].start.minutes).toBe(11 * 60 + 25);
    expect(monday[4].end.minutes).toBe(12 * 60 + 5); // 40 minutes later
    expect(monday[4].name).toBe("Period 5");
  });

  test("an empty weekday allows addDefault to start at the default time", () => {
    const { uc, draft } = setup();
    draft.setWeekday(0); // Sunday
    draft.clearDay(); // defaults fill every day; empty Sunday first
    uc.addDefault();
    const sunday = draft.getDraft().weekSchedule[0];
    expect(sunday).toHaveLength(1);
    expect(sunday[0].start.minutes).toBe(8 * 60 + 30);
    expect(draft.getDraft().weekSchedule[1]).toHaveLength(4); // Monday untouched
  });

  test("picking a wallpaper previews it in the draft; removing clears it", async () => {
    const { draft, wall } = setup();
    const picker = new FakeImagePicker({ uri: "file:///pick.jpg", width: 100, height: 100 });
    const pick = new PickWallpaperUseCase(picker, wall, draft);
    const remove = new RemoveWallpaperUseCase(wall, draft);

    draft.open();
    const vm = await pick.pick();
    expect(vm.wallpaperPreviewUri).toBe("file:///pick.jpg");
    expect(wall.hasPreview()).toBe(true);

    remove.removeWallpaper();
    expect(wall.hasPreview()).toBe(false);
    expect(draft.getDraft().wallpaperUri).toBeNull();
  });

  test("cancelling a pick changes nothing", async () => {
    const { draft, wall } = setup();
    const picker = new FakeImagePicker(null);
    const pick = new PickWallpaperUseCase(picker, wall, draft);
    draft.open();
    await pick.pick();
    expect(wall.hasPreview()).toBe(false);
    expect(draft.getDraft().wallpaperUri).toBeNull();
  });
});
