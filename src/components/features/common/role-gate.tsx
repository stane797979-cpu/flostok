"use client";

import { type ReactNode } from "react";

type UserRole = "admin" | "manager" | "viewer" | "warehouse";

interface RoleGateProps {
  allowedRoles: UserRole[];
  userRole: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGate({
  allowedRoles,
  userRole,
  children,
  fallback = null,
}: RoleGateProps) {
  const hasPermission = allowedRoles.includes(userRole as UserRole);

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
