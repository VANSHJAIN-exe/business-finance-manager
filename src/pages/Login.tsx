import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Briefcase, ShieldCheck, Users } from "lucide-react";
import { getErrorMessage, resolveLoginEmail } from "@/lib/auth";

type LoginRole = "worker" | "employee" | "admin";

const roleConfig: Record<LoginRole, { title: string; subtitle: string; icon: typeof Users; accent: string }> = {
  worker: {
    title: "Worker Login",
    subtitle: "",
    icon: Users,
    accent: "bg-primary/10 text-primary",
  },
  employee: {
    title: "Employee Login",
    subtitle: "",
    icon: Briefcase,
    accent: "bg-accent/10 text-accent",
  },
  admin: {
    title: "Admin Login",
    subtitle: "",
    icon: ShieldCheck,
    accent: "bg-destructive/10 text-destructive",
  },
};

const Login = () => {
  const navigate = useNavigate();
  const params = useParams<{ role: LoginRole }>();
  const role = (params.role || "worker") as LoginRole;
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const config = useMemo(() => roleConfig[role], [role]);

  if (!config) {
    return null;
  }

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const email = await resolveLoginEmail(name);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profile) {
        await supabase.auth.signOut();
        throw new Error("Profile not found. Contact your admin.");
      }

      if (profile.role !== role) {
        await supabase.auth.signOut();
        throw new Error(`This account is not an ${role} account.`);
      }

      toast.success("Welcome back");
      navigate(role === "worker" ? "/worker" : role === "employee" ? "/employee" : "/admin");
    } catch (error) {
      toast.error(getErrorMessage(error, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.16),_transparent_42%),linear-gradient(180deg,_#f8fbfd_0%,_#eef4f7_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-white/60 bg-slate-950 px-6 py-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:px-10 sm:py-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-200">
              Embrace Connect Network
            </div>
            <h1 className="mt-6 max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">{config.title}</h1>
          </section>

          <section className="rounded-[2rem] border border-border/80 bg-card/95 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to portal selection
            </button>

            <div className="mt-8">
              <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${config.accent}`}>
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-3xl font-semibold text-foreground">{config.title}</h2>
            </div>

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  required
                />
              </div>
              <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={loading}>
                {loading ? "Signing in..." : `Continue as ${role}`}
              </Button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Login;
