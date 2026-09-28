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

function setup(nowMs: number, soundEnabled = true) {
  const clock = new FakeClock(nowMs);
  const period = createPeriod("p1", "Math", "08:00", "08:30");
  const repo = new InMemorySettingsRepository(
    settingsWith({ periods: [period], soundEnabled }),
  );
  const sound = new FakeSound();
  const uc = new CheckForPeriodEndUseCase(clock, repo, sound);
  return { clock, repo, sound, uc };
}

describe("CheckForPeriodEndUseCase", () => {
  test("fires once with sound when a period just ended", async () => {
    const { uc, repo, sound } = setup(at(8, 30, 0).getTime());
    const result = await uc.tick();

    expect(result.justEnded).toBe(true);
    expect(result.periodName).toBe("Math");
    expect(sound.playCount).toBe(1);
    expect(repo.load().lastNotifiedKey).toBe("0:p1");
  });

  test("does not refire on later ticks", async () => {
    const { uc, clock, sound } = setup(at(8, 30, 0).getTime());
    await uc.tick();
    clock.setNow(at(8, 30, 1).getTime());
    const result = await uc.tick();
    expect(result.justEnded).toBe(false);
    expect(sound.playCount).toBe(1);
  });

  test("stays silent when sound is disabled", async () => {
    const { uc, sound } = setup(at(8, 30, 0).getTime(), false);
    const result = await uc.tick();
    expect(result.justEnded).toBe(true);
    expect(sound.playCount).toBe(0);
  });

  test("no event mid-period", async () => {
    const { uc } = setup(at(8, 10, 0).getTime());
    const result = await uc.tick();
    expect(result.justEnded).toBe(false);
  });
});
