import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { LockKeyhole, UserPlus } from "lucide-react";
import { getErrorMessage } from "@/lib/auth";

const CreateAccountForm = () => {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"worker" | "employee">("worker");
  const [workerType, setWorkerType] = useState<"dyer" | "normal">("normal");
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-account", {
        body: {
          full_name: name,
          password,
          role,
          ...(role === "worker" ? { worker_type: workerType } : {}),
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(`${role === "worker" ? (workerType === "dyer" ? "Dyer" : "Worker") : "Employee"} account created`);
      setName("");
      setPassword("");
      setRole("worker");
      setWorkerType("normal");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create account"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="rounded-[1.75rem] border border-border/80 bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-card-foreground">Create Account</h2>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <UserPlus className="h-6 w-6" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 lg:grid-cols-2">
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
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="pl-10"
              minLength={6}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={role} onValueChange={(value) => setRole(value as "worker" | "employee")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="worker">Worker</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {role === "worker" && (
          <div className="space-y-2">
            <Label>Worker Type</Label>
            <Select value={workerType} onValueChange={(value) => setWorkerType(value as "dyer" | "normal")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal Worker</SelectItem>
                <SelectItem value="dyer">Dyer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="lg:col-span-2">
          <Button type="submit" className="h-11 min-w-40" disabled={creating}>
            {creating ? "Creating account..." : "Create account"}
          </Button>
        </div>
      </form>
    </section>
  );
};

export default CreateAccountForm;
