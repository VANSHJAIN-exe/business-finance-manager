import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getErrorMessage, resolveLoginEmail } from "@/lib/auth";

const BOOTSTRAP_ADMIN_NAME = "SRC";
const BOOTSTRAP_ADMIN_PASSWORD = "Bhaishree@123";
const BOOTSTRAP_ADMIN_EMAIL = "src.admin@src.internal";

const ensureAdminProfile = async (userId: string, loginName: string) => {
  const { error } = await supabase.functions.invoke("setup-admin", {
    body: {
      user_id: userId,
      email: BOOTSTRAP_ADMIN_EMAIL,
      login_name: loginName.trim(),
      full_name: "SRC Admin",
    },
  });

  if (error) {
    throw error;
  }
};

const verifyAdminRole = async (userId: string) => {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error) {
    throw error;
  }

  if (!profile || profile.role !== "admin") {
    await supabase.auth.signOut();
    throw new Error("This account is not an admin account.");
  }
};

const AdminLogin = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const { data: adminExists, error: adminExistsError } = await supabase.rpc("admin_exists");

      if (adminExistsError) {
        throw adminExistsError;
      }

      if (!adminExists) {
        if (name.trim().toLowerCase() !== BOOTSTRAP_ADMIN_NAME.toLowerCase() || password !== BOOTSTRAP_ADMIN_PASSWORD) {
          throw new Error("Only the configured bootstrap admin can create the first admin account.");
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: BOOTSTRAP_ADMIN_EMAIL,
          password: BOOTSTRAP_ADMIN_PASSWORD,
        });

        if (signUpError) {
          throw signUpError;
        }

        if (!signUpData.user) {
          throw new Error("Unable to create the first admin account.");
        }

        await ensureAdminProfile(signUpData.user.id, BOOTSTRAP_ADMIN_NAME);

        if (!signUpData.session) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: BOOTSTRAP_ADMIN_EMAIL,
            password: BOOTSTRAP_ADMIN_PASSWORD,
          });

          if (signInError) {
            throw signInError;
          }

          await verifyAdminRole(signInData.user.id);
        } else {
          await verifyAdminRole(signUpData.user.id);
        }

        toast.success("Admin account created");
        navigate("/admin");
        return;
      }

      const email = await resolveLoginEmail(name);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      await verifyAdminRole(data.user.id);
      toast.success("Welcome back");
      navigate("/admin");
    } catch (error) {
      toast.error(getErrorMessage(error, "Admin login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(225,29,72,0.14),_transparent_35%),linear-gradient(180deg,_#fcf7f8_0%,_#f4f4f5_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_0.95fr]">
          <section className="rounded-[2rem] border border-slate-800/70 bg-slate-950 px-6 py-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:px-10 sm:py-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-200">
              Admin Command
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl">Admin Login</h1>
          </section>

          <section className="rounded-[2rem] border border-border/80 bg-card/95 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8">
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to portal selection
            </button>

            <div className="mt-8">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-3xl font-semibold text-foreground">Admin Login</h2>
            </div>

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="admin-name">Name</Label>
                <Input
                  id="admin-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  required
                />
              </div>
              <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={loading}>
                {loading ? "Checking access..." : "Open admin dashboard"}
              </Button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
