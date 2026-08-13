"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BusinessBottomNav from "@/components/BusinessBottomNav";
import BusinessLoading from "@/components/BusinessLoading";
import BusinessSidebar from "@/components/BusinessSidebar";

type Tx = {
  id: number;
  type: "credit" | "debit";
  amount: number;
  label: string;
  status: string;
  provider: string | null;
  reference: string | null;
  created_at: string;
};

type Business = {
  name: string;
  email: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatQlt(value: number) {
  return `${Math.round(value).toLocaleString()} QLT`;
}

export default function BusinessWalletPage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [balance, setBalance] = useState(0);
  const [reserved, setReserved] = useState(0);
  const [spent, setSpent] = useState(0);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [amount, setAmount] = useState("50000");
  const [loading, setLoading] = useState(true);
  const [funding, setFunding] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const amountNumber = Math.max(0, Number(amount) || 0);
  const quickAmounts = useMemo(() => [10000, 25000, 50000, 100000], []);
  const recentTransactions = transactions.slice(0, 8);
  const pendingPayments = transactions.filter((tx) => tx.provider === "flutterwave" && tx.status === "pending").length;
  const estimatedNaira = Math.round(amountNumber / 10);

  const loadWallet = () => {
    fetch("/api/business/wallet")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setBalance(data.balance ?? 0);
        setReserved(data.reserved ?? 0);
        setSpent(data.spent ?? 0);
        setTransactions(data.transactions ?? []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const reference = params.get("reference");
    if (payment === "success") {
      setMessage({ type: "success", text: `Payment confirmed. Reference: ${reference || "Flutterwave"}` });
      window.history.replaceState(null, "", window.location.pathname);
    } else if (payment === "pending") {
      setMessage({ type: "success", text: `Payment is still pending confirmation. Reference: ${reference || "Flutterwave"}` });
      window.history.replaceState(null, "", window.location.pathname);
    } else if (payment === "failed") {
      setMessage({ type: "error", text: `Payment could not be verified. Reference: ${reference || "Flutterwave"}` });
      window.history.replaceState(null, "", window.location.pathname);
    } else if (payment === "missing_reference") {
      setMessage({ type: "error", text: "Flutterwave returned without a payment reference." });
      window.history.replaceState(null, "", window.location.pathname);
    }

    fetch("/api/business/me")
      .then((res) => {
        if (!res.ok) {
          router.push("/business/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.business) setBusiness(data.business);
      });
    loadWallet();
  }, [router]);

  const fundWallet = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFunding(true);
    setMessage(null);

    const res = await fetch("/api/business/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(amount) }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      if (typeof data.authorizationUrl === "string" && data.authorizationUrl.startsWith("http")) {
        setMessage({ type: "success", text: "Redirecting to Flutterwave checkout..." });
        window.location.assign(data.authorizationUrl);
        return;
      }
      setMessage({ type: "error", text: "Flutterwave created the checkout but did not return a payment link. Please try again." });
      if (typeof data.balance === "number") setBalance(data.balance);
      loadWallet();
    } else {
      setMessage({ type: "error", text: data.error || "Could not fund wallet" });
    }
    setFunding(false);
  };

  if (!business || loading) {
    return (
      <BusinessLoading
        title="Loading billing"
        detail="Syncing wallet balance, funding options, and recent transactions."
      />
    );
  }

  return (
    <>
      <div className="businessBillingLayout">
        <BusinessSidebar name={business.name} />
        <main className="page-body business-page-pro billingPage">
          <div className="businessWorkspace billingWorkspace">
            <section className="adsPanel billingHero">
              <div>
                <p className="eyebrow">Business billing</p>
                <h1 className="businessPageTitle">Campaign billing</h1>
                <p>Fund your business wallet, track reserved campaign budget, and reconcile every Flutterwave or manual funding record.</p>
              </div>
              <div className="walletPill">
                <span>Available credit</span>
                <strong>{formatQlt(balance)}</strong>
                <small>≈ ₦{Math.round(balance / 10).toLocaleString()}</small>
              </div>
            </section>

            <section className="summaryGrid" aria-label="Billing summary">
              <div className="summaryCard">
                <span>Available</span>
                <strong>{formatQlt(balance)}</strong>
                <small>Ready for new campaigns</small>
              </div>
              <div className="summaryCard">
                <span>Reserved</span>
                <strong>{formatQlt(reserved)}</strong>
                <small>Held by active campaigns</small>
              </div>
              <div className="summaryCard">
                <span>Spent</span>
                <strong>{formatQlt(spent)}</strong>
                <small>Released to contributors</small>
              </div>
              <div className="summaryCard">
                <span>Pending</span>
                <strong>{pendingPayments}</strong>
                <small>Awaiting Flutterwave confirmation</small>
              </div>
            </section>

            <section className="billingGrid">
              <form className="adsPanel fundPanel" onSubmit={fundWallet}>
              <div className="panelTop">
                <div>
                  <p className="eyebrow">Add funds</p>
                  <h2>Top up campaign wallet</h2>
                  <span>Card payments open Flutterwave checkout. Credit is added after successful verification.</span>
                </div>
              </div>

              {message && <div className={message.type === "success" ? "notice success" : "notice error"}>{message.text}</div>}

              <label className="fieldBlock">
                Amount
                <input type="number" min={1000} value={amount} onChange={(event) => setAmount(event.target.value)} />
              </label>

              <div className="quickAmounts" aria-label="Quick funding amounts">
                {quickAmounts.map((value) => (
                  <button key={value} type="button" className={amountNumber === value ? "active" : ""} onClick={() => setAmount(String(value))}>
                    {formatQlt(value)}
                  </button>
                ))}
              </div>

              <div className="methodGrid" aria-label="Payment method">
                <button type="button" className="selected">
                  <strong>Flutterwave card</strong>
                  <span>Redirects to secure test checkout and verifies before wallet credit.</span>
                </button>
              </div>

              <div className="fundPreview">
                <div>
                  <span>Amount to credit</span>
                  <strong>{formatQlt(amountNumber)}</strong>
                </div>
                <div>
                  <span>Flutterwave charge</span>
                  <strong>₦{estimatedNaira.toLocaleString()}</strong>
                </div>
              </div>

              <button className="primaryButton" type="submit" disabled={funding}>
                {funding ? "Processing..." : "Continue to Flutterwave"}
              </button>
            </form>

            <aside className="billingSide">
              <section className="adsPanel paystackCard">
                <p className="eyebrow">Flutterwave status</p>
                <h2>Test checkout enabled</h2>
                <p>Use Flutterwave checkout during testing. Successful payments return here and credit the wallet automatically.</p>
                <div className="paystackSteps">
                  <div><span>1</span><strong>Create checkout</strong><small>A pending ledger record is created.</small></div>
                  <div><span>2</span><strong>Complete Flutterwave</strong><small>The business pays securely in NGN.</small></div>
                  <div><span>3</span><strong>Verify credit</strong><small>Wallet updates only after Flutterwave confirms.</small></div>
                </div>
              </section>

              <section className="adsPanel policyCard">
                <p className="eyebrow">Funding rules</p>
                <div className="ruleList">
                  <div><span>01</span><strong>10 QLT equals ₦1 for Flutterwave funding.</strong></div>
                  <div><span>02</span><strong>Pending Flutterwave records never increase balance.</strong></div>
                  <div><span>03</span><strong>Campaign launch deducts from available wallet credit.</strong></div>
                </div>
              </section>
            </aside>
            </section>

            <section className="adsPanel transactionsPanel">
            <div className="sectionHead">
              <div>
                <p className="eyebrow">Ledger</p>
                <h2>Recent transactions</h2>
              </div>
              <span>{transactions.length} total</span>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="emptyState">No billing activity yet.</div>
            ) : (
              <div className="txList">
                {recentTransactions.map((tx) => (
                  <article key={tx.id} className="txItem">
                    <div className={tx.type === "credit" ? "txIcon credit" : "txIcon debit"}>
                      {tx.type === "credit" ? "+" : "-"}
                    </div>
                    <div className="txCopy">
                      <strong>{tx.label}</strong>
                      <span>{formatDate(tx.created_at)}{tx.reference ? ` / ${tx.reference}` : ""}</span>
                    </div>
                    <div className="txMeta">
                      <strong className={tx.type === "credit" ? "creditText" : "debitText"}>{tx.type === "credit" ? "+" : "-"}{formatQlt(tx.amount)}</strong>
                      <span className={`statusBadge ${tx.status}`}>{tx.status}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
            </section>
          </div>
        </main>
      </div>
      <BusinessBottomNav />
      <style jsx>{pageStyles}</style>
    </>
  );
}

const pageStyles = `
  .businessBillingLayout {
    min-height: 100vh;
    background:
      radial-gradient(circle at 78% 8%, rgba(245, 166, 35, 0.09), transparent 26%),
      radial-gradient(circle at 40% 100%, rgba(26, 239, 34, 0.05), transparent 34%),
      #000;
  }

  .billingPage {
    min-width: 0;
  }

  .billingLoading {
    min-height: 100vh;
    display: grid;
    place-items: center;
    background: #000;
    color: #bbb;
  }

  .billingWorkspace {
    width: min(100%, 1440px);
    margin: 0 auto;
  }

  .eyebrow {
    margin: 0 0 6px;
    color: #F5A623;
    font-size: 11px;
    font-weight: 950;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }

  .billingWorkspace h1,
  .billingWorkspace h2,
  .billingWorkspace p {
    letter-spacing: 0;
  }

  .billingWorkspace h2 {
    margin: 0;
    color: #F5F5F5;
    font-size: 22px;
  }

  .billingHero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 260px;
    gap: 16px;
    align-items: center;
    padding: 24px;
    margin-bottom: 16px;
    border: 1px solid rgba(255,255,255,.08);
    background:
      linear-gradient(135deg, rgba(245, 166, 35, 0.08), transparent 32%),
      linear-gradient(180deg, rgba(18,18,18,.96), rgba(7,7,7,.98));
  }

  .billingHero h1 {
    max-width: 720px;
    margin: 0;
    font-size: clamp(32px, 4vw, 52px);
    line-height: 1.02;
  }

  .billingHero p:not(.eyebrow) {
    max-width: 670px;
    margin: 10px 0 0;
    color: #bbb;
    font-size: 14px;
    line-height: 1.65;
  }

  .summaryGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .summaryCard {
    min-height: 126px;
    padding: 17px;
    border: 1px solid rgba(255,255,255,.075);
    border-radius: 8px;
    background: #070707;
    box-shadow: 0 18px 44px rgba(0,0,0,.24);
  }

  .summaryCard span,
  .summaryCard small {
    display: block;
    color: #888;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .summaryCard strong {
    display: block;
    margin: 14px 0 8px;
    color: #F5F5F5;
    font-size: clamp(22px, 2.4vw, 30px);
    line-height: 1;
  }

  .summaryCard small {
    color: #777;
    font-size: 12px;
    font-weight: 700;
    text-transform: none;
  }

  .billingGrid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 390px;
    gap: 16px;
    align-items: start;
    margin-bottom: 16px;
  }

  .fundPanel,
  .paystackCard,
  .policyCard,
  .transactionsPanel,
  .billingHero {
    box-shadow: 0 18px 48px rgba(0,0,0,.26);
  }

  .fundPanel,
  .paystackCard,
  .policyCard,
  .transactionsPanel {
    padding: 20px;
    border: 1px solid rgba(255,255,255,.075);
    background: linear-gradient(180deg, rgba(12,12,12,.96), rgba(5,5,5,.98));
  }

  .panelTop,
  .sectionHead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 18px;
    margin-bottom: 22px;
  }

  .panelTop span {
    display: block;
    max-width: 560px;
    margin-top: 7px;
    color: #888;
    font-size: 13px;
    line-height: 1.55;
  }

  .walletPill {
    padding: 15px;
    border: 1px solid rgba(245, 166, 35, .28);
    border-radius: 8px;
    background: rgba(245, 166, 35, .08);
    text-align: right;
  }

  .walletPill span,
  .walletPill strong,
  .walletPill small {
    display: block;
  }

  .walletPill span {
    color: #bbb;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .walletPill strong {
    margin-top: 5px;
    color: #F5F5F5;
    font-size: 24px;
  }

  .walletPill small {
    margin-top: 4px;
    color: #F5A623;
    font-size: 12px;
    font-weight: 850;
  }

  .notice {
    border-radius: 14px;
    padding: 13px 14px;
    margin-bottom: 16px;
    font-size: 13px;
    font-weight: 800;
  }

  .notice.success {
    border: 1px solid rgba(26, 239, 34, .25);
    background: rgba(26, 239, 34, .08);
    color: #1AEF22;
  }

  .notice.error {
    border: 1px solid rgba(229, 62, 62, .28);
    background: rgba(229, 62, 62, .08);
    color: #ff9a9a;
  }

  .fieldBlock {
    display: grid;
    gap: 9px;
    color: #F5F5F5;
    font-size: 13px;
    font-weight: 900;
    margin-bottom: 15px;
  }

  input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #252525;
    border-radius: 8px;
    background: #f1f6ff;
    color: #050505;
    padding: 15px 16px;
    font: inherit;
    font-weight: 850;
    outline: none;
  }

  input:focus {
    border-color: rgba(245, 166, 35, .78);
    box-shadow: 0 0 0 4px rgba(245, 166, 35, .13);
  }

  .quickAmounts,
  .methodGrid {
    display: grid;
    gap: 10px;
    margin-bottom: 15px;
  }

  .quickAmounts {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .methodGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .quickAmounts button,
  .methodGrid button {
    border: 1px solid #222;
    background: #0d0d0d;
    color: #F5F5F5;
    border-radius: 8px;
    cursor: pointer;
    transition: border-color .16s ease, background .16s ease, transform .16s ease;
  }

  .quickAmounts button:hover,
  .methodGrid button:hover {
    transform: translateY(-1px);
    border-color: rgba(245, 166, 35, .5);
  }

  .quickAmounts button {
    padding: 12px 10px;
    font-weight: 900;
  }

  .methodGrid button {
    min-height: 112px;
    padding: 16px;
    text-align: left;
  }

  .quickAmounts button.active,
  .methodGrid button.selected {
    border-color: #F5A623;
    background: rgba(245, 166, 35, .12);
  }

  .methodGrid strong,
  .methodGrid span {
    display: block;
  }

  .methodGrid strong {
    font-size: 15px;
  }

  .methodGrid span {
    color: #888;
    font-size: 12px;
    line-height: 1.5;
    margin-top: 6px;
  }

  .fundPreview {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    border: 1px solid rgba(26, 239, 34, .2);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    background: rgba(26, 239, 34, .07);
  }

  .fundPreview span,
  .sectionHead span {
    color: #888;
    font-size: 12px;
    font-weight: 850;
  }

  .fundPreview span {
    display: block;
    margin-bottom: 5px;
  }

  .fundPreview strong {
    color: #1AEF22;
    font-size: 24px;
  }

  .primaryButton {
    width: 100%;
    border: 0;
    border-radius: 8px;
    padding: 15px 16px;
    background: linear-gradient(135deg, #F5A623, #d89420);
    color: #050505;
    font-weight: 950;
    cursor: pointer;
    box-shadow: 0 16px 34px rgba(245, 166, 35, 0.18);
  }

  .primaryButton:disabled {
    opacity: .55;
    cursor: not-allowed;
  }

  .billingSide {
    display: grid;
    gap: 18px;
  }

  .paystackCard,
  .policyCard {
    padding: 22px;
  }

  .paystackCard p:not(.eyebrow) {
    margin: 10px 0 18px;
    color: #888;
    font-size: 13px;
    line-height: 1.65;
  }

  .paystackSteps {
    display: grid;
    gap: 10px;
  }

  .paystackSteps div {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    column-gap: 10px;
    padding: 13px;
    border: 1px solid #1f1f1f;
    border-radius: 8px;
    background: #050505;
  }

  .paystackSteps span {
    grid-row: span 2;
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: rgba(26, 239, 34, .12);
    color: #1AEF22;
    font-weight: 950;
  }

  .paystackSteps strong,
  .paystackSteps small {
    display: block;
  }

  .paystackSteps strong {
    color: #F5F5F5;
    font-weight: 850;
  }

  .paystackSteps small {
    margin-top: 4px;
    color: #777;
    font-size: 12px;
    line-height: 1.4;
  }

  .ruleList {
    display: grid;
    gap: 10px;
  }

  .ruleList div {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
  }

  .ruleList span {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: #F5A623;
    color: #050505;
    font-size: 11px;
    font-weight: 950;
  }

  .ruleList strong {
    color: #F5F5F5;
    font-size: 13px;
    line-height: 1.45;
  }

  .transactionsPanel {
    margin-top: 18px;
    padding: 22px;
  }

  .sectionHead {
    margin-bottom: 16px;
  }

  .emptyState {
    border: 1px dashed #303030;
    border-radius: 8px;
    padding: 36px;
    color: #888;
    text-align: center;
  }

  .txList {
    display: grid;
    gap: 10px;
  }

  .txItem {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto;
    gap: 13px;
    align-items: center;
    padding: 14px;
    border: 1px solid #1d1d1d;
    border-radius: 8px;
    background: #050505;
  }

  .txIcon {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    font-weight: 950;
  }

  .txIcon.credit {
    background: rgba(26, 239, 34, .11);
    color: #1AEF22;
  }

  .txIcon.debit {
    background: rgba(245, 166, 35, .12);
    color: #F5A623;
  }

  .txCopy strong,
  .txCopy span,
  .txMeta strong,
  .txMeta span {
    display: block;
  }

  .txCopy strong {
    color: #F5F5F5;
    font-size: 14px;
  }

  .txCopy span,
  .txMeta span {
    color: #777;
    font-size: 12px;
    margin-top: 4px;
  }

  .txMeta {
    text-align: right;
    white-space: nowrap;
  }

  .statusBadge {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    margin-top: 6px !important;
    padding: 4px 9px;
    border-radius: 999px;
    border: 1px solid #2a2a2a;
    color: #aaa !important;
    font-size: 11px !important;
    font-weight: 900;
    text-transform: uppercase;
  }

  .statusBadge.completed {
    border-color: rgba(26, 239, 34, .24);
    color: #1AEF22 !important;
    background: rgba(26, 239, 34, .08);
  }

  .statusBadge.pending {
    border-color: rgba(245, 166, 35, .28);
    color: #F5A623 !important;
    background: rgba(245, 166, 35, .08);
  }

  .statusBadge.failed {
    border-color: rgba(229, 62, 62, .3);
    color: #ff9a9a !important;
    background: rgba(229, 62, 62, .08);
  }

  .creditText {
    color: #1AEF22;
  }

  .debitText {
    color: #F5A623;
  }

  @media (max-width: 1180px) {
    .billingGrid,
    .billingHero,
    .summaryGrid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 820px) {
    .fundPanel,
    .paystackCard,
    .policyCard,
    .billingHero,
    .transactionsPanel {
      border-radius: 8px;
      box-shadow: none;
      padding: 16px;
    }

    .panelTop,
    .sectionHead {
      flex-direction: column;
      align-items: stretch;
    }

    .fundPreview {
      grid-template-columns: 1fr;
    }

    .walletPill {
      text-align: left;
      width: 100%;
    }

    .quickAmounts,
    .methodGrid {
      grid-template-columns: 1fr;
    }

    .txItem {
      grid-template-columns: 40px minmax(0, 1fr);
    }

    .txMeta {
      grid-column: 2;
      text-align: left;
    }
  }

  @media (min-width: 1024px) {
    .businessBillingLayout {
      display: flex;
      align-items: flex-start;
    }

    .billingPage {
      flex: 1;
      width: calc(100% - 260px);
    }
  }
`;
