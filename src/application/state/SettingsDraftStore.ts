import { clampBlur, normalizeSettings, type Settings } from "@domain/entities/Settings";
import { clonePeriod, type Period } from "@domain/entities/Period";
import { parseTimeHHMM, toHHMM, minutesOfDayToLabel } from "@domain/value-objects/TimeOfDay";
import { normalizeAccentColor } from "@domain/value-objects/AccentColor";

/**
 * Transient settings-shell state. The draft is a deep copy of the committed
 * settings; "Save & apply" commits it through the repository + alerts/snapshot
 * adapters, "close" reverts to the committed value. Native wallpapers are
 * handled by WallpaperStorePort; here we only remember the intended uri.
 */
export interface DraftSnapshot {
  accentColor: string;
  paletteIndex: number;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  colorClock: boolean;
  colorNotification: boolean;
  colorActiveBars: boolean;
  wallpaperBlur: number;
  wallpaperUri: string | null;
  periods: Period[];
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
      soundEnabled: s.soundEnabled,
      notificationsEnabled: s.notificationsEnabled,
      colorClock: s.colorClock,
      colorNotification: s.colorNotification,
      colorActiveBars: s.colorActiveBars,
      wallpaperBlur: s.wallpaperBlur,
      wallpaperUri: s.wallpaperUri,
      periods: s.periods.map(clonePeriod),
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
    return { ...this.draft, periods: this.draft.periods.map(clonePeriod) };
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

  /**
   * Draft values used by the home view so palette / accent / wallpaper /
   * color-clock previews render live behind the settings sheet.
   */
  effectiveOverrides(): {
    accentColor: string;
    paletteIndex: number;
    colorClock: boolean;
    colorActiveBars: boolean;
    wallpaperBlur: number;
    wallpaperUri: string | null;
  } | null {
    if (!this.opened) return null;
    return {
      accentColor: this.draft.accentColor,
      paletteIndex: this.draft.paletteIndex,
      colorClock: this.draft.colorClock,
      colorActiveBars: this.draft.colorActiveBars,
      wallpaperBlur: this.draft.wallpaperBlur,
      wallpaperUri: this.draft.wallpaperUri,
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

  updatePeriod(id: string, patch: { name?: string; start?: string; end?: string }): void {
    this.draft.periods = this.draft.periods.map((p) => {
      if (p.id !== id) return p;
      const next: Period = { id: p.id, name: p.name, start: p.start, end: p.end };
      if (patch.name !== undefined) next.name = patch.name.trim() || `Period ${this.draft.periods.indexOf(p) + 1}`;
      if (patch.start !== undefined) next.start = parseTimeHHMM(patch.start);
      if (patch.end !== undefined) next.end = parseTimeHHMM(patch.end);
      return next;
    });
    this.dirty = true;
    this.notify();
  }

  moveUp(index: number): void {
    if (index <= 0 || index >= this.draft.periods.length) return;
    const arr = [...this.draft.periods];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    this.draft.periods = arr;
    this.dirty = true;
    this.notify();
  }

  moveDown(index: number): void {
    if (index < 0 || index >= this.draft.periods.length - 1) return;
    const arr = [...this.draft.periods];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    this.draft.periods = arr;
    this.dirty = true;
    this.notify();
  }

  remove(index: number): void {
    if (this.draft.periods.length <= 1) return;
    this.draft.periods = this.draft.periods.filter((_, i) => i !== index);
    this.dirty = true;
    this.notify();
  }

  addPeriod(newPeriod: Period): void {
    this.draft.periods = [...this.draft.periods, newPeriod];
    this.dirty = true;
    this.notify();
  }

  toDraftPeriodVM() {
    return this.draft.periods.map((p) => ({
      id: p.id,
      name: p.name,
      start: toHHMM(p.start),
      end: toHHMM(p.end),
      startLabel: minutesOfDayToLabel(p.start.minutes),
      endLabel: minutesOfDayToLabel(p.end.minutes),
    }));
  }
}