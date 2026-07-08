import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { Loader } from "@/components/Loader/Loader";

// Gates app routes behind a Supabase session.
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <Loader />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
