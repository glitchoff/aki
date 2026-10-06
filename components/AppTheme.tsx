"use client";

import { useGlobalTheme } from "@/lib/useGlobalTheme";

/**
 * Applies the app-wide theme to the document body.
 *
 * It sets a data-theme attribute and maps the reader palette onto the shadcn
 * CSS variables so every surface (library, cards, dialogs) follows the chosen
 * theme, not just the reader scroll area. Renders nothing itself.
 */
export function AppTheme() {
  const { vars } = useGlobalTheme();
  const v = vars as Record<string, string>;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          :root {
            --background: ${v["--r-bg"]};
            --foreground: ${v["--r-fg"]};
            --card: ${v["--r-panel"]};
            --card-foreground: ${v["--r-fg"]};
            --popover: ${v["--r-panel"]};
            --popover-foreground: ${v["--r-fg"]};
            --primary: ${v["--r-accent"]};
            --primary-foreground: ${v["--r-bg"]};
            --muted: color-mix(in srgb, ${v["--r-fg"]} 8%, transparent);
            --muted-foreground: ${v["--r-dim"]};
            --accent: ${v["--r-accent"]};
            --accent-foreground: ${v["--r-bg"]};
            --border: color-mix(in srgb, ${v["--r-fg"]} 18%, transparent);
            --ring: ${v["--r-accent"]};
          }
          body {
            background: ${v["--r-bg"]};
            color: ${v["--r-fg"]};
          }
        `,
      }}
    />
  );
}