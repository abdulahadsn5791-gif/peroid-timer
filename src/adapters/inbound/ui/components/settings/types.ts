import type { PeriodDraftVM } from "@application/ports/view-models/ViewModels";

export type { PeriodDraftVM };

/** One row list per weekday; index 0 = Sunday … 6 = Saturday. */
export type WeekPeriodsVM = PeriodDraftVM[][];

/** Route ids for the settings stack. */
export type SettingsRoute = "root" | "schedule" | "look" | "sound";
