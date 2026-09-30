import { describe, expect, test } from "bun:test";
import { FakeClock } from "../fakes/FakeClock";
import { InMemoryAlertScheduler } from "../fakes/InMemoryAlertScheduler";
import { InMemorySnapshotWriter } from "../fakes/InMemorySnapshotWriter";
import { InMemorySettingsRepository } from "../fakes/InMemorySettingsRepository";
import { FakeSound } from "../fakes/FakeSound";
import { BackgroundPlanner } from "@application/state/BackgroundPlanner";
import { ApplyBackgroundPlanUseCase } from "@application/use-cases/ApplyBackgroundPlanUseCase";
import { defaultSettings, settingsWith } from "@domain/entities/Settings";
import { weekScheduleFromFactory } from "@domain/entities/WeekSchedule";

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

    expect(snapshot.last?.version).toBe(7);
    expect(snapshot.last?.days).toHaveLength(8);
    expect(snapshot.last?.days[0].weekday).toBe(clock.todayParts().weekday);
    expect(alerts.scheduled).toHaveLength(1);
    expect(alerts.endAlerts).toHaveLength(1);
    expect(alerts.startLiveCalls).toBe(1);
    expect(alerts.stopLiveCalls).toBe(0);
    expect(snapshot.last?.days[0].segments[0].startUnixSec).toBe(
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

  test("empty preset day: snapshot has no segments and the live notification stops", async () => {
    const { clock, snapshot, alerts, repo } = setup();
    // Today (Sep 20, 2026 = Sunday, weekday 0) has no lectures.
    const today = clock.todayParts().weekday;
    const emptyToday = weekScheduleFromFactory((d) => (d === today ? [] : defaultSettings().weekSchedule[d]));
    repo.save(settingsWith({ weekSchedule: emptyToday }));

    const planner = new BackgroundPlanner(clock, snapshot, alerts);
    await planner.apply(repo.load());

    expect(snapshot.last?.days[0].segments).toHaveLength(0);
    expect(snapshot.last?.days[0].weekday).toBe(today);
    expect(alerts.stopLiveCalls).toBe(1);
    expect(alerts.startLiveCalls).toBe(0);
    expect(alerts.endAlerts[0]?.days[0].segments).toHaveLength(0);
  });
});
