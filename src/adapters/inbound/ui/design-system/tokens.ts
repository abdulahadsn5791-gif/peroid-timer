/**
 * Design tokens — light / white "native OS surface" look. Flat fills only,
 * no gradients. One accent color. Radius scale nests one step smaller.
 */
export type ThemeName = "light" | "dark";
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

/** Text colors used by the big frosted hero when a wallpaper IS set. */
const wallpaperColors = () => ({
  primary: "rgba(255,255,255,0.97)",
  secondary: "rgba(255,255,255,0.80)",
  ringTrack: "rgba(255,255,255,0.28)",
  ringTick: "rgba(255,255,255,0.40)",
  ringTickStrong: "rgba(255,255,255,0.65)",
});

/**
 * Bare-look text colors, tuned per theme in the style of modern OS dark
 * modes (iOS / One UI): pure black canvas, neutral gray elevated surfaces,
 * and white text with opacity steps instead of tinted grays.
 */
export const adaptiveColors = (hasWallpaper: boolean, theme: ThemeName = "light") => {
  if (hasWallpaper) return wallpaperColors();
  if (theme === "dark") {
    return {
      primary: "#FFFFFF",
      secondary: "rgba(235,235,245,0.62)",
      ringTrack: "rgba(255,255,255,0.10)",
      ringTick: "rgba(255,255,255,0.16)",
      ringTickStrong: "rgba(235,235,245,0.32)",
    };
  }
  return {
    primary: tokens.color.text.primary,
    secondary: "rgba(60,60,67,0.62)",
    ringTrack: "rgba(60,60,67,0.10)",
    ringTick: "rgba(60,60,67,0.18)",
    ringTickStrong: "rgba(60,60,67,0.30)",
  };
};

export const panelMaterial = (hasWallpaper: boolean, theme: ThemeName = "light") => {
  if (hasWallpaper) {
    return {
      background: "rgba(255,255,255,0.14)",
      borderColor: "rgba(255,255,255,0.22)",
    };
  }
  if (theme === "dark") {
    return {
      background: "#1C1C1E",
      borderColor: "rgba(84,84,88,0.65)",
    };
  }
  return {
    background: "#FFFFFF",
    borderColor: tokens.color.hairline,
  };
};

export interface ThemePalette {
  canvas: string;
  /** Elevated card surface (solid — cards must read crisply on the canvas). */
  surface: string;
  /** Slightly recessed surface: inputs, steppers, chips on cards. */
  surfaceAlt: string;
  inputBg: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  hairline: string;
  hairlineStrong: string;
  /** Text/icons drawn on top of the accent color. */
  onAccent: string;
  /** Neutral dot / disabled marker. */
  disabled: string;
  /** Switch track while off. */
  toggleOff: string;
  /** Destructive accent — brighter on dark so it reads on black. */
  danger: string;
}

/**
 * Named palette for the no-wallpaper home look AND the settings pages, which
 * follow the same theme choice. Neutral, modern OS-style values (iOS/One UI
 * flavor): pure black canvas, #1C1C1E elevated cards, Apple opacity-step
 * labels. Wallpaper mode never uses this — it stays frosted glass.
 */
export const themePalette = (theme: ThemeName): ThemePalette => {
  if (theme === "dark") {
    return {
      canvas: "#000000",
      surface: "#1C1C1E",
      surfaceAlt: "#2C2C2E",
      inputBg: "rgba(118,118,128,0.24)",
      textPrimary: "#FFFFFF",
      textSecondary: "rgba(235,235,245,0.60)",
      textTertiary: "rgba(235,235,245,0.30)",
      hairline: "rgba(84,84,88,0.60)",
      hairlineStrong: "rgba(84,84,88,0.85)",
      onAccent: "#FFFFFF",
      disabled: "rgba(235,235,245,0.18)",
      toggleOff: "rgba(120,120,128,0.32)",
      danger: "#FF453A",
    };
  }
  return {
    canvas: "#F2F2F7",
    surface: "#FFFFFF",
    surfaceAlt: "#F2F2F7",
    inputBg: "rgba(118,118,128,0.12)",
    textPrimary: "#000000",
    textSecondary: "rgba(60,60,67,0.60)",
    textTertiary: "rgba(60,60,67,0.30)",
    hairline: "rgba(60,60,67,0.12)",
    hairlineStrong: "rgba(60,60,67,0.22)",
    onAccent: "#FFFFFF",
    disabled: "rgba(60,60,67,0.18)",
    toggleOff: "rgba(0,0,0,0.10)",
    danger: "#DC2626",
  };
};