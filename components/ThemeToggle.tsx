"use client";

import { useTheme } from "@/components/ThemeProvider";

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const nextTheme = theme === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: compact ? 0 : 9,
        minWidth: compact ? 38 : 0,
        minHeight: 38,
        padding: compact ? "0 9px" : "8px 11px",
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--card-bg)",
        color: "var(--text)",
        font: "inherit",
        fontSize: 12,
        fontWeight: 650,
        cursor: "pointer",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>{theme === "light" ? "☾" : "☀"}</span>
      {!compact && <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>}
    </button>
  );
}
