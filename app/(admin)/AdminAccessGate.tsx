"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminRole, adminRoutePermission, roleCan } from "@/lib/adminRoles";

export default function AdminAccessGate({ role, children }: { role: AdminRole; children: React.ReactNode }) {
  const pathname = usePathname();
  const permission = adminRoutePermission(pathname);

  if (!roleCan(role, permission)) {
    return <section className="adminAccessDenied" role="alert">
      <span>ACCESS RESTRICTED</span>
      <h1>This section is not available for your role</h1>
      <p>Your <strong>{role.replaceAll("_", " ")}</strong> account does not include <code>{permission}</code> access.</p>
      <Link href="/admin">Return to dashboard</Link>
    </section>;
  }

  return children;
}
