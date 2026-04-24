import { Outlet, Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, LogOut, Calendar } from "lucide-react";

const AdminLayout = () => {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }
  if (!user) return <Navigate to="/admin/login" state={{ from: location }} replace />;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-muted-foreground">Sua conta não tem permissão de administrador.</p>
        <Button onClick={() => supabase.auth.signOut()}>Sair</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-gradient-soft">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2 text-lg font-medium">
            <Camera className="w-5 h-5 text-primary" />
            <span className="bg-gradient-primary bg-clip-text text-transparent">Photo Delivery</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/admin">
              <Button variant="ghost" size="sm" className="gap-2">
                <Calendar className="w-4 h-4" /> Eventos
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()} className="gap-2">
              <LogOut className="w-4 h-4" /> Sair
            </Button>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
