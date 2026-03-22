import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, UserPlus, Users, Briefcase } from "lucide-react";
import CreateAccountForm from "@/components/admin/CreateAccountForm";
import WorkersPanel from "@/components/admin/WorkersPanel";
import EmployeesPanel from "@/components/admin/EmployeesPanel";
import PendingWorkPanel from "@/components/admin/PendingWorkPanel";
import CompletedWorkPanel from "@/components/admin/CompletedWorkPanel";
import FinancePanel from "@/components/admin/FinancePanel";

const navItems = [
  { path: "/admin", label: "Create Account", icon: UserPlus },
  { path: "/admin/workers", label: "Workers", icon: Users },
  { path: "/admin/employees", label: "Employees", icon: Briefcase },
  { path: "/admin/pending", label: "Work Pending", icon: Briefcase },
  { path: "/admin/done", label: "Work Done", icon: Briefcase },
  { path: "/admin/workers-finance", label: "Workers Finance", icon: Briefcase },
  { path: "/admin/finances", label: "Finances", icon: Briefcase },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/srcadminpanel"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      if (!profile || profile.role !== "admin") {
        await supabase.auth.signOut();
        navigate("/srcadminpanel");
        return;
      }
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/srcadminpanel");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const currentPath = location.pathname;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f7fafc_0%,_#edf3f6_100%)]">
      <header className="sticky top-0 z-10 border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
        <nav className="mx-auto max-w-6xl px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {currentPath === "/admin" && <CreateAccountForm />}
        {currentPath === "/admin/workers" && <WorkersPanel />}
        {currentPath === "/admin/employees" && <EmployeesPanel />}
        {currentPath === "/admin/pending" && <PendingWorkPanel />}
        {currentPath === "/admin/done" && <CompletedWorkPanel />}
        {currentPath === "/admin/workers-finance" && <FinancePanel />}
        {currentPath === "/admin/finances" && <FinancePanel />}
      </main>
    </div>
  );
};

export default AdminDashboard;
