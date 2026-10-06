"use client";

import { useEffect, useState } from "react";
import type { Typography } from "./types";
import { DEFAULT_TYPOGRAPHY } from "./types";
import { settings, typographyVars } from "./store/db";
import { resolveTheme, useSystemTheme } from "./useSystemTheme";

export type GlobalTheme = {
  /** The resolved concrete palette (light | sepia | dark). */
  theme: "light" | "sepia" | "dark";
  /** CSS custom properties to apply on the app wrapper. */
  vars: React.CSSProperties;
  /** The raw global typography, for surfaces that want to show it. */
  typography: Typography;
};

/**
 * Global, app-wide theme. Unlike the reader's per-book settings this drives the
 * whole app (library + chrome), so switching theme in the reader is reflected
 * everywhere. Falls back to system theme until the global setting is read.
 */
export function useGlobalTheme(): GlobalTheme {
  const systemTheme = useSystemTheme();
  const [typography, setTypography] = useState<Typography | null>(null);

  useEffect(() => {
    let cancelled = false;
    settings.global().then((t) => !cancelled && setTypography(t));
    return () => {
      cancelled = true;
    };
  }, []);

  const base = typography ?? DEFAULT_TYPOGRAPHY;
  const theme = resolveTheme(base.theme, systemTheme);
  const vars = typographyVars(base, theme);

  return { theme, vars, typography: base };
}