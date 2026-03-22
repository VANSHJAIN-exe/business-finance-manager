import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/auth";
import {
  getAssignmentBonus,
  getAssignmentEarning,
  getAssignmentPaid,
  getAssignmentPending,
  getWorkerFinanceSummary,
} from "@/lib/finance";
import { uploadPublicFile } from "@/lib/storage";
import { Bell, CheckCircle, Clock, Image, LogOut, Upload, Wallet, XCircle } from "lucide-react";

type WorkAssignment = Tables<"work_assignments">;
type Notification = Tables<"notifications">;
type Profile = Tables<"profiles">;
type Transaction = Tables<"finance_transactions">;

const WorkerDashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignments, setAssignments] = useState<WorkAssignment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submitImage, setSubmitImage] = useState<File | null>(null);
  const [submitNotes, setSubmitNotes] = useState("");
  const [submitVoiceNote, setSubmitVoiceNote] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selfTaskName, setSelfTaskName] = useState("");
  const [selfPieces, setSelfPieces] = useState("");
  const [selfWorkImage, setSelfWorkImage] = useState<File | null>(null);
  const [selfNotes, setSelfNotes] = useState("");
  const [selfVoiceNote, setSelfVoiceNote] = useState<File | null>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/");
        return;
      }

      const { data: workerProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!workerProfile || workerProfile.role !== "worker") {
        await supabase.auth.signOut();
        navigate("/");
        return;
      }

      setProfile(workerProfile);
      await Promise.all([
        fetchAssignments(workerProfile.id),
        fetchNotifications(user.id),
        fetchTransactions(workerProfile.id),
      ]);
    };

    void init();
  }, [navigate]);

  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(`worker-${profile.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        if (payload.new.user_id === profile.user_id) {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
          toast.info(payload.new.title);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "work_assignments" }, () => {
        void fetchAssignments(profile.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_transactions" }, () => {
        void fetchTransactions(profile.id);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile]);

  const fetchAssignments = async (profileId: string) => {
    const { data } = await supabase
      .from("work_assignments")
      .select("*")
      .eq("worker_id", profileId)
      .order("created_at", { ascending: false });

    if (data) {
      setAssignments(data);
    }
  };

  const fetchNotifications = async (userId: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      setNotifications(data);
    }
  };

  const fetchTransactions = async (profileId: string) => {
    const [{ data: txRows }, { data: profileRow }] = await Promise.all([
      supabase.from("finance_transactions").select("*").eq("worker_profile_id", profileId).order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("id", profileId).single(),
    ]);

    if (txRows) {
      setTransactions(txRows);
    }

    if (profileRow) {
      setProfile(profileRow);
    }
  };

  const markAllRead = async () => {
    await Promise.all(
      notifications
        .filter((notification) => !notification.is_read)
        .map((notification) =>
          supabase.from("notifications").update({ is_read: true }).eq("id", notification.id),
        ),
    );
    setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
  };

  const handleSubmitWork = async (assignment: WorkAssignment) => {
    if (!profile) return;
    if (!submitImage) {
      toast.error("Please attach an image of the completed work");
      return;
    }

    setSubmitting(true);
    try {
      const ext = submitImage.name.split(".").pop();
      const path = `submissions/${profile.id}/${Date.now()}.${ext}`;
      const publicUrl = await uploadPublicFile("work-images", path, submitImage);
      let voiceNoteUrl: string | null = null;

      if (submitVoiceNote) {
        const voiceExt = submitVoiceNote.name.split(".").pop();
        const voicePath = `submissions/${profile.id}/voice-${Date.now()}.${voiceExt}`;
        voiceNoteUrl = await uploadPublicFile("voice-notes", voicePath, submitVoiceNote);
      }

      const { error: assignmentError } = await supabase
        .from("work_assignments")
        .update({
          status: "submitted",
          submission_image_url: publicUrl,
          submission_notes: submitNotes || null,
          submission_voice_note_url: voiceNoteUrl,
          submitted_at: new Date().toISOString(),
          review_status: null,
          admin_review_status: null,
        })
        .eq("id", assignment.id);

      if (assignmentError) throw assignmentError;

      const { data: admins } = await supabase.from("profiles").select("user_id").eq("role", "admin");
      if (admins) {
        await Promise.all(
          admins.map((admin) =>
            supabase.from("notifications").insert({
              user_id: admin.user_id,
              title: "Work Submitted",
              message: `${profile.full_name} submitted "${assignment.task_name}".`,
            }),
          ),
        );
      }

      toast.success("Work submitted for review");
      setSubmittingId(null);
      setSubmitImage(null);
      setSubmitNotes("");
      setSubmitVoiceNote(null);
      await fetchAssignments(profile.id);
    } catch (error) {
      toast.error(getErrorMessage(error, "Submission failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOwnWork = async () => {
    if (!profile) return;
    if (!selfTaskName.trim() || !selfWorkImage) {
      toast.error("Task name and work image are required");
      return;
    }

    setSubmitting(true);
    try {
      const imageExt = selfWorkImage.name.split(".").pop();
      const imagePath = `self-work/${profile.id}/${Date.now()}.${imageExt}`;
      const imageUrl = await uploadPublicFile("work-images", imagePath, selfWorkImage);

      let voiceNoteUrl: string | null = null;
      if (selfVoiceNote) {
        const voiceExt = selfVoiceNote.name.split(".").pop();
        const voicePath = `self-work/${profile.id}/voice-${Date.now()}.${voiceExt}`;
        voiceNoteUrl = await uploadPublicFile("voice-notes", voicePath, selfVoiceNote);
      }

      const { error } = await supabase.from("work_assignments").insert({
        worker_id: profile.id,
        task_name: selfTaskName.trim(),
        image_url: imageUrl,
        num_pieces: parseInt(selfPieces, 10) || 0,
        price_per_piece: 0,
        total_amount: 0,
        submission_image_url: imageUrl,
        submission_notes: selfNotes || null,
        submission_voice_note_url: voiceNoteUrl,
        notes: "Worker added this work directly.",
        status: "submitted",
        worker_created: true,
      });

      if (error) throw error;

      const { data: admins } = await supabase.from("profiles").select("user_id").eq("role", "admin");
      if (admins) {
        await Promise.all(
          admins.map((admin) =>
            supabase.from("notifications").insert({
              user_id: admin.user_id,
              title: "Worker Added New Work",
              message: `${profile.full_name} added "${selfTaskName.trim()}" directly for review.`,
            }),
          ),
        );
      }

      toast.success("Work added");
      setSelfTaskName("");
      setSelfPieces("");
      setSelfWorkImage(null);
      setSelfNotes("");
      setSelfVoiceNote(null);
      await fetchAssignments(profile.id);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to add work"));
    } finally {
      setSubmitting(false);
    }
  };

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const statusBadge = (assignment: WorkAssignment) => {
    if (assignment.status === "completed") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
          <CheckCircle className="h-3 w-3" />
          Completed
        </span>
      );
    }

    if (assignment.status === "needs_revision" || assignment.review_status === "rejected") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
          <XCircle className="h-3 w-3" />
          Needs Revision
        </span>
      );
    }

    if (assignment.review_status === "approved") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
          <CheckCircle className="h-3 w-3" />
          Checked by Employee
        </span>
      );
    }

    if (assignment.status === "submitted") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
          <Clock className="h-3 w-3" />
          Under Review
        </span>
      );
    }

    return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Assigned</span>;
  };

  const visibleAssignments = useMemo(() => assignments, [assignments]);
  const financeSummary = useMemo(
    () => getWorkerFinanceSummary(assignments, transactions),
    [assignments, transactions],
  );

  if (!profile) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-bold text-foreground">Worker Portal</h1>
            <p className="text-sm text-muted-foreground">Welcome, {profile.full_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="relative" onClick={() => setShowNotifications((prev) => !prev)}>
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unreadCount}
                </span>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section className="grid gap-4 md:grid-cols-5">
          <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="h-4 w-4" />
              Work Value
            </div>
            <p className="mt-3 text-2xl font-semibold text-card-foreground">Rs {financeSummary.totalEarned.toFixed(2)}</p>
          </div>
          <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Paid by Admin</p>
            <p className="mt-3 text-2xl font-semibold text-card-foreground">Rs {financeSummary.totalPaid.toFixed(2)}</p>
          </div>
          <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="mt-3 text-2xl font-semibold text-card-foreground">Rs {financeSummary.totalPending.toFixed(2)}</p>
          </div>
          <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Extra Paid</p>
            <p className="mt-3 text-2xl font-semibold text-card-foreground">Rs {financeSummary.totalBonus.toFixed(2)}</p>
          </div>
          <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Overall Balance</p>
            <p className="mt-3 text-2xl font-semibold text-card-foreground">Rs {financeSummary.overallBalance.toFixed(2)}</p>
          </div>
        </section>

        {showNotifications && (
          <section className="rounded-[1.5rem] border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => void markAllRead()}>
                  Mark all read
                </Button>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {notifications.length === 0 ? (
                <p className="text-xs text-muted-foreground">No notifications yet.</p>
              ) : (
                notifications.slice(0, 10).map((notification) => (
                  <div
                    key={notification.id}
                    className={`rounded p-2 text-sm ${
                      notification.is_read ? "text-muted-foreground" : "bg-primary/5 font-medium text-card-foreground"
                    }`}
                  >
                    <p className="text-xs font-semibold">{notification.title}</p>
                    <p className="text-xs">{notification.message}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Your Assignments</h2>
          <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
            <h3 className="text-base font-semibold text-card-foreground">Add Work Yourself</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Task Name</Label>
                <Input value={selfTaskName} onChange={(event) => setSelfTaskName(event.target.value)} placeholder="Task name" />
              </div>
              <div className="space-y-2">
                <Label>Work Image</Label>
                <Input type="file" accept="image/*" capture="environment" onChange={(event) => setSelfWorkImage(event.target.files?.[0] || null)} />
              </div>
              <div className="space-y-2">
                <Label>Number of Pieces</Label>
                <Input type="number" min="0" value={selfPieces} onChange={(event) => setSelfPieces(event.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea value={selfNotes} onChange={(event) => setSelfNotes(event.target.value)} placeholder="Notes" />
              </div>
              <div className="space-y-2">
                <Label>Voice Note</Label>
                <Input type="file" accept="audio/*" capture onChange={(event) => setSelfVoiceNote(event.target.files?.[0] || null)} />
              </div>
            </div>
            <div className="mt-4">
              <Button disabled={submitting} onClick={() => void handleCreateOwnWork()}>
                Add Work
              </Button>
            </div>
          </div>
          {visibleAssignments.length === 0 ? (
            <div className="rounded-[1.5rem] border border-border bg-card p-8 text-center text-muted-foreground shadow-sm">
              No work assigned yet.
            </div>
          ) : (
            visibleAssignments.map((assignment) => (
              <div key={assignment.id} className="space-y-3 rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    {assignment.image_url && <img src={assignment.image_url} alt={assignment.task_name} className="h-16 w-16 rounded-xl border border-border object-cover" />}
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          <h3 className="font-semibold text-card-foreground">{assignment.task_name}</h3>
                          {statusBadge(assignment)}
                        </div>
                      <p className="text-sm text-card-foreground">
                        Rs {Number(assignment.total_amount).toFixed(2)} for {assignment.num_pieces} pieces
                      </p>
                      {assignment.worker_created && (
                        <p className="mt-1 text-xs text-muted-foreground">Self-added work. Admin will set price per piece before payment.</p>
                      )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          Earned: Rs {getAssignmentEarning(transactions, assignment).toFixed(2)} | Paid: Rs{" "}
                          {getAssignmentPaid(transactions, assignment.id).toFixed(2)} | Pending: Rs{" "}
                          {getAssignmentPending(transactions, assignment).toFixed(2)} | Extra: Rs{" "}
                          {getAssignmentBonus(transactions, assignment.id).toFixed(2)}
                        </p>
                        {assignment.notes && <p className="mt-1 text-xs text-muted-foreground">{assignment.notes}</p>}
                      </div>
                    </div>
                </div>

                {(assignment.status === "assigned" || assignment.status === "needs_revision") && (
                  <>
                    {submittingId === assignment.id ? (
                      <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Image of completed work</Label>
                          <Input type="file" accept="image/*" capture="environment" onChange={(event) => setSubmitImage(event.target.files?.[0] || null)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Voice Note</Label>
                          <Input type="file" accept="audio/*" capture onChange={(event) => setSubmitVoiceNote(event.target.files?.[0] || null)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Notes</Label>
                          <Textarea value={submitNotes} onChange={(event) => setSubmitNotes(event.target.value)} placeholder="Notes" />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" disabled={submitting} onClick={() => void handleSubmitWork(assignment)}>
                            {submitting ? "Submitting..." : "Submit Work"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSubmittingId(null);
                              setSubmitImage(null);
                              setSubmitNotes("");
                              setSubmitVoiceNote(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setSubmittingId(assignment.id)}>
                        <Upload className="mr-1 h-3.5 w-3.5" />
                        Submit Work
                      </Button>
                    )}
                  </>
                )}

                {assignment.submission_image_url && (
                  <div className="flex items-start gap-3 border-t border-border pt-2">
                    <Image className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Your Submission</p>
                      <img src={assignment.submission_image_url} alt="submission" className="h-16 w-16 rounded object-cover border border-border" />
                      {assignment.submission_notes && <p className="mt-1 text-xs text-muted-foreground">{assignment.submission_notes}</p>}
                      {assignment.submission_voice_note_url && (
                        <audio controls className="mt-2 h-10">
                          <source src={assignment.submission_voice_note_url} />
                        </audio>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </section>

        <section className="rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground">Wallet History</h2>
          <div className="mt-4 space-y-3">
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                  <div>
                    <p className="font-medium capitalize text-card-foreground">
                      {transaction.category} | {transaction.notes || "Wallet entry"}
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(transaction.created_at).toLocaleString()}</p>
                  </div>
                  <p className="font-semibold text-card-foreground">
                    {transaction.transaction_type === "debit" ? "-" : "+"}Rs {Number(transaction.amount).toFixed(2)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default WorkerDashboard;
