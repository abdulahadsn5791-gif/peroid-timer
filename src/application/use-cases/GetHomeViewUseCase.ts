import { normalizeSettings } from "@domain/entities/Settings";
import type { Period } from "@domain/entities/Period";
import { computeStatus } from "@domain/services/computeStatus";
import { phaseFor } from "@domain/services/phaseFor";
import { phaseColor } from "@domain/services/phaseColor";
import { clockColor } from "@domain/services/clockColor";
import { formatDuration, formatDurationWithUnits } from "@domain/services/formatDuration";
import { formatRange, periodEndLabel, periodStartLabel } from "@domain/services/formatRange";
import { todayLabel } from "@domain/services/todayLabel";
import { paletteAt } from "@domain/value-objects/RingPalette";
import { DEFAULT_PHASE_THRESHOLDS } from "@domain/value-objects/PhaseColor";
import type { RingPalette } from "@domain/value-objects/RingPalette";
import type { ClockPort } from "@application/ports/outbound/ClockPort";
import type { SettingsRepositoryPort } from "@application/ports/outbound/SettingsRepositoryPort";
import type { WallpaperStorePort } from "@application/ports/outbound/WallpaperStorePort";
import type { GetHomeViewPort } from "@application/ports/inbound/GetHomeViewPort";
import type { HomeView, RingViewModel, ScheduleRowViewModel } from "@application/ports/view-models/ViewModels";
import { SettingsDraftStore } from "@application/state/SettingsDraftStore";

export class GetHomeViewUseCase implements GetHomeViewPort {
  constructor(
    private readonly clock: ClockPort,
    private readonly settingsRepository: SettingsRepositoryPort,
    private readonly wallpaperStore: WallpaperStorePort,
    private readonly draftStore: SettingsDraftStore,
  ) {}

  getHomeView(): HomeView {
    const committed = normalizeSettings(this.settingsRepository.load());
    const overrides = this.draftStore.effectiveOverrides();
    const settings = overrides
      ? { ...committed, ...overrides }
      : committed;

    const palette: RingPalette = paletteAt(settings.paletteIndex);
    const now = this.clock.now();
    const seconds = now.secondsOfDay;
    const minutes = now.minutesOfDay;

    const storedWallpaper = overrides ? overrides.wallpaperUri : this.wallpaperStore.getStoredUri();
    const hasWallpaper = storedWallpaper != null;

    const { currentIdx, nextIdx } = computeStatus(minutes, settings.periods);

    let ring: RingViewModel;
    let rows: ScheduleRowViewModel[];

    if (currentIdx !== -1 && settings.periods[currentIdx]) {
      const p = settings.periods[currentIdx];
      const startSec = p.start.minutes * 60;
      const endSec = p.end.minutes * 60;
      const remaining = Math.max(0, endSec - seconds);
      const total = Math.max(1, endSec - startSec);
      const remainingFraction = Math.max(0, Math.min(1, remaining / total));
      const phase = phaseFor(remainingFraction);
      const hex = phaseColor(palette, phase);
      const duration = formatDuration(remaining);

      ring = {
        periodName: p.name,
        timeText: duration.text,
        statusText: `Ends at ${periodEndLabel(p)}`,
        showHours: duration.hasHours,
        ringHex: hex,
        clockHex: clockColor(palette, phase, settings.colorClock),
        progressElapsed: 1 - remainingFraction,
        indicator: "active",
      };

      rows = this.buildRows(settings.periods, minutes, palette, (id) =>
        id === p.id
          ? {
              countdownText: duration.text,
              progressElapsed: 1 - remainingFraction,
              phaseIndex: phase,
              phaseHex: hex,
            }
          : null,
      );
    } else if (nextIdx !== -1 && settings.periods[nextIdx]) {
      const np = settings.periods[nextIdx];
      const startSec = np.start.minutes * 60;
      const untilStart = Math.max(0, startSec - seconds);
      const prevEndSec =
        nextIdx > 0 ? settings.periods[nextIdx - 1].end.minutes * 60 : startSec - 1800;
      const span = Math.max(60, startSec - prevEndSec);
      const remainingFraction = Math.max(0, Math.min(1, untilStart / span));
      const phaseZero = hex0(palette);
      const untilText = formatDurationWithUnits(untilStart);

      ring = {
        periodName: `Up next: ${np.name}`,
        // Live ticking countdown with units — "4h 05m 32s" ticks every second
        // and can never be misread as a clock time; the real start time is on
        // the status line.
        timeText: untilText,
        statusText: `starts at ${periodStartLabel(np)}`,
        showHours: true,
        ringHex: phaseZero,
        clockHex: clockColor(palette, 0 as const, settings.colorClock),
        progressElapsed: 1 - remainingFraction,
        indicator: "between",
      };

      rows = this.buildRows(settings.periods, minutes, palette, () => null);
    } else {
      ring = {
        periodName: settings.periods.length ? "All periods complete" : "No periods set up",
        timeText: "--:--",
        statusText: settings.periods.length ? "See you tomorrow" : "Add one in settings",
        showHours: false,
        ringHex: settings.accentColor,
        clockHex: null,
        progressElapsed: 0,
        indicator: "idle",
      };
      rows = this.buildRows(settings.periods, minutes, palette, () => null);
    }

    return {
      todayLabel: todayLabel(this.clock.todayParts()),
      hasWallpaper,
      wallpaperBlur: settings.wallpaperBlur,
      colorActiveBars: settings.colorActiveBars,
      wallpaperUri: storedWallpaper,
      accentHex: settings.accentColor,
      paletteName: palette.name,
      ring,
      rows,
    };
  }

  private buildRows(
    periods: Period[],
    nowMinutes: number,
    palette: RingPalette,
    currentOverrides: (id: string) => {
      countdownText: string;
      progressElapsed: number;
      phaseIndex: 0 | 1 | 2;
      phaseHex: string;
    } | null,
  ): ScheduleRowViewModel[] {
    return periods.map((p) => {
      const startMin = p.start.minutes;
      const endMin = p.end.minutes;
      const status: ScheduleRowViewModel["status"] =
        nowMinutes >= endMin ? "passed" : nowMinutes >= startMin ? "current" : "upcoming";
      const override = status === "current" ? currentOverrides(p.id) : null;
      return {
        id: p.id,
        name: p.name,
        rangeText: formatRange(p),
        status,
        countdownText: override ? override.countdownText : null,
        progressElapsed: override ? override.progressElapsed : 0,
        phaseIndex: override ? override.phaseIndex : null,
        phaseHex: override ? override.phaseHex : null,
      };
    });
  }
}

function hex0(palette: RingPalette): string {
  return phaseColor(palette, 0);
}