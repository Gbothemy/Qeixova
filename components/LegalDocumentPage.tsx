import Link from "next/link";
import type { LegalDocument } from "@/lib/legalContent";

export default function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <main style={{ minHeight: "100vh", background: "var(--qeixova-color-fa-fa-fa)", color: "var(--qeixova-color-0a-0a-0a)", padding: "32px 18px 64px" }}>
      <section style={{ maxWidth: 900, margin: "0 auto" }}>
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <Link href="/" style={{ color: "#F5A623", fontWeight: 900, textDecoration: "none" }}>Qeixova</Link>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Link href="/terms" style={navLink}>Terms</Link>
            <Link href="/privacy" style={navLink}>Privacy</Link>
            <Link href="/refund-policy" style={navLink}>Refunds</Link>
            <Link href="/prohibited-campaign-policy" style={navLink}>Prohibited</Link>
          </div>
        </nav>

        <header style={{ border: "1px solid var(--qeixova-color-e0-e0-e0)", borderRadius: 18, background: "var(--qeixova-color-f4-f4-f4)", padding: "28px 24px", marginBottom: 18 }}>
          <p style={{ margin: "0 0 8px", color: "#F5A623", fontSize: 11, fontWeight: 950, textTransform: "uppercase", letterSpacing: ".08em" }}>Legal</p>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.08, letterSpacing: 0 }}>{document.title}</h1>
          <p style={{ margin: "12px 0 0", color: "var(--qeixova-color-42-42-42)", lineHeight: 1.7 }}>{document.summary}</p>
          <p style={{ margin: "14px 0 0", color: "var(--qeixova-color-7a-7a-7a)", fontSize: 13 }}>Last updated: {document.updatedAt}</p>
        </header>

        <section style={{ display: "grid", gap: 12 }}>
          {document.sections.map((section) => (
            <article key={section.heading} style={{ border: "1px solid var(--qeixova-color-e4-e4-e4)", borderRadius: 14, background: "var(--qeixova-color-f5-f5-f5)", padding: "18px 20px" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--qeixova-color-00-00-00)" }}>{section.heading}</h2>
              <p style={{ margin: 0, color: "var(--qeixova-color-37-37-37)", lineHeight: 1.75, fontSize: 14 }}>{section.body}</p>
            </article>
          ))}
        </section>

        <footer style={{ marginTop: 22, color: "var(--qeixova-color-72-72-72)", fontSize: 13, lineHeight: 1.7 }}>
          For questions about this document, contact <a href="mailto:qeixova@gmail.com" style={{ color: "#F5A623" }}>qeixova@gmail.com</a>.
        </footer>
      </section>
    </main>
  );
}

const navLink: React.CSSProperties = {
  color: "var(--qeixova-color-26-26-26)",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 800,
  border: "1px solid var(--qeixova-color-dd-dd-dd)",
  borderRadius: 999,
  padding: "8px 12px",
  background: "var(--qeixova-color-f4-f4-f4)",
};
