import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/adminPlatform";
import AdminSidebar from "./AdminSidebar";
import AdminAccessGate from "./AdminAccessGate";
import "./admin.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminContext();
  if (!admin) redirect("/admin-login");

  return (
    <div className="admin-shell">
      <AdminSidebar role={admin.role} name={admin.name} />
      <main className="admin-main">
        <AdminAccessGate role={admin.role}>{children}</AdminAccessGate>
      </main>
    </div>
  );
}
