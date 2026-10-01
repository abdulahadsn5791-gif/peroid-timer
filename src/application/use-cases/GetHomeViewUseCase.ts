import { normalizeSettings } from "@domain/entities/Settings";
import { resolvePhaseColors } from "@domain/value-objects/CustomColors";
import type { Period } from "@domain/entities/Period";
import { periodsFor } from "@domain/entities/WeekSchedule";
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
    const settings = overrides ? { ...committed, ...overrides } : committed;

    const palette: RingPalette = paletteAt(settings.paletteIndex);
    // Custom per-phase overrides win over the palette; the palette still
    // answers any phase the overrides leave open.
    const paletteWithCustom: RingPalette = {
      ...palette,
      colors: resolvePhaseColors(settings.paletteIndex, settings.customRingColors),
    };
    const now = this.clock.now();
    const weekday = this.clock.todayParts().weekday;
    const seconds = now.secondsOfDay;
    const minutes = now.minutesOfDay;

    const storedWallpaper = overrides ? overrides.wallpaperUri : this.wallpaperStore.getStoredUri();
    const hasWallpaper = storedWallpaper != null;

    const today = periodsFor(settings.weekSchedule, weekday);
    const { currentIdx, nextIdx } = computeStatus(minutes, today);

    let ring: RingViewModel;
    let rows: ScheduleRowViewModel[];

    if (today.length === 0) {
      ring = {
        periodName: "No lectures today",
        timeText: "--:--",
        statusText: "Enjoy the free day",
        showHours: false,
        ringHex: settings.accentColor,
        clockHex: null,
        progressElapsed: 0,
        indicator: "idle",
        teacher: null,
        room: null,
        nextTeacher: null,
        nextRoom: null,
        nextName: null,
      };
      rows = [];
    } else if (currentIdx !== -1 && today[currentIdx]) {
      const p = today[currentIdx];
      const startSec = p.start.minutes * 60;
      const endSec = p.end.minutes * 60;
      const remaining = Math.max(0, endSec - seconds);
      const total = Math.max(1, endSec - startSec);
      const remainingFraction = Math.max(0, Math.min(1, remaining / total));
      const phase = phaseFor(remainingFraction);
      const hex = phaseColor(paletteWithCustom, phase);
      const duration = formatDuration(remaining);

      ring = {
        periodName: p.name,
        timeText: duration.text,
        statusText: `Ends at ${periodEndLabel(p)}`,
        showHours: duration.hasHours,
        ringHex: hex,
        clockHex: clockColor(paletteWithCustom, phase, settings.colorClock),
        progressElapsed: 1 - remainingFraction,
        indicator: "active",
        teacher: p.teacher ?? null,
        room: p.room ?? null,
        nextTeacher: today[currentIdx + 1]?.teacher ?? null,
        nextRoom: today[currentIdx + 1]?.room ?? null,
        nextName: today[currentIdx + 1]?.name ?? null,
      };

      rows = this.buildRows(today, seconds, paletteWithCustom, (rowIndex) =>
        rowIndex === currentIdx
          ? {
              countdownText: duration.text,
              progressElapsed: 1 - remainingFraction,
              phaseIndex: phase,
              phaseHex: hex,
              periodId: p.id,
            }
          : null,
      );
    } else if (nextIdx !== -1 && today[nextIdx]) {
      const np = today[nextIdx];
      const startSec = np.start.minutes * 60;
      const untilStart = Math.max(0, startSec - seconds);
      const prevEndSec =
        nextIdx > 0 ? today[nextIdx - 1].end.minutes * 60 : startSec - 1800;
      // The span is the full between-gap (prev end → next start). It is
      // clamped with Math.max for pathological overlapping presets, and the
      // division is clamped again below — an unclamped negative span would
      // otherwise flip the fraction sign and, with it, the ring's progress.
      const span = Math.max(60, startSec - prevEndSec);
      const remainingFraction = Math.max(0, Math.min(1, untilStart / span));
      const phaseZero = hex0(paletteWithCustom);
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
        clockHex: clockColor(paletteWithCustom, 0 as const, settings.colorClock),
        progressElapsed: 1 - remainingFraction,
        indicator: "between",
        teacher: null,
        room: null,
        nextTeacher: np.teacher ?? null,
        nextRoom: np.room ?? null,
        nextName: np.name,
      };

      rows = this.buildRows(today, seconds, paletteWithCustom, () => null);
    } else {
      ring = {
        periodName: "All periods complete",
        timeText: "--:--",
        statusText: "See you tomorrow",
        showHours: false,
        ringHex: settings.accentColor,
        clockHex: null,
        progressElapsed: 0,
        indicator: "idle",
        teacher: null,
        room: null,
        nextTeacher: null,
        nextRoom: null,
        nextName: null,
      };
      rows = this.buildRows(today, seconds, paletteWithCustom, () => null);
    }

    return {
      todayLabel: todayLabel(this.clock.todayParts()),
      weekday,
      isEmptyDay: today.length === 0,
      ringSizeScale: settings.ringSizeScale,
      clockStyle: settings.clockStyle,
      showScheduleList: settings.showScheduleList,
      homeGapPx: settings.homeGapPx,
      homeBgColor: overrides ? overrides.homeBgColor : settings.homeBgColor,
      hasWallpaper,
      wallpaperBlur: settings.wallpaperBlur,
      theme: settings.theme,
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
    nowSec: number,
    palette: RingPalette,
    currentOverrides: (rowIndex: number) => {
      countdownText: string;
      progressElapsed: number;
      phaseIndex: 0 | 1 | 2;
      phaseHex: string;
      periodId: string;
    } | null,
  ): ScheduleRowViewModel[] {
    return periods.map((p, index) => {
      // Seconds-accurate, matching the ring: minute granularity marked the
      // row "passed" a whole 59s window before the period actually ended —
      // while the ring still counted down — so a running lecture showed its
      // strikethrough + "Done" mark. startMin/endMin names kept for clarity.
      const startMin = p.start.minutes;
      const endMin = p.end.minutes;
      const startSec = startMin * 60;
      const endSec = endMin * 60;
      const status: ScheduleRowViewModel["status"] =
        nowSec >= endSec ? "passed" : nowSec >= startSec ? "current" : "upcoming";
      // The override targets the ring's active period BY ROW INDEX, not by
      // period id: duplicate period ids in a legacy timetable previously made
      // the id callback match the wrong row. The periodId carried in the
      // override is a cross-check only.
      const override = status === "current" ? currentOverrides(index) : null;
      if (override != null && override.periodId !== p.id) {
        return {
          id: p.id,
          name: p.name,
          rangeText: formatRange(p),
          status,
          countdownText: null,
          progressElapsed: 0,
          phaseIndex: null,
          phaseHex: null,
          teacher: p.teacher ?? null,
          room: p.room ?? null,
        };
      }
      return {
        id: p.id,
        name: p.name,
        rangeText: formatRange(p),
        status,
        countdownText: override ? override.countdownText : null,
        progressElapsed: override ? override.progressElapsed : 0,
        phaseIndex: override ? override.phaseIndex : null,
        phaseHex: override ? override.phaseHex : null,
        teacher: p.teacher ?? null,
        room: p.room ?? null,
      };
    });
  }
}

function hex0(palette: RingPalette): string {
  return phaseColor(palette, 0);
}
