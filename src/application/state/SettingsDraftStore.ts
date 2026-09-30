import {
  clampBlur,
  clampRingSizeScale,
  normalizeSettings,
  type AppTheme,
  type Settings,
} from "@domain/entities/Settings";
import {
  normalizeOptionalHex,
  withSwatch,
  type CustomRingColors,
  type HexColor,
} from "@domain/value-objects/CustomColors";
import { clonePeriod, createPeriod, type Period } from "@domain/entities/Period";
import {
  cloneWeekSchedule,
  periodsFor,
  weekdayOf,
  type WeekSchedule,
  type Weekday,
} from "@domain/entities/WeekSchedule";
import { parseTimeHHMM, toHHMM, minutesOfDayToLabel } from "@domain/value-objects/TimeOfDay";
import { normalizeAccentColor } from "@domain/value-objects/AccentColor";

/**
 * Transient settings-shell state. The draft is a deep copy of the committed
 * settings; "Save & apply" commits it through the repository + alerts/snapshot
 * adapters, "close" reverts to the committed value. Native wallpapers are
 * handled by WallpaperStorePort; here we only remember the intended uri.
 *
 * The draft is weekly: `weekday` is the tab being edited; every draft mutation
 * targets that day's period list only.
 */
export interface DraftSnapshot {
  accentColor: string;
  paletteIndex: number;
  customRingColors: CustomRingColors;
  homeBgColor: HexColor | null;
  savedSwatches: HexColor[];
  /** Clock ring size as a percent of the layout default: 60..130. */
  ringSizeScale: number;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  colorClock: boolean;
  colorNotification: boolean;
  colorActiveBars: boolean;
  wallpaperBlur: number;
  wallpaperUri: string | null;
  /** Base look for the no-wallpaper home screen (wallpaper mode stays glassy). */
  theme: AppTheme;
  alarmSoundUri: string | null;
  /** 0 = Sunday … 6 = Saturday — the weekday tab being edited. */
  weekday: Weekday;
  weekSchedule: WeekSchedule;
}

export class SettingsDraftStore {
  private committed: Settings;
  private draft: DraftSnapshot;
  private opened = false;
  private dirty = false;
  private listeners = new Set<() => void>();

  constructor(initial: Settings) {
    this.committed = normalizeSettings(initial);
    this.draft = this.snapshotFrom(this.committed);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  private snapshotFrom(s: Settings): DraftSnapshot {
    return {
      accentColor: s.accentColor,
      paletteIndex: s.paletteIndex,
      customRingColors: { ...s.customRingColors },
      homeBgColor: s.homeBgColor,
      savedSwatches: [...s.savedSwatches],
      ringSizeScale: s.ringSizeScale,
      soundEnabled: s.soundEnabled,
      notificationsEnabled: s.notificationsEnabled,
      colorClock: s.colorClock,
      colorNotification: s.colorNotification,
      colorActiveBars: s.colorActiveBars,
      wallpaperBlur: s.wallpaperBlur,
      wallpaperUri: s.wallpaperUri,
      theme: s.theme,
      alarmSoundUri: s.alarmSoundUri,
      weekday: 1,
      weekSchedule: cloneWeekSchedule(s.weekSchedule),
    };
  }

  open(): void {
    this.draft = this.snapshotFrom(this.committed);
    this.opened = true;
    this.dirty = false;
    this.notify();
  }

  openWithWallpaper(uri: string | null): void {
    this.draft = this.snapshotFrom(this.committed);
    this.draft.wallpaperUri = uri;
    this.opened = true;
    this.dirty = false;
    this.notify();
  }

  close(): void {
    this.draft = this.snapshotFrom(this.committed);
    this.opened = false;
    this.dirty = false;
    this.notify();
  }

  commitFromSettings(s: Settings): void {
    this.committed = normalizeSettings(s);
    this.draft = this.snapshotFrom(this.committed);
    this.opened = false;
    this.dirty = false;
    this.notify();
  }

  isOpen(): boolean {
    return this.opened;
  }

  isLoadingDraft(): boolean {
    return this.opened;
  }

  getDraft(): DraftSnapshot {
    return { ...this.draft, weekSchedule: cloneWeekSchedule(this.draft.weekSchedule) };
  }

  getCommitted(): Settings {
    return normalizeSettings(this.committed);
  }

  markDirty(): void {
    this.dirty = true;
  }

  get isDirty(): boolean {
    return this.dirty;
  }

  /** Draft values used by the home view so palette / accent / wallpaper / color-clock previews render live behind the settings sheet. */
  effectiveOverrides(): {
    accentColor: string;
    paletteIndex: number;
    customRingColors: CustomRingColors;
    homeBgColor: HexColor | null;
    ringSizeScale: number;
    colorClock: boolean;
    colorActiveBars: boolean;
    wallpaperBlur: number;
    wallpaperUri: string | null;
    theme: AppTheme;
    weekSchedule: WeekSchedule;
  } | null {
    if (!this.opened) return null;
    return {
      accentColor: this.draft.accentColor,
      paletteIndex: this.draft.paletteIndex,
      customRingColors: { ...this.draft.customRingColors },
      homeBgColor: this.draft.homeBgColor,
      ringSizeScale: this.draft.ringSizeScale,
      colorClock: this.draft.colorClock,
      colorActiveBars: this.draft.colorActiveBars,
      wallpaperBlur: this.draft.wallpaperBlur,
      wallpaperUri: this.draft.wallpaperUri,
      theme: this.draft.theme,
      weekSchedule: this.draft.weekSchedule,
    };
  }

  // --- draft mutations (called by use cases) ---

  setAccent(hex: string): void {
    this.draft.accentColor = normalizeAccentColor(hex);
    this.dirty = true;
    this.notify();
  }

  setPalette(index: number): void {
    this.draft.paletteIndex = index;
    this.dirty = true;
    this.notify();
  }

  setRingPhaseColor(phase: 0 | 1 | 2, hex: string | null): void {
    const key = ("phase" + phase) as keyof CustomRingColors;
    this.draft.customRingColors = {
      ...this.draft.customRingColors,
      [key]: normalizeOptionalHex(hex),
    };
    this.dirty = true;
    this.notify();
  }

  setHomeBgColor(hex: string | null): void {
    this.draft.homeBgColor = normalizeOptionalHex(hex);
    this.dirty = true;
    this.notify();
  }

  /** Records a picked color in the swatch list (deduped) and notifies. */
  saveSwatch(hex: string): void {
    const normalized = normalizeOptionalHex(hex);
    if (!normalized) return;
    this.draft.savedSwatches = withSwatch(this.draft.savedSwatches, normalized);
    this.dirty = true;
    this.notify();
  }

  setRingSizeScale(scale: number): void {
    this.draft.ringSizeScale = clampRingSizeScale(scale);
    this.dirty = true;
    this.notify();
  }

  setColorClock(enabled: boolean): void {
    this.draft.colorClock = enabled;
    this.dirty = true;
    this.notify();
  }

  setColorNotification(enabled: boolean): void {
    this.draft.colorNotification = enabled;
    this.dirty = true;
    this.notify();
  }

  setColorActiveBars(enabled: boolean): void {
    this.draft.colorActiveBars = enabled;
    this.dirty = true;
    this.notify();
  }

  setNotificationsEnabled(enabled: boolean): void {
    this.draft.notificationsEnabled = enabled;
    this.dirty = true;
    this.notify();
  }

  setSound(enabled: boolean): void {
    this.draft.soundEnabled = enabled;
    this.dirty = true;
    this.notify();
  }

  setAlarmSound(uri: string | null): void {
    this.draft.alarmSoundUri = uri;
    this.dirty = true;
    this.notify();
  }

  setWallpaperBlur(blur: number): void {
    this.draft.wallpaperBlur = clampBlur(blur);
    this.dirty = true;
    this.notify();
  }

  setWallpaperUri(uri: string | null): void {
    this.draft.wallpaperUri = uri;
    this.dirty = true;
    this.notify();
  }

  setTheme(theme: AppTheme): void {
    this.draft.theme = theme;
    this.dirty = true;
    this.notify();
  }

  /** Switches the weekday tab being edited (does not mark dirty by itself). */
  setWeekday(weekday: number): void {
    this.draft.weekday = weekdayOf(weekday);
    this.notify();
  }

  private dayPeriods(): Period[] {
    return this.draft.weekSchedule[this.draft.weekday];
  }

  updatePeriod(id: string, patch: { name?: string; start?: string; end?: string; teacher?: string | null; room?: string | null }): void {
    let changed = false;
    this.draft.weekSchedule = this.draft.weekSchedule.map((day, i) => {
      if (i !== this.draft.weekday) return day;
      // Stop at the FIRST match. A legacy timetable can still hold two periods
      // with the same id, and patching both would edit the wrong lecture too.
      if (changed) return day;
      return day.map((p, index) => {
        if (p.id !== id) return p;
        changed = true;
        const next: Period = { id: p.id, name: p.name, start: p.start, end: p.end, teacher: p.teacher, room: p.room };
        if (patch.name !== undefined) next.name = patch.name.trim() || `Period ${index + 1}`;
        if (patch.start !== undefined) next.start = parseTimeHHMM(patch.start);
        if (patch.end !== undefined) next.end = parseTimeHHMM(patch.end);
        if (patch.teacher !== undefined) next.teacher = patch.teacher?.trim() || null;
        if (patch.room !== undefined) next.room = patch.room?.trim() || null;
        return next;
      });
    });
    if (!changed) return;
    this.dirty = true;
    this.notify();
  }

  moveUp(index: number): void {
    const day = this.dayPeriods();
    if (index <= 0 || index >= day.length) return;
    const arr = [...day];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    this.replaceDay(arr);
  }

  moveDown(index: number): void {
    const day = this.dayPeriods();
    if (index < 0 || index >= day.length - 1) return;
    const arr = [...day];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    this.replaceDay(arr);
  }

  remove(index: number): void {
    const day = this.dayPeriods();
    if (day.length <= 1) return;
    this.replaceDay(day.filter((_, i) => i !== index));
  }

  addPeriod(newPeriod: Period): void {
    this.replaceDay([...this.dayPeriods(), newPeriod]);
  }

  /** Empties the active weekday — the "no lectures today" preset. */
  clearDay(): void {
    this.replaceDay([]);
  }

  /** Copies the active weekday's periods to every other day (independent clones). */
  copyToAllDays(): void {
    const source = this.dayPeriods();
    this.draft.weekSchedule = this.draft.weekSchedule.map((day, i) =>
      i === this.draft.weekday ? day : source.map(clonePeriod),
    );
    this.dirty = true;
    this.notify();
  }

  private replaceDay(periods: Period[]): void {
    this.draft.weekSchedule = this.draft.weekSchedule.map((day, i) =>
      i === this.draft.weekday ? periods : day,
    );
    this.dirty = true;
    this.notify();
  }

  toDraftPeriodVM() {
    return periodsFor(this.draft.weekSchedule, this.draft.weekday).map((p) => ({
      id: p.id,
      name: p.name,
      start: toHHMM(p.start),
      end: toHHMM(p.end),
      startLabel: minutesOfDayToLabel(p.start.minutes),
      endLabel: minutesOfDayToLabel(p.end.minutes),
    }));
  }
}
