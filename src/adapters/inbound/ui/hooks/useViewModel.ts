import { useEffect, useState, useCallback } from "react";
import type { HomeView, SettingsDraftVM } from "@application/ports/view-models/ViewModels";
import type { AppDeps } from "../ports";

export interface HomeViewModelState {
  view: HomeView;
  /** Informational "X ended" toast; no stop control — volume buttons silence the alarm. */
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
    // A tick reads the schedule, plays the alarm and re-renders. setInterval does
    // not wait for it, so a slow tick could overlap the next one and report the
    // same period end twice; one tick at a time keeps the flash single-shot.
    let ticking = false;
    const timer = setInterval(async () => {
      if (ticking) return;
      ticking = true;
      try {
        const result = await deps.checkPeriodEnd();
        if (result.justEnded) {
          setFlash((f) => ({ periodName: result.periodName, key: f.key + 1 }));
        }
        refresh();
      } finally {
        ticking = false;
      }
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps.onBackgroundTick();
    return () => {
      unsubDraft();
      clearInterval(timer);
    };
  }, [deps]);

  // The toast auto-drops after a moment: it carries no control, so it must
  // never linger over the clock waiting for a tap that cannot come.
  useEffect(() => {
    if (!flash.periodName) return;
    const t = setTimeout(() => setFlash({ periodName: null, key: flash.key }), 4000);
    return () => clearTimeout(t);
  }, [flash.periodName, flash.key]);

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