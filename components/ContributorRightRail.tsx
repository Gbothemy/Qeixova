"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ContributorRightRail() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let current = true;
    fetch("/api/wallet", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (current && data) setBalance(Number(data.balance ?? 0)); })
      .catch(() => {});
    return () => { current = false; };
  }, []);

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    router.push(`/creator?search=${encodeURIComponent(value)}`);
  };

  return (
    <aside className="contributorRightRail" aria-label="Contributor shortcuts">
      <form className="contributorRailSearch" onSubmit={search} role="search">
        <span aria-hidden="true">⌕</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Qeixova" aria-label="Search creator posts" />
      </form>

      <section className="contributorRailCard contributorBalanceCard">
        <span className="contributorRailEyebrow">YOUR ACCOUNT</span>
        <strong>{balance === null ? "···" : `${balance.toLocaleString()} QLT`}</strong>
        <p>Available wallet balance</p>
        <Link href="/wallet">Open wallet <span aria-hidden="true">→</span></Link>
      </section>

      <section className="contributorRailCard">
        <h2>Explore Qeixova</h2>
        <p>Find your next way to contribute.</p>
        <nav className="contributorRailLinks" aria-label="Quick links">
          <Link href="/tasks"><span className="contributorRailLinkIcon">✓</span><span><strong>Missions</strong><small>Browse and earn</small></span><b aria-hidden="true">›</b></Link>
          <Link href="/messages"><span className="contributorRailLinkIcon">◌</span><span><strong>Messages</strong><small>Talk with contributors</small></span><b aria-hidden="true">›</b></Link>
          <Link href="/creator"><span className="contributorRailLinkIcon">✦</span><span><strong>Creator home</strong><small>Share with the community</small></span><b aria-hidden="true">›</b></Link>
        </nav>
      </section>

      <footer className="contributorRailFooter"><Link href="/terms">Guidelines</Link><Link href="/privacy">Privacy</Link><span>Qeixova</span></footer>
    </aside>
  );
}
