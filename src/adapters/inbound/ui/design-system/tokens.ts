/**
 * Design tokens — light / white "native OS surface" look. Flat fills only,
 * no gradients. One accent color. Radius scale nests one step smaller.
 */
export const tokens = {
  color: {
    canvas: "#F3F4F6",
    surface1: "#F9FAFB",
    surface2: "#FFFFFF",
    surface3: "#FFFFFF",
    surface4: "#FFFFFF",
    accent: "#2563EB",
    success: "#15803D",
    warning: "#B45309",
    danger: "#DC2626",
    white: "#FFFFFF",
    text: {
      primary: "rgba(0, 0, 0, 0.92)",
      secondary: "rgba(0, 0, 0, 0.60)",
      tertiary: "rgba(0, 0, 0, 0.40)",
      disabled: "rgba(0, 0, 0, 0.24)",
    },
    hairline: "rgba(0, 0, 0, 0.06)",
    hairlineStrong: "rgba(0, 0, 0, 0.10)",
    blackScrim: "rgba(0, 0, 0, 0.30)",
  },
  radius: {
    sm: 8,
    md: 14,
    lg: 20,
    xl: 28,
    full: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  text: {
    display: 28,
    title: 20,
    body: 16,
    subtext: 14,
    micro: 12,
  },
  tap: 44,
  motion: {
    press: 130,
    quick: 200,
    standard: 260,
  },
} as const;

export interface Shadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export function shadow(level: 0 | 1 | 2 | 3): Shadow {
  const table: Record<number, Shadow> = {
    0: { shadowColor: "rgba(16,24,40,0.06)", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 2, elevation: 1 },
    1: { shadowColor: "rgba(16,24,40,0.08)", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3 },
    2: { shadowColor: "rgba(16,24,40,0.14)", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 1, shadowRadius: 28, elevation: 8 },
    3: { shadowColor: "rgba(16,24,40,0.14)", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 1, shadowRadius: 28, elevation: 12 },
  };
  return table[level] ?? table[1];
}

/** Text color used by the big frosted hero when NO wallpaper is set. */
export const adaptiveColors = (hasWallpaper: boolean) => ({
  primary: hasWallpaper ? "rgba(255,255,255,0.97)" : tokens.color.text.primary,
  secondary: hasWallpaper ? "rgba(255,255,255,0.80)" : tokens.color.text.secondary,
  ringTrack: hasWallpaper ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.08)",
  ringTick: hasWallpaper ? "rgba(255,255,255,0.40)" : "rgba(0,0,0,0.16)",
  ringTickStrong: hasWallpaper ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.26)",
});

export const panelMaterial = (hasWallpaper: boolean) => ({
  background: hasWallpaper ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.65)",
  borderColor: hasWallpaper ? "rgba(255,255,255,0.22)" : tokens.color.hairline,
});