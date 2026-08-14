/**
 * E-commerce Theme Configuration
 *
 * Edit this file to change your store's appearance.
 * All colors use HEX format (e.g., "#2a2a2a" or "#fff").
 *
 * Theme detection: automatic via next-themes (enableSystem in app/layout.tsx)
 */

export interface ThemeConfig {
  brand: {
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    accent: string;
    accentForeground: string;
  };
  surfaces: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    muted: string;
    mutedForeground: string;
    border: string;
    input: string;
    ring: string;
  };
  semantic: {
    destructive: string;
    destructiveForeground: string;
    success: string;
    successForeground: string;
    successMuted: string;
    warning: string;
    warningForeground: string;
    warningMuted: string;
    info: string;
    infoForeground: string;
    infoMuted: string;
    danger: string;
    dangerForeground: string;
    dangerMuted: string;
  };
  custom: {
    purple: string;
  };
  borderRadius: string;
}

// ─────────────────────────────────────────────
// DARK THEME (default) - PRIGMA
// ─────────────────────────────────────────────

export const themeConfig: ThemeConfig = {
  // ── BRAND ──────────────────────────────────
  brand: {
    primary: "#dc2626", // Servicell Red
    primaryForeground: "#ffffff",
    secondary: "#1f1f1f", // Dark gray
    secondaryForeground: "#ffffff",
    accent: "#27272a", // Zinc-800
    accentForeground: "#ffffff",
  },

  // ── SURFACES ───────────────────────────────
  surfaces: {
    background: "#0a0a0a", // Almost black
    foreground: "#fafafa",
    card: "#141414", // Slightly lighter black
    cardForeground: "#fafafa",
    muted: "#27272a",
    mutedForeground: "#a1a1aa", // Zinc-400
    border: "#27272a",
    input: "#27272a",
    ring: "#dc2626",
  },

  // ─ SEMANTIC ───────────────────────────────
  semantic: {
    destructive: "#ef4444", // Red-500
    destructiveForeground: "#ffffff",
    success: "#22c55e", // Green-500
    successForeground: "#ffffff",
    successMuted: "#14532d", // Green-900
    warning: "#eab308", // Yellow-500
    warningForeground: "#ffffff",
    warningMuted: "#713f12", // Yellow-900
    info: "#3b82f6", // Blue-500
    infoForeground: "#ffffff",
    infoMuted: "#1e3a8a", // Blue-900
    danger: "#ef4444",
    dangerForeground: "#ffffff",
    dangerMuted: "#7f1d1d", // Red-900
  },

  // ── CUSTOM ─────────────────────────────────
  custom: {
    purple: "#dc2626",
  },

  borderRadius: "0.5rem", // Standard radius
};

// ─────────────────────────────────────────────
// LIGHT THEME (overrides only)
// Values not specified here fall back to dark theme.
// ─────────────────────────────────────────────

export const lightTheme: Partial<ThemeConfig> & {
  surfaces?: Partial<ThemeConfig["surfaces"]>;
  brand?: Partial<ThemeConfig["brand"]>;
  semantic?: Partial<ThemeConfig["semantic"]>;
  custom?: Partial<ThemeConfig["custom"]>;
} = {
  surfaces: {
    background: "#ffffff",
    foreground: "#0a0a0a",
    card: "#f4f4f5", // Zinc-100
    cardForeground: "#0a0a0a",
    muted: "#e4e4e7", // Zinc-200
    mutedForeground: "#52525b", // Zinc-500
    border: "#e4e4e7",
    input: "#ffffff",
    ring: "#dc2626",
  },
  brand: {
    primary: "#dc2626",
    primaryForeground: "#ffffff",
    secondary: "#f4f4f5",
    secondaryForeground: "#0a0a0a",
    accent: "#e4e4e7",
    accentForeground: "#0a0a0a",
  },
  semantic: {
    destructive: "#ef4444",
    destructiveForeground: "#ffffff",
    success: "#22c55e",
    successForeground: "#ffffff",
    successMuted: "#dcfce7",
    warning: "#eab308",
    warningForeground: "#ffffff",
    warningMuted: "#fef08a",
    info: "#3b82f6",
    infoForeground: "#ffffff",
    infoMuted: "#dbeafe",
    danger: "#ef4444",
    dangerForeground: "#ffffff",
    dangerMuted: "#fee2e2",
  },
  custom: {
    purple: "#dc2626",
  },
};
