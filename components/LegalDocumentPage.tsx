import Link from "next/link";
import type { LegalDocument } from "@/lib/legalContent";

export default function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <main style={{ minHeight: "100vh", background: "#050505", color: "#f5f5f5", padding: "32px 18px 64px" }}>
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

        <header style={{ border: "1px solid #1f1f1f", borderRadius: 18, background: "#0b0b0b", padding: "28px 24px", marginBottom: 18 }}>
          <p style={{ margin: "0 0 8px", color: "#F5A623", fontSize: 11, fontWeight: 950, textTransform: "uppercase", letterSpacing: ".08em" }}>Legal</p>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.08, letterSpacing: 0 }}>{document.title}</h1>
          <p style={{ margin: "12px 0 0", color: "#bdbdbd", lineHeight: 1.7 }}>{document.summary}</p>
          <p style={{ margin: "14px 0 0", color: "#858585", fontSize: 13 }}>Last updated: {document.updatedAt}</p>
        </header>

        <section style={{ display: "grid", gap: 12 }}>
          {document.sections.map((section) => (
            <article key={section.heading} style={{ border: "1px solid #1b1b1b", borderRadius: 14, background: "#0a0a0a", padding: "18px 20px" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "#fff" }}>{section.heading}</h2>
              <p style={{ margin: 0, color: "#c8c8c8", lineHeight: 1.75, fontSize: 14 }}>{section.body}</p>
            </article>
          ))}
        </section>

        <footer style={{ marginTop: 22, color: "#8d8d8d", fontSize: 13, lineHeight: 1.7 }}>
          For questions about this document, contact <a href="mailto:qeixova@gmail.com" style={{ color: "#F5A623" }}>qeixova@gmail.com</a>.
        </footer>
      </section>
    </main>
  );
}

const navLink: React.CSSProperties = {
  color: "#d9d9d9",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 800,
  border: "1px solid #222",
  borderRadius: 999,
  padding: "8px 12px",
  background: "#0b0b0b",
};
