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

/** Text color used by the big frosted hero when NO wallpaper is set. */
export const adaptiveColors = (hasWallpaper: boolean, theme: ThemeName = "light") => {
  if (hasWallpaper) return wallpaperColors();
  if (theme === "dark") {
    return {
      primary: "rgba(255,255,255,0.95)",
      secondary: "rgba(255,255,255,0.62)",
      ringTrack: "rgba(255,255,255,0.10)",
      ringTick: "rgba(255,255,255,0.18)",
      ringTickStrong: "rgba(255,255,255,0.34)",
    };
  }
  return {
    primary: tokens.color.text.primary,
    secondary: tokens.color.text.secondary,
    ringTrack: "rgba(0,0,0,0.08)",
    ringTick: "rgba(0,0,0,0.16)",
    ringTickStrong: "rgba(0,0,0,0.26)",
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
      background: "#182234",
      borderColor: "rgba(255,255,255,0.08)",
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
}

/**
 * Named palette for the no-wallpaper home look AND the settings pages, which
 * follow the same theme choice. Wallpaper mode never uses this — it stays
 * frosted glass over the photo.
 */
export const themePalette = (theme: ThemeName): ThemePalette => {
  if (theme === "dark") {
    return {
      canvas: "#0B1220",
      surface: "#182234",
      surfaceAlt: "#1F2B3F",
      inputBg: "rgba(255,255,255,0.07)",
      textPrimary: "rgba(255,255,255,0.94)",
      textSecondary: "rgba(255,255,255,0.64)",
      textTertiary: "rgba(255,255,255,0.42)",
      hairline: "rgba(255,255,255,0.08)",
      hairlineStrong: "rgba(255,255,255,0.14)",
      onAccent: "#FFFFFF",
      disabled: "rgba(255,255,255,0.24)",
    };
  }
  return {
    canvas: "#F3F4F6",
    surface: "#FFFFFF",
    surfaceAlt: "#F3F4F6",
    inputBg: "rgba(0,0,0,0.04)",
    textPrimary: tokens.color.text.primary,
    textSecondary: tokens.color.text.secondary,
    textTertiary: tokens.color.text.tertiary,
    hairline: tokens.color.hairline,
    hairlineStrong: tokens.color.hairlineStrong,
    onAccent: "#FFFFFF",
    disabled: tokens.color.text.disabled,
  };
};