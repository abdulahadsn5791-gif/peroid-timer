import { createPeriod, type Period } from "@domain/entities/Period";
import { addMinutes, toHHMM, type TimeOfDay } from "@domain/value-objects/TimeOfDay";
import type { SettingsDraftVM } from "@application/ports/view-models/ViewModels";
import type { DraftPeriodsPort } from "@application/ports/inbound/DraftPeriodsPort";
import type { WallpaperStorePort } from "@application/ports/outbound/WallpaperStorePort";
import { SettingsDraftStore } from "@application/state/SettingsDraftStore";
import { draftVmFromStore } from "./OpenSettingsUseCase";

function vm(store: SettingsDraftStore, wallpaper: WallpaperStorePort): SettingsDraftVM {
  return draftVmFromStore(store, wallpaper);
}

export class DraftPeriodsUseCase implements DraftPeriodsPort {
  /**
   * Monotonic suffix for generated ids. Seeded lazily from the ids already in
   * the draft so a restart can never re-issue `draft-1` for a period that was
   * added in an earlier session and persisted — duplicate ids make the editor
   * open two cards at once and patch both of them.
   */
  private nextId = 1;

  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}

  updatePeriod(id: string, patch: { name?: string; start?: string; end?: string; teacher?: string | null; room?: string | null }): SettingsDraftVM {
    this.draftStore.updatePeriod(id, patch);
    return vm(this.draftStore, this.wallpaper);
  }

  moveUp(index: number): SettingsDraftVM {
    this.draftStore.moveUp(index);
    return vm(this.draftStore, this.wallpaper);
  }

  moveDown(index: number): SettingsDraftVM {
    this.draftStore.moveDown(index);
    return vm(this.draftStore, this.wallpaper);
  }

  remove(index: number): SettingsDraftVM {
    this.draftStore.remove(index);
    return vm(this.draftStore, this.wallpaper);
  }

  addDefault(): SettingsDraftVM {
    const draft = this.draftStore.getDraft();
    const day = draft.weekSchedule[draft.weekday] ?? [];
    const last = day[day.length - 1];
    const start: TimeOfDay = last ? last.end : addMinutes({ minutes: 8 * 60 + 30 }, 0);
    const end = addMinutes(start, 40);
    // Period numbers are 1-based; name gets a fresh id.
    const existingNames = new Set(day.map((p) => p.name));
    let name = `Period ${day.length + 1}`;
    let guard = 0;
    while (existingNames.has(name) && guard < 100) {
      guard++;
      name = `Period ${day.length + 1 + guard}`;
    }
    const period = createPeriod(this.freshId(draft.weekSchedule), name, toHHMM(start), toHHMM(end));
    // New periods start without teacher/room; the user fills them in the row's
    // detail fields. This comment keeps the intent explicit.
    void period.teacher;
    void period.room;
    this.draftStore.addPeriod(period);
    return vm(this.draftStore, this.wallpaper);
  }

  /**
   * A `draft-N` id that is not in use anywhere in the timetable. Ids must be
   * unique across the whole week, not just within one day: the editor tracks
   * the open card by id alone, and the store's `updatePeriod` matches on id.
   */
  private freshId(schedule: readonly (readonly Period[])[]): string {
    const taken = new Set(schedule.flat().map((p) => p.id));
    let candidate = `draft-${this.nextId}`;
    while (taken.has(candidate)) candidate = `draft-${++this.nextId}`;
    this.nextId = Number(candidate.slice("draft-".length)) + 1;
    return candidate;
  }
}
