import { createPeriod } from "@domain/entities/Period";
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
  private nextId = 1;

  constructor(private readonly draftStore: SettingsDraftStore, private readonly wallpaper: WallpaperStorePort) {}

  updatePeriod(id: string, patch: { name?: string; start?: string; end?: string }): SettingsDraftVM {
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
    const period = createPeriod(`draft-${this.nextId++}`, name, toHHMM(start), toHHMM(end));
    this.draftStore.addPeriod(period);
    return vm(this.draftStore, this.wallpaper);
  }
}
