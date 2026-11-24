"use client";

import { useEffect } from "react";

export default function ContributorPresence() {
  useEffect(() => {
    let active = true;
    let timer: number | null = null;
    const updatePresence = async () => {
      if (document.visibilityState !== "visible") return;
      const response = await fetch("/api/contributor/presence", { method: "POST", cache: "no-store" }).catch(() => null);
      if (response?.status === 401 && timer !== null) {
        window.clearInterval(timer);
        timer = null;
        return;
      }
      if (response?.ok && active && timer === null) timer = window.setInterval(() => void updatePresence(), 15_000);
    };
    void updatePresence();
    const onVisibilityChange = () => { if (document.visibilityState === "visible") void updatePresence(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      if (timer !== null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
