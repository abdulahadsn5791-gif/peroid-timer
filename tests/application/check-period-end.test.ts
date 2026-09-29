import { describe, expect, test } from "bun:test";
import { FakeClock } from "../fakes/FakeClock";
import { InMemorySettingsRepository } from "../fakes/InMemorySettingsRepository";
import { FakeSound } from "../fakes/FakeSound";
import { CheckForPeriodEndUseCase } from "@application/use-cases/CheckForPeriodEndUseCase";
import { createPeriod } from "@domain/entities/Period";
import { settingsWith } from "@domain/entities/Settings";

function at(h: number, m: number, s = 0): Date {
  return new Date(2026, 8, 20, h, m, s, 0); // Sunday, Sep 20 2026 → weekday 0
}

function setup(nowMs: number, soundEnabled = true, notificationsEnabled = true) {
  const clock = new FakeClock(nowMs);
  const period = createPeriod("p1", "Math", "08:00", "08:30");
  const repo = new InMemorySettingsRepository(
    settingsWith({ periods: [period], soundEnabled, notificationsEnabled }),
  );
  const sound = new FakeSound();
  const uc = new CheckForPeriodEndUseCase(clock, repo, sound);
  return { clock, repo, sound, uc };
}

describe("CheckForPeriodEndUseCase", () => {
  test("reports the period that just ended", async () => {
    const { uc, repo } = setup(at(8, 30, 0).getTime());
    const result = await uc.tick();

    expect(result.justEnded).toBe(true);
    expect(result.periodName).toBe("Math");
    expect(repo.load().lastNotifiedKey).toBe("0:p1");
  });

  test("does not refire on later ticks", async () => {
    const { uc, clock } = setup(at(8, 30, 0).getTime());
    await uc.tick();
    clock.setNow(at(8, 30, 1).getTime());
    const result = await uc.tick();
    expect(result.justEnded).toBe(false);
  });

  test("no event mid-period", async () => {
    const { uc } = setup(at(8, 10, 0).getTime());
    const result = await uc.tick();
    expect(result.justEnded).toBe(false);
  });

  // The tone is owned by the native alarm channel. A JS copy meant two
  // overlapping sounds, and only the native one could be stopped from the
  // notification action, so the JS tone rang with no way to silence it.
  test("never plays a tone from JS, whatever the toggles say", async () => {
    for (const [sound, notifications] of [
      [true, true],
      [false, true],
      [true, false],
      [false, false],
    ]) {
      const { uc, sound: fake } = setup(at(8, 30, 0).getTime(), sound, notifications);
      await uc.tick();
      expect(fake.playCount).toBe(0);
    }
  });

  test("stop() silences a ringing alarm", async () => {
    const { uc, sound } = setup(at(8, 30, 0).getTime());
    await uc.tick();
    await uc.stop();
    expect(sound.stopCount).toBe(1);
  });
});
