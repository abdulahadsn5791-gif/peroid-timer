import { describe, expect, test } from "bun:test";
import { FakeClock } from "../fakes/FakeClock";
import { InMemorySettingsRepository } from "../fakes/InMemorySettingsRepository";
import { InMemoryWallpaperStore } from "../fakes/InMemoryWallpaperStore";
import { SettingsDraftStore } from "@application/state/SettingsDraftStore";
import { GetHomeViewUseCase } from "@application/use-cases/GetHomeViewUseCase";
import { settingsWith } from "@domain/entities/Settings";

function minutesIntoDay(h: number, m: number): Date {
  return new Date(2026, 8, 20, h, m, 0, 0); // a fixed local day
}

function setup(
  nowMs: number,
  wallpaperUri: string | null = null,
  settings: ReturnType<typeof settingsWith> = settingsWith({ wallpaperUri }),
) {
  const clock = new FakeClock(nowMs);
  const repo = new InMemorySettingsRepository(settings);
  const wall = wallpaperUri != null ? new InMemoryWallpaperStore(wallpaperUri) : new InMemoryWallpaperStore();
  const draft = new SettingsDraftStore(repo.load());
  const uc = new GetHomeViewUseCase(clock, repo, wall, draft);
  return { clock, repo, wall, draft, uc };
}

describe("GetHomeViewUseCase", () => {
  test("during a period: active ring with remaining time + colored phase", () => {
    const { uc } = setup(minutesIntoDay(9, 30).getTime());
    const view = uc.getHomeView();

    expect(view.ring.indicator).toBe("active");
    expect(view.ring.periodName).toBe("Period 2");
    expect(view.ring.timeText).toMatch(/^\d\d:\d\d$/);
    expect(view.ring.statusText).toContain("9:55");
    expect(view.ring.progressElapsed).toBeGreaterThan(0);
    expect(view.ring.ringHex).toBe("#2563EB"); // still >30% left at 9:30 of 9:15-9:55

    const current = view.rows.find((r) => r.status === "current");
    expect(current?.name).toBe("Period 2");
    expect(current?.countdownText).not.toBeNull();
    expect(view.todayLabel).toBe("Sunday, September 20");
  });

  test("tight phase shows the phase-2 red", () => {
    const { uc } = setup(minutesIntoDay(9, 52).getTime());
    const view = uc.getHomeView();
    expect(view.ring.indicator).toBe("active");
    expect(view.ring.periodName).toBe("Period 2");
    expect(view.ring.ringHex).toBe("#DC2626");
    expect(view.ring.progressElapsed).toBeGreaterThan(0.9);
  });

  test("between periods: up-next ring", () => {
    const { uc } = setup(minutesIntoDay(9, 12).getTime());
    const view = uc.getHomeView();
    expect(view.ring.indicator).toBe("between");
    expect(view.ring.periodName).toBe("Up next: Period 2");
    expect(view.ring.ringHex).toBe("#2563EB");
    // The big text is a live ticking countdown with units ("3m 00s" here) —
    // a long "4h 05m 32s" can never be misread as a clock time, and the real
    // start time is on the status line.
    expect(view.ring.timeText).toBe("3m 00s");
    expect(view.ring.statusText).toBe("starts at 09:15");
  });

  test("after the last period: idle state", () => {
    const { uc } = setup(minutesIntoDay(13, 0).getTime());
    const view = uc.getHomeView();
    expect(view.ring.indicator).toBe("idle");
    expect(view.ring.periodName).toBe("All periods complete");
    expect(view.ring).toMatchObject({ clockHex: null, progressElapsed: 0 });
  });

  test("empty schedule shows setup prompt", () => {
    const { uc, repo } = setup(minutesIntoDay(9, 0).getTime());
    repo.save(settingsWith({ periods: [] }));
    const view = uc.getHomeView();
    expect(view.ring.indicator).toBe("idle");
    expect(view.ring.periodName).toBe("No periods set up");
  });

  test("color-clock ON colors phase-0 numbers; OFF keeps them neutral", () => {
    const on = setup(minutesIntoDay(8, 40).getTime(), null, settingsWith({ colorClock: true }));
    expect(on.uc.getHomeView().ring.clockHex).toBe("#2563EB"); // phase 0 at 8:40 of 8:30-9:10

    const off = setup(minutesIntoDay(8, 40).getTime());
    expect(off.uc.getHomeView().ring.clockHex).toBeNull();
  });

  test("wallpaper uri surfaces in the home view", () => {
    const { uc } = setup(minutesIntoDay(9, 0).getTime(), "file:///w.jpg");
    const view = uc.getHomeView();
    expect(view.hasWallpaper).toBe(true);
    expect(view.wallpaperUri).toBe("file:///w.jpg");
  });

  test("live preview overrides palette behind an open settings sheet", () => {
    const { uc, draft } = setup(minutesIntoDay(9, 30).getTime());
    draft.open();
    draft.setPalette(1); // Signal
    const view = uc.getHomeView();
    expect(view.paletteName).toBe("Signal");
    expect(view.ring.ringHex).toBe("#16A34A");
  });
});