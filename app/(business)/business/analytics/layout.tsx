import BusinessBottomNav from "@/components/BusinessBottomNav";

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell businessPortalShell">
      {children}
      <BusinessBottomNav />
    </div>
  );
}
