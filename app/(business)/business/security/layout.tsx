import BusinessBottomNav from "@/components/BusinessBottomNav";

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell businessPortalShell">
      {children}
      <BusinessBottomNav />
    </div>
  );
}
