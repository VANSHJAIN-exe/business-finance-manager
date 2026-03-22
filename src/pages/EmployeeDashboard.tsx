import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/auth";
import { uploadPublicFile } from "@/lib/storage";
import { Bell, Briefcase, CheckCircle, ChevronDown, ChevronUp, LogOut, Users, XCircle } from "lucide-react";

type Profile = Tables<"profiles">;
type WorkAssignment = Tables<"work_assignments">;
type Notification = Tables<"notifications">;

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Record<string, WorkAssignment[]>>({});
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewVoiceNotes, setReviewVoiceNotes] = useState<Record<string, File | null>>({});

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/");
        return;
      }

      const { data: employeeProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!employeeProfile || employeeProfile.role !== "employee") {
        await supabase.auth.signOut();
        navigate("/");
        return;
      }

      setProfile(employeeProfile);
      await Promise.all([fetchWorkers(), fetchNotifications(user.id)]);
    };

    void init();
  }, [navigate]);

  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(`employee-${profile.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        if (payload.new.user_id === profile.user_id) {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
          toast.info(payload.new.title);
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile]);

  const fetchNotifications = async (userId: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setNotifications(data);
    }
  };

  const fetchWorkers = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("role", "worker").order("created_at", { ascending: false });
    if (data) setWorkers(data);
  };

  const fetchAssignments = async (workerId: string) => {
    const { data } = await supabase
      .from("work_assignments")
      .select("*")
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false });

    if (data) {
      setAssignments((prev) => ({ ...prev, [workerId]: data }));
    }
  };

  const handleExpand = (workerId: string) => {
    if (expandedWorker === workerId) {
      setExpandedWorker(null);
      return;
    }
    setExpandedWorker(workerId);
    void fetchAssignments(workerId);
  };

  const notifyAdmins = async (title: string, message: string) => {
    const { data: admins } = await supabase.from("profiles").select("user_id").eq("role", "admin");
    if (!admins) return;

    await Promise.all(
      admins.map((admin) =>
        supabase.from("notifications").insert({
          user_id: admin.user_id,
          title,
          message,
        }),
      ),
    );
  };

  const handleReview = async (assignment: WorkAssignment, decision: "approved" | "rejected", worker: Profile) => {
    if (!profile) return;
    setReviewingId(assignment.id);

    try {
      let voiceNoteUrl: string | null = null;
      const reviewVoiceNote = reviewVoiceNotes[assignment.id];
      if (reviewVoiceNote) {
        const ext = reviewVoiceNote.name.split(".").pop();
        const path = `${worker.id}/employee-review-${Date.now()}.${ext}`;
        voiceNoteUrl = await uploadPublicFile("voice-notes", path, reviewVoiceNote);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const status = decision === "approved" ? "reviewed" : "needs_revision";

      const { error } = await supabase
        .from("work_assignments")
        .update({
          review_status: decision,
          employee_review_notes: reviewNotes[assignment.id] || null,
          employee_review_voice_note_url: voiceNoteUrl,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          status,
        })
        .eq("id", assignment.id);

      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: worker.user_id,
        title: decision === "approved" ? "Work Checked" : "Work Rejected",
        message:
          decision === "approved"
            ? `"${assignment.task_name}" was checked by ${profile.full_name}. Waiting for admin verification.`
            : `"${assignment.task_name}" needs changes and can be submitted again.`,
      });

      await notifyAdmins(
        decision === "approved" ? "Ready for Admin Verification" : "Work Needs Revision",
        `${profile.full_name} ${decision} "${assignment.task_name}" for ${worker.full_name}.`,
      );

      toast.success(`Work ${decision}`);
      setReviewNotes((prev) => ({ ...prev, [assignment.id]: "" }));
      setReviewVoiceNotes((prev) => ({ ...prev, [assignment.id]: null }));
      await fetchAssignments(worker.id);
    } catch (error) {
      toast.error(getErrorMessage(error, "Review failed"));
    } finally {
      setReviewingId(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const statusBadge = (assignment: WorkAssignment) => {
    if (assignment.status === "completed") return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Completed</span>;
    if (assignment.review_status === "approved") return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Checked</span>;
    if (assignment.review_status === "rejected" || assignment.status === "needs_revision") return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Rejected</span>;
    if (assignment.status === "submitted") return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Pending Review</span>;
    return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Assigned</span>;
  };

  if (!profile) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Employee Portal</h1>
              <p className="text-sm text-muted-foreground">Welcome, {profile.full_name}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section className="rounded-[1.5rem] border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-card-foreground">Notifications</h3>
          </div>
          <div className="space-y-2">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} className="rounded-lg bg-muted/30 p-2">
                  <p className="text-xs font-semibold">{notification.title}</p>
                  <p className="text-xs text-muted-foreground">{notification.message}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Users className="h-5 w-5" />
            Workers
          </h2>

          {workers.length === 0 ? (
            <div className="rounded-[1.5rem] border border-border bg-card p-8 text-center text-muted-foreground shadow-sm">
              No workers found.
            </div>
          ) : (
            workers.map((worker) => (
              <div key={worker.id} className="overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-sm">
                <button onClick={() => handleExpand(worker.id)} className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/20">
                  <div className="flex items-center gap-3">
                    {worker.avatar_url ? (
                      <img src={worker.avatar_url} alt={worker.full_name} className="h-10 w-10 rounded-full border border-border object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {worker.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{worker.full_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{worker.worker_type || "worker"}</p>
                    </div>
                  </div>
                  {expandedWorker === worker.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {expandedWorker === worker.id && (
                  <div className="space-y-3 border-t border-border bg-muted/10 p-4">
                    {!assignments[worker.id] || assignments[worker.id].length === 0 ? (
                      <p className="text-xs text-muted-foreground">No assignments.</p>
                    ) : (
                      assignments[worker.id].map((assignment) => (
                        <div key={assignment.id} className="space-y-2 rounded-xl border border-border bg-card p-3">
                          <div className="flex items-start gap-3">
                            {assignment.image_url && <img src={assignment.image_url} alt="task" className="h-12 w-12 rounded object-cover border border-border" />}
                            <div className="flex-1">
                              <div className="mb-1 flex items-center gap-2">
                              <p className="font-semibold text-card-foreground">{assignment.task_name}</p>
                              {statusBadge(assignment)}
                            </div>
                              <p className="text-sm text-card-foreground">{assignment.num_pieces} pieces</p>
                              {assignment.notes && <p className="text-xs text-muted-foreground">{assignment.notes}</p>}
                              {assignment.assignment_note_audio_url && (
                                <audio controls className="mt-2 h-10">
                                  <source src={assignment.assignment_note_audio_url} />
                                </audio>
                              )}
                            </div>
                          </div>

                          {assignment.submission_image_url && (
                            <div className="space-y-2 border-t border-border pt-2">
                              <p className="text-xs font-semibold text-muted-foreground">Worker Submission</p>
                              <img src={assignment.submission_image_url} alt="submission" className="h-20 w-20 rounded object-cover border border-border" />
                              {assignment.submission_notes && <p className="text-xs text-muted-foreground">{assignment.submission_notes}</p>}
                              {assignment.submission_voice_note_url && (
                                <audio controls className="h-10">
                                  <source src={assignment.submission_voice_note_url} />
                                </audio>
                              )}
                            </div>
                          )}

                          {assignment.status === "submitted" && !assignment.review_status && (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label className="text-xs">Review Notes</Label>
                                <Textarea
                                  value={reviewNotes[assignment.id] || ""}
                                  onChange={(event) =>
                                    setReviewNotes((prev) => ({ ...prev, [assignment.id]: event.target.value }))
                                  }
                                  placeholder="Review notes"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Voice Note</Label>
                                <Input
                                  type="file"
                                  accept="audio/*"
                                  capture
                                  onChange={(event) =>
                                    setReviewVoiceNotes((prev) => ({ ...prev, [assignment.id]: event.target.files?.[0] || null }))
                                  }
                                />
                              </div>
                              <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                disabled={reviewingId === assignment.id}
                                onClick={() => void handleReview(assignment, "approved", worker)}
                              >
                                <CheckCircle className="mr-1 h-3.5 w-3.5" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={reviewingId === assignment.id}
                                onClick={() => void handleReview(assignment, "rejected", worker)}
                              >
                                <XCircle className="mr-1 h-3.5 w-3.5" />
                                Reject
                              </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
};

export default EmployeeDashboard;
