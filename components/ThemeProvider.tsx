"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark";
const STORAGE_KEY = "qeixova:theme";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t?: Theme) => void;
  toggle: () => void;
} | null>(null);

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "dark");
      setThemeState("dark");
      document.documentElement.dataset.theme = "dark";
      document.documentElement.style.colorScheme = "dark";
    } catch {
      setThemeState("dark");
      document.documentElement.dataset.theme = "dark";
      document.documentElement.style.colorScheme = "dark";
    }
  }, []);

  const setTheme = (_t?: Theme) => {
    setThemeState("dark");
    try {
      document.documentElement.dataset.theme = "dark";
      document.documentElement.style.colorScheme = "dark";
      window.localStorage.setItem(STORAGE_KEY, "dark");
    } catch {}
  };

  const toggle = () => setTheme();

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
