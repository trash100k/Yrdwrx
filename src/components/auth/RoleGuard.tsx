import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useRole } from '../../hooks/useRole';

interface RoleGuardProps {
  allowedRoles: Array<any>;
  redirectPath?: string;
  children?: React.ReactNode;
}

export function RoleGuard({ allowedRoles, redirectPath = '/', children }: RoleGuardProps) {
  const { role, loadingRole } = useRole();

  if (loadingRole) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-zinc-950">
        <div className="w-8 h-8 border border-white/5 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const hasAccess = role && allowedRoles.includes(role);

  if (!hasAccess) {
    // If they don't have access, redirect to their appropriate home
    let fallback = '/';
    if (role === 'admin' || role === 'owner') fallback = '/admin';
    if (role === 'employee') fallback = '/employee';
    if (role === 'client') fallback = '/client';
    
    return <Navigate to={redirectPath || fallback} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
