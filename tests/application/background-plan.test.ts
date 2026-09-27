import { describe, expect, test } from "bun:test";
import { FakeClock } from "../fakes/FakeClock";
import { InMemoryAlertScheduler } from "../fakes/InMemoryAlertScheduler";
import { InMemorySnapshotWriter } from "../fakes/InMemorySnapshotWriter";
import { InMemorySettingsRepository } from "../fakes/InMemorySettingsRepository";
import { FakeSound } from "../fakes/FakeSound";
import { BackgroundPlanner } from "@application/state/BackgroundPlanner";
import { ApplyBackgroundPlanUseCase } from "@application/use-cases/ApplyBackgroundPlanUseCase";
import { defaultSettings } from "@domain/entities/Settings";

function setup() {
  const clock = new FakeClock(new Date(2026, 8, 20, 9, 0, 0).getTime());
  const snapshot = new InMemorySnapshotWriter();
  const alerts = new InMemoryAlertScheduler();
  const repo = new InMemorySettingsRepository(defaultSettings());
  return { clock, snapshot, alerts, repo };
}

describe("Background plan", () => {
  test("BackgroundPlanner.apply writes the snapshot, schedules alarms, and starts live notification", async () => {
    const { clock, snapshot, alerts, repo } = setup();
    const planner = new BackgroundPlanner(clock, snapshot, alerts);
    await planner.apply(repo.load());

    expect(snapshot.last?.version).toBe(4);
    expect(snapshot.last?.boundaryUnixSec).toBe(clock.todayBoundaryEpochSec());
    expect(alerts.scheduled).toHaveLength(1);
    expect(alerts.startLiveCalls).toBe(1);
    expect(alerts.scheduled[0].segments[0].startUnixSec).toBe(
      clock.todayBoundaryEpochSec() + (8 * 60 + 30) * 60,
    );
  });

  test("ApplyBackgroundPlanUseCase.run also preloads the sound", async () => {
    const { clock, snapshot, alerts, repo } = setup();
    const sound = new FakeSound();
    const planner = new BackgroundPlanner(clock, snapshot, alerts);
    const uc = new ApplyBackgroundPlanUseCase(repo, planner, sound);

    await uc.run();

    expect(snapshot.last).not.toBeNull();
    expect(alerts.scheduled).toHaveLength(1);
    expect(alerts.startLiveCalls).toBe(1);
    expect(sound.prepareCount).toBe(1);
  });
});