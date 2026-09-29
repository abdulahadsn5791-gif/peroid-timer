import type { PeriodEndTickResult } from "../view-models/ViewModels";

export interface CheckForPeriodEndPort {
  tick(): Promise<PeriodEndTickResult>;
  /** Silences a currently-ringing end-of-period alarm. */
  stop(): Promise<void>;
}

export interface SaveSettingsPort {
  save(): Promise<void>;
}

export interface CloseSettingsPort {
  close(): void;
}

export interface ApplyBackgroundPlanPort {
  run(): Promise<void>;
}