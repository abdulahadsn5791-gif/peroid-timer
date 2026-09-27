import { useEffect, useState, useCallback } from "react";
import type { HomeView, SettingsDraftVM } from "@application/ports/view-models/ViewModels";
import type { AppDeps } from "../ports";

export interface HomeViewModelState {
  view: HomeView;
  flash: { periodName: string | null; key: number };
}

export function useHomeViewModel(deps: AppDeps): HomeViewModelState {
  const [view, setView] = useState<HomeView>(() => deps.getHomeView());
  const [flash, setFlash] = useState<{ periodName: string | null; key: number }>({
    periodName: null,
    key: 0,
  });

  useEffect(() => {
    const refresh = () => setView(deps.getHomeView());
    const unsubDraft = deps.subscribeDraft(refresh);
    const timer = setInterval(async () => {
      const result = await deps.checkPeriodEnd();
      if (result.justEnded) {
        setFlash((f) => ({ periodName: result.periodName, key: f.key + 1 }));
      }
      refresh();
    }, 1000);
    deps.onBackgroundTick();
    return () => {
      unsubDraft();
      clearInterval(timer);
    };
  }, [deps]);

  return { view, flash };
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