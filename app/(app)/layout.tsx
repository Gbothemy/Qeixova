import Sidebar from "@/components/Sidebar";
import MobileNavMenu from "@/components/MobileNavMenu";
import GuidedWelcomeMission from "@/components/GuidedWelcomeMission";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <MobileNavMenu />
      <GuidedWelcomeMission />
      <Sidebar />
      <div className="main-content">
        {children}
      </div>
    </div>
  );
}
