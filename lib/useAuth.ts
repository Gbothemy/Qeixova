"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  balance: number;
  streak: number;
  level: number;
  levelName: string;
  badgeColor: string;
  badgeEmoji: string;
  xp: number;
  trustScore: number;
  total_earned_qlt: number;
  bonus_earned_qlt: number;
  progressPct: number;
  qltToNextLevel: number;
  canWithdraw: boolean;
  referralCode: string;
  nextLevel: { number: number; name: string; minQlt: number; emoji: string } | null;
}

export function useAuth(redirectIfUnauth = true) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        // Session expired or unauthorized — redirect to login
        if (r.status === 401) {
          if (redirectIfUnauth) router.push("/login");
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (data?.user) {
          setUser({
            id: data.user.id,
            email: data.user.email,
            fullName: data.user.full_name,
            balance: data.user.balance,
            streak: data.user.streak ?? 0,
            level: data.user.level ?? 1,
            levelName: data.user.levelName ?? "Starter",
            badgeColor: data.user.badgeColor ?? "#888888",
            badgeEmoji: data.user.badgeEmoji ?? "🟢",
            xp: data.user.xp ?? 0,
            trustScore: data.user.trust_score ?? 100,
            total_earned_qlt: data.user.total_earned_qlt ?? 0,
            bonus_earned_qlt: data.user.bonus_earned_qlt ?? 0,
            progressPct: data.user.progressPct ?? 0,
            qltToNextLevel: data.user.qltToNextLevel ?? 0,
            canWithdraw: data.user.canWithdraw ?? false,
            referralCode: data.user.referral_code,
            nextLevel: data.user.nextLevel ?? null,
          });
        } else if (redirectIfUnauth) {
          router.push("/login");
        }
      })
      .catch(() => { if (redirectIfUnauth) router.push("/login"); })
      .finally(() => setLoading(false));
  }, [router, redirectIfUnauth]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return { user, loading, logout };
}
