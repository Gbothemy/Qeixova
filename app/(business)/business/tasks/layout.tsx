import BusinessBottomNav from "@/components/BusinessBottomNav";

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell" style={{ minHeight: "100vh", background: "var(--qeixova-color-ff-ff-ff)" }}>
      {children}
      <BusinessBottomNav />
    </div>
  );
}
