// Design tokens for ŞHA LGS Koçu. Light + dark themes (navy/blue brand).
// Keys match the "color" block of /app/design_guidelines.json.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#F8FAFC",
  onSurface: "#0F172A",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1E293B",
  surfaceTertiary: "#F1F5F9",
  onSurfaceTertiary: "#334155",
  surfaceInverse: "#0F172A",
  onSurfaceInverse: "#F8FAFC",
  muted: "#64748B",

  brand: "#0F172A",
  onBrand: "#FFFFFF",
  brandPrimary: "#2563EB",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#3B82F6",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#DBEAFE",
  onBrandTertiary: "#1E3A8A",

  success: "#059669",
  onSuccess: "#FFFFFF",
  warning: "#D97706",
  onWarning: "#FFFFFF",
  error: "#DC2626",
  onError: "#FFFFFF",
  info: "#0284C7",
  onInfo: "#FFFFFF",

  border: "#E2E8F0",
  borderStrong: "#94A3B8",
  divider: "#F1F5F9",
};

const dark: typeof light = {
  surface: "#0B0F19",
  onSurface: "#F8FAFC",
  surfaceSecondary: "#151C2C",
  onSurfaceSecondary: "#F1F5F9",
  surfaceTertiary: "#1E293B",
  onSurfaceTertiary: "#CBD5E1",
  surfaceInverse: "#F8FAFC",
  onSurfaceInverse: "#0F172A",
  muted: "#94A3B8",

  brand: "#F8FAFC",
  onBrand: "#0F172A",
  brandPrimary: "#3B82F6",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#60A5FA",
  onBrandSecondary: "#0F172A",
  brandTertiary: "#1E3A8A",
  onBrandTertiary: "#DBEAFE",

  success: "#10B981",
  onSuccess: "#0B0F19",
  warning: "#F59E0B",
  onWarning: "#0B0F19",
  error: "#EF4444",
  onError: "#FFFFFF",
  info: "#38BDF8",
  onInfo: "#0B0F19",

  border: "#334155",
  borderStrong: "#64748B",
  divider: "#1E293B",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

export function setColorScheme(scheme: ColorScheme | null) {
  // React Native 0.82+ no longer accepts `null` natively (it crashes release
  // builds with "parameter style is null"). "unspecified" follows the system.
  Appearance.setColorScheme?.((scheme ?? "unspecified") as never);
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// Spacing + radius tokens from design_guidelines.json
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 } as const;
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 } as const;
