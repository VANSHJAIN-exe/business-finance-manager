import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/auth";
import { Trash2, Eye, EyeOff, Briefcase, Bell } from "lucide-react";

type Profile = Tables<"profiles">;
type Notification = Tables<"notifications">;

const EmployeesPanel = () => {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [adminNotifications, setAdminNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    void fetchEmployees();
    void fetchAdminNotifications();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, async (payload) => {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && payload.new.user_id === user.id) {
          setAdminNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "employee")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setEmployees(data);
    }

    setLoading(false);
  };

  const fetchAdminNotifications = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      setAdminNotifications(data);
    }
  };

  const handleDelete = async (employee: Profile) => {
    if (!confirm(`Delete ${employee.full_name}? This cannot be undone.`)) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { user_id: employee.user_id },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("Account deleted");
      await fetchEmployees();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete"));
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading employees...</p>;
  }

  return (
    <div className="space-y-6">
      {adminNotifications.length > 0 && (
        <section className="rounded-[1.5rem] border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-card-foreground">Recent Notifications</h3>
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {adminNotifications.slice(0, 10).map((notification) => (
              <div
                key={notification.id}
                className={`rounded p-2 text-sm ${
                  notification.is_read ? "text-muted-foreground" : "bg-primary/5 text-card-foreground"
                }`}
              >
                <p className="text-xs font-semibold">{notification.title}</p>
                <p className="text-xs">{notification.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {employees.length === 0 ? (
        <div className="rounded-[1.5rem] border border-border bg-card p-8 text-center shadow-sm">
          <Briefcase className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No employees yet. Create one from the Create Account tab.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {employees.map((employee) => (
            <div key={employee.id} className="flex items-center justify-between rounded-[1.5rem] border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                  {employee.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-card-foreground">{employee.full_name}</p>
                  <p className="text-xs text-muted-foreground">Login name: {employee.login_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="mr-1 text-xs font-mono text-muted-foreground">
                  {showPassword[employee.id] ? employee.password_plain || "N/A" : "******"}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPassword((prev) => ({ ...prev, [employee.id]: !prev[employee.id] }))}>
                  {showPassword[employee.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => void handleDelete(employee)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeesPanel;
