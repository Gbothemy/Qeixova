import Sidebar from "@/components/Sidebar";
import MobileNavMenu from "@/components/MobileNavMenu";
import GuidedWelcomeMission from "@/components/GuidedWelcomeMission";
import ContributorRightRail from "@/components/ContributorRightRail";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <MobileNavMenu />
      <GuidedWelcomeMission />
      <Sidebar />
      <div className="main-content">
        <div className="contributorWorkspace">
          <div className="contributorWorkspaceMain">{children}</div>
          <ContributorRightRail />
        </div>
      </div>
    </div>
  );
}
