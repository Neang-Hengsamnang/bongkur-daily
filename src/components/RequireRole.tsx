import type { ReactNode } from 'react';
import { useAuth, type Role } from '../context/AuthContext';

export default function RequireRole({
  role, children,
}: { role: Role; children: ReactNode }) {
  const { profile } = useAuth();
  if (profile?.role !== role) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        You do not have permission to view this page.
      </div>
    );
  }
  return <>{children}</>;
}