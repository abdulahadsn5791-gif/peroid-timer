import { useEffect, useState, useCallback } from "react";
import type { HomeView, SettingsDraftVM } from "@application/ports/view-models/ViewModels";
import type { AppDeps } from "../ports";

export interface HomeViewModelState {
  view: HomeView;
  flash: { periodName: string | null; key: number; alarmEnabled: boolean };
  stopAlarm: () => void;
}

export function useHomeViewModel(deps: AppDeps): HomeViewModelState {
  const [view, setView] = useState<HomeView>(() => deps.getHomeView());
  const [flash, setFlash] = useState<{
    periodName: string | null;
    key: number;
    alarmEnabled: boolean;
  }>({ periodName: null, key: 0, alarmEnabled: true });

  useEffect(() => {
    const refresh = () => setView(deps.getHomeView());
    const unsubDraft = deps.subscribeDraft(refresh);
    const timer = setInterval(async () => {
      const result = await deps.checkPeriodEnd();
      if (result.justEnded) {
        // Read the toggles from the draft the flash is about to act on, so the
        // "Stop alarm" control only shows when there is actually a tone to stop.
        const draft = deps.settingsIsOpen() ? deps.getDraft() : null;
        const alarmEnabled = draft ? draft.soundEnabled && draft.notificationsEnabled : true;
        setFlash((f) => ({ periodName: result.periodName, key: f.key + 1, alarmEnabled }));
      }
      refresh();
    }, 1000);
    deps.onBackgroundTick();
    return () => {
      unsubDraft();
      clearInterval(timer);
    };
  }, [deps]);

  const stopAlarm = useCallback(() => {
    void deps.stopAlarm();
    setFlash((f) => ({ ...f, alarmEnabled: false, periodName: null }));
  }, [deps]);

  return { view, flash, stopAlarm };
}

export function useSettingsDraft(deps: AppDeps): SettingsDraftVM | null {
  const [draft, setDraft] = useState<SettingsDraftVM | null>(() =>
    deps.settingsIsOpen() ? deps.getDraft() : null,
  );

  useEffect(() => {
    return deps.subscribeDraft(() => setDraft(deps.settingsIsOpen() ? deps.getDraft() : null));
  }, [deps]);

  return draft;
}

export function useSettingsOpenState() {
  const [open, setOpen] = useState(false);
  const openSheet = useCallback(() => setOpen(true), []);
  const closeSheet = useCallback(() => setOpen(false), []);
  return { isOpen: open, openSheet, closeSheet };
}