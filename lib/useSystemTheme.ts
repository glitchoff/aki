"use client";

import { useEffect, useState } from "react";

/**
 * Tracks the OS colour-scheme preference, updating live when the user flips it
 * in system settings while the app is open.
 */
export function useSystemTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => setTheme(query.matches ? "dark" : "light");
    apply();

    // Safari < 14 only has the deprecated listener API.
    if (query.addEventListener) {
      query.addEventListener("change", apply);
      return () => query.removeEventListener("change", apply);
    }

    query.addListener(apply);
    return () => query.removeListener(apply);
  }, []);

  return theme;
}

/** Collapses the "system" option into a concrete palette. */
export function resolveTheme(
  preference: "system" | "light" | "sepia" | "dark",
  system: "light" | "dark",
): "light" | "sepia" | "dark" {
  return preference === "system" ? system : preference;
}