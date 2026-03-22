import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/auth";
import { getWorkerFinanceSummary } from "@/lib/finance";
import { uploadPublicFile } from "@/lib/storage";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";

type Profile = Tables<"profiles">;
type WorkAssignment = Tables<"work_assignments">;

const PendingWorkPanel = () => {
  const [workers, setWorkers] = useState<Record<string, Profile>>({});
  const [employeesByUserId, setEmployeesByUserId] = useState<Record<string, Profile>>({});
  const [assignments, setAssignments] = useState<WorkAssignment[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [adminVoiceNotes, setAdminVoiceNotes] = useState<Record<string, File | null>>({});
  const [pricing, setPricing] = useState<Record<string, { pieces: string; price: string }>>({});

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    const [{ data: workerRows }, { data: employeeRows }, { data: assignmentRows }] = await Promise.all([
      supabase.from("profiles").select("*").eq("role", "worker"),
      supabase.from("profiles").select("*").eq("role", "employee"),
      supabase
        .from("work_assignments")
        .select("*")
        .neq("status", "completed")
        .order("updated_at", { ascending: false }),
    ]);

    if (workerRows) {
      setWorkers(Object.fromEntries(workerRows.map((worker) => [worker.id, worker])));
    }

    if (employeeRows) {
      setEmployeesByUserId(Object.fromEntries(employeeRows.map((employee) => [employee.user_id, employee])));
    }

    if (assignmentRows) {
      setAssignments(assignmentRows);
    }
  };

  const pendingAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.status !== "completed"),
    [assignments],
  );

  const getPricingState = (assignment: WorkAssignment) =>
    pricing[assignment.id] || {
      pieces: String(assignment.num_pieces || 0),
      price: String(assignment.price_per_piece || 0),
    };

  const handleApprove = async (assignment: WorkAssignment) => {
    const worker = workers[assignment.worker_id];
    if (!worker) return;

    setProcessingId(assignment.id);
    try {
      let voiceNoteUrl: string | null = null;
      if (adminVoiceNotes[assignment.id]) {
        const ext = adminVoiceNotes[assignment.id]!.name.split(".").pop();
        const path = `${worker.id}/admin-review-${Date.now()}.${ext}`;
        voiceNoteUrl = await uploadPublicFile("voice-notes", path, adminVoiceNotes[assignment.id]!);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const pricingState = getPricingState(assignment);
      const pieces = Math.max(parseInt(pricingState.pieces, 10) || 0, 0);
      const pricePerPiece = Math.max(parseFloat(pricingState.price) || 0, 0);
      const payout = pieces * pricePerPiece;

      const { error: transactionError } = await supabase.from("finance_transactions").insert({
        worker_profile_id: worker.id,
        assignment_id: assignment.id,
        amount: payout,
        category: "earning",
        transaction_type: "credit",
        notes: `Payment released for ${assignment.task_name}`,
      });

      if (transactionError) throw transactionError;

      const { error: assignmentError } = await supabase
        .from("work_assignments")
        .update({
          admin_review_status: "approved",
          admin_review_notes: adminNotes[assignment.id] || null,
          admin_review_voice_note_url: voiceNoteUrl,
          admin_reviewed_at: new Date().toISOString(),
          admin_reviewed_by: user?.id ?? null,
          num_pieces: pieces,
          price_per_piece: pricePerPiece,
          total_amount: payout,
          payout_amount: payout,
          paid_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          status: "completed",
        })
        .eq("id", assignment.id);

      if (assignmentError) throw assignmentError;

      const [{ data: workerAssignments }, { data: workerTransactions }] = await Promise.all([
        supabase.from("work_assignments").select("*").eq("worker_id", worker.id),
        supabase.from("finance_transactions").select("*").eq("worker_profile_id", worker.id),
      ]);

      const summary = getWorkerFinanceSummary(workerAssignments || [], workerTransactions || []);
      const { error: walletError } = await supabase
        .from("profiles")
        .update({ wallet_balance: summary.overallBalance })
        .eq("id", worker.id);

      if (walletError) throw walletError;

      await supabase.from("notifications").insert({
        user_id: worker.user_id,
        title: "Payment Released",
        message: `Admin verified "${assignment.task_name}" and added Rs ${payout.toFixed(2)} to your wallet.`,
      });

      toast.success("Work approved and wallet updated");
      setPricing((prev) => {
        const next = { ...prev };
        delete next[assignment.id];
        return next;
      });
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to approve work"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (assignment: WorkAssignment) => {
    const worker = workers[assignment.worker_id];
    if (!worker) return;

    setProcessingId(assignment.id);
    try {
      let voiceNoteUrl: string | null = null;
      if (adminVoiceNotes[assignment.id]) {
        const ext = adminVoiceNotes[assignment.id]!.name.split(".").pop();
        const path = `${worker.id}/admin-reject-${Date.now()}.${ext}`;
        voiceNoteUrl = await uploadPublicFile("voice-notes", path, adminVoiceNotes[assignment.id]!);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("work_assignments")
        .update({
          admin_review_status: "rejected",
          admin_review_notes: adminNotes[assignment.id] || null,
          admin_review_voice_note_url: voiceNoteUrl,
          admin_reviewed_at: new Date().toISOString(),
          admin_reviewed_by: user?.id ?? null,
          status: "needs_revision",
        })
        .eq("id", assignment.id);

      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: worker.user_id,
        title: "Work Sent Back",
        message: `Admin sent "${assignment.task_name}" back for changes.`,
      });

      toast.success("Work sent back");
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to reject work"));
    } finally {
      setProcessingId(null);
    }
  };

  const statusText = (assignment: WorkAssignment) => {
    if (assignment.review_status === "approved") return "Ready for admin approval";
    if (assignment.review_status === "rejected" || assignment.status === "needs_revision") return "Needs revision";
    if (assignment.status === "submitted") return "Waiting for employee review";
    return "Assigned";
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-card-foreground">Work Pending</h2>
        <p className="text-sm text-muted-foreground">Track assigned, submitted, and reviewed work.</p>
      </div>

      {pendingAssignments.length === 0 ? (
        <div className="rounded-[1.5rem] border border-border bg-card p-8 text-center text-muted-foreground shadow-sm">
          No pending work.
        </div>
      ) : (
        pendingAssignments.map((assignment) => {
          const worker = workers[assignment.worker_id];
          const reviewer = assignment.reviewed_by ? employeesByUserId[assignment.reviewed_by] : null;
          return (
            <div key={assignment.id} className="space-y-3 rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  {assignment.image_url && (
                    <img src={assignment.image_url} alt={assignment.task_name} className="h-16 w-16 rounded-xl border border-border object-cover" />
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-card-foreground">{assignment.task_name}</h3>
                    <p className="text-sm text-muted-foreground">{worker?.full_name || "Unknown worker"}</p>
                    <p className="text-sm text-card-foreground">
                      Rs {Number(assignment.total_amount).toFixed(2)} for {assignment.num_pieces} pieces
                    </p>
                    {assignment.worker_created && (
                      <p className="text-xs text-muted-foreground">Worker added this work directly. Set pieces and price before payment.</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Assigned: {new Date(assignment.created_at).toLocaleString()}
                      {assignment.submitted_at ? ` | Submitted: ${new Date(assignment.submitted_at).toLocaleString()}` : ""}
                      {assignment.reviewed_at ? ` | Employee checked: ${new Date(assignment.reviewed_at).toLocaleString()}` : ""}
                    </p>
                    {reviewer && (
                      <p className="text-xs text-muted-foreground">Employee reviewer: {reviewer.full_name}</p>
                    )}
                  </div>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  {statusText(assignment)}
                </span>
              </div>

              {assignment.submission_image_url && (
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Submitted work</p>
                  <div className="flex items-start gap-3">
                    <img src={assignment.submission_image_url} alt="submission" className="h-20 w-20 rounded-lg border border-border object-cover" />
                    <div className="space-y-1 text-sm">
                      {assignment.submission_notes && <p className="text-muted-foreground">{assignment.submission_notes}</p>}
                      {assignment.review_status && (
                        <p className="font-medium text-card-foreground">Employee review: {assignment.review_status}</p>
                      )}
                      {reviewer && (
                        <p className="text-muted-foreground">Approved by employee: {reviewer.full_name}</p>
                      )}
                      {assignment.admin_review_status && (
                        <p className="font-medium text-card-foreground">Admin review: {assignment.admin_review_status}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {assignment.review_status === "approved" && assignment.admin_review_status !== "approved" && (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Pieces</Label>
                      <Input
                        type="number"
                        min="0"
                        value={getPricingState(assignment).pieces}
                        onChange={(event) =>
                          setPricing((prev) => ({
                            ...prev,
                            [assignment.id]: {
                              ...getPricingState(assignment),
                              pieces: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Price Per Piece</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={getPricingState(assignment).price}
                        onChange={(event) =>
                          setPricing((prev) => ({
                            ...prev,
                            [assignment.id]: {
                              ...getPricingState(assignment),
                              price: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Payout</Label>
                      <Input
                        readOnly
                        className="bg-muted"
                        value={(
                          (parseInt(getPricingState(assignment).pieces, 10) || 0) *
                          (parseFloat(getPricingState(assignment).price) || 0)
                        ).toFixed(2)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Admin Notes</Label>
                    <Textarea
                      value={adminNotes[assignment.id] || ""}
                      onChange={(event) => setAdminNotes((prev) => ({ ...prev, [assignment.id]: event.target.value }))}
                      placeholder="Admin notes"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Voice Note</Label>
                    <Input
                      type="file"
                      accept="audio/*"
                      capture
                      onChange={(event) =>
                        setAdminVoiceNotes((prev) => ({ ...prev, [assignment.id]: event.target.files?.[0] || null }))
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                  <Button size="sm" disabled={processingId === assignment.id} onClick={() => void handleApprove(assignment)}>
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Verify and Pay
                  </Button>
                  <Button size="sm" variant="outline" disabled={processingId === assignment.id} onClick={() => void handleReject(assignment)}>
                    <XCircle className="mr-1 h-4 w-4" />
                    Send Back
                  </Button>
                  </div>
                </div>
              )}

              {assignment.review_status !== "approved" && (
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock3 className="h-4 w-4" />
                  Admin payout becomes available after employee approval.
                </div>
              )}
            </div>
          );
        })
      )}
    </section>
  );
};

export default PendingWorkPanel;
