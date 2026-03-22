import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Profile = Tables<"profiles">;
type Transaction = Tables<"finance_transactions">;
type WorkAssignment = Tables<"work_assignments">;

type PaymentFormState = {
  amount: string;
  created_at: string;
  notes: string;
  audio: File | null;
};

type EditTransactionState = {
  id: string;
  category: string;
  transaction_type: string;
  amount: string;
  created_at: string;
  notes: string;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const toDateTimeLocal = (value: string) => {
  const date = new Date(value);
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const FinancePanel = () => {
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [assignments, setAssignments] = useState<WorkAssignment[]>([]);
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null);
  const [paymentForms, setPaymentForms] = useState<Record<string, PaymentFormState>>({});
  const [editingTransaction, setEditingTransaction] = useState<EditTransactionState | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    const [{ data: workerRows }, { data: transactionRows }, { data: assignmentRows }] = await Promise.all([
      supabase.from("profiles").select("*").eq("role", "worker").order("full_name"),
      supabase.from("finance_transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("work_assignments").select("*").order("created_at", { ascending: false }),
    ]);

    setWorkers(workerRows || []);
    setTransactions(transactionRows || []);
    setAssignments(assignmentRows || []);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const assignmentsByWorker = useMemo(() => {
    const map: Record<string, WorkAssignment[]> = {};
    for (const assignment of assignments) {
      map[assignment.worker_id] = [...(map[assignment.worker_id] || []), assignment];
    }
    return map;
  }, [assignments]);

  const totalPending = useMemo(
    () =>
      workers.reduce((sum, worker) => {
        const workerAssignments = assignmentsByWorker[worker.id] || [];
        const summary = getWorkerFinanceSummary(
          workerAssignments,
          transactions.filter((transaction) => transaction.worker_profile_id === worker.id),
        );
        return sum + summary.totalPending;
      }, 0),
    [workers, assignmentsByWorker, transactions],
  );

  const totalPaid = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction.category === "payment")
        .reduce((sum, transaction) => sum + Number(transaction.amount), 0),
    [transactions],
  );

  const totalBonus = useMemo(
    () =>
      workers.reduce((sum, worker) => {
        const summary = getWorkerFinanceSummary(
          assignmentsByWorker[worker.id] || [],
          transactions.filter((transaction) => transaction.worker_profile_id === worker.id),
        );
        return sum + summary.totalBonus;
      }, 0),
    [workers, assignmentsByWorker, transactions],
  );

  const handlePaymentInputChange = (assignmentId: string, patch: Partial<PaymentFormState>) => {
    setPaymentForms((prev) => ({
      ...prev,
      [assignmentId]: {
        amount: prev[assignmentId]?.amount || "",
        created_at: prev[assignmentId]?.created_at || toDateTimeLocal(new Date().toISOString()),
        notes: prev[assignmentId]?.notes || "",
        audio: prev[assignmentId]?.audio || null,
        ...patch,
      },
    }));
  };

  const handleRecordPayment = async (worker: Profile, assignment: WorkAssignment, pendingAmount: number) => {
    const form = paymentForms[assignment.id];
    const amount = Number(form?.amount || 0);

    if (!amount || amount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }

    setSaving(true);
    try {
      let audioNoteUrl: string | null = null;
      if (form?.audio) {
        const ext = form.audio.name.split(".").pop();
        const path = `${worker.id}/payment-${Date.now()}.${ext}`;
        audioNoteUrl = await uploadPublicFile("voice-notes", path, form.audio);
      }

      const createdAt = form?.created_at ? new Date(form.created_at).toISOString() : new Date().toISOString();
      const extraAmount = Math.max(amount - pendingAmount, 0);

      if (extraAmount > 0) {
        const { error: bonusError } = await supabase.from("finance_transactions").insert({
          worker_profile_id: worker.id,
          assignment_id: assignment.id,
          amount: extraAmount,
          category: "bonus",
          transaction_type: "credit",
          notes: `Extra payment for ${assignment.task_name}`,
          created_at: createdAt,
        });
        if (bonusError) throw bonusError;
      }

      const { error: paymentError } = await supabase.from("finance_transactions").insert({
        worker_profile_id: worker.id,
        assignment_id: assignment.id,
        amount,
        category: "payment",
        transaction_type: "debit",
        notes: form?.notes || `Payment for ${assignment.task_name}`,
        audio_note_url: audioNoteUrl,
        created_at: createdAt,
      });
      if (paymentError) throw paymentError;

      const workerAssignments = assignmentsByWorker[worker.id] || [];
      const updatedTransactions = [
        ...transactions.filter((transaction) => transaction.worker_profile_id === worker.id),
        ...(extraAmount > 0
          ? [{
              id: "temp-bonus",
              worker_profile_id: worker.id,
              assignment_id: assignment.id,
              amount: extraAmount,
              category: "bonus",
              transaction_type: "credit",
              notes: `Extra payment for ${assignment.task_name}`,
              created_at: createdAt,
              audio_note_url: null,
            } as Transaction]
          : []),
        {
          id: "temp-payment",
          worker_profile_id: worker.id,
          assignment_id: assignment.id,
          amount,
          category: "payment",
          transaction_type: "debit",
          notes: form?.notes || `Payment for ${assignment.task_name}`,
          created_at: createdAt,
          audio_note_url: audioNoteUrl,
        } as Transaction,
      ];

      const summary = getWorkerFinanceSummary(workerAssignments, updatedTransactions);
      const { error: workerError } = await supabase
        .from("profiles")
        .update({ wallet_balance: summary.overallBalance })
        .eq("id", worker.id);
      if (workerError) throw workerError;

      const assignmentPendingAfterPayment = getAssignmentPending(updatedTransactions, assignment);
      const { error: assignmentError } = await supabase
        .from("work_assignments")
        .update({
          paid_at: assignmentPendingAfterPayment <= 0 ? createdAt : assignment.paid_at,
        })
        .eq("id", assignment.id);
      if (assignmentError) throw assignmentError;

      setPaymentForms((prev) => ({
        ...prev,
        [assignment.id]: {
          amount: "",
          created_at: toDateTimeLocal(new Date().toISOString()),
          notes: "",
          audio: null,
        },
      }));

      toast.success("Payment recorded");
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to record payment"));
    } finally {
      setSaving(false);
    }
  };

  const startEditTransaction = (transaction: Transaction) => {
    setEditingTransaction({
      id: transaction.id,
      category: transaction.category,
      transaction_type: transaction.transaction_type,
      amount: String(transaction.amount),
      created_at: toDateTimeLocal(transaction.created_at),
      notes: transaction.notes || "",
    });
  };

  const handleSaveTransactionEdit = async () => {
    if (!editingTransaction) return;
    const existing = transactions.find((transaction) => transaction.id === editingTransaction.id);
    if (!existing) return;

    setSaving(true);
    try {
      const worker = workers.find((entry) => entry.id === existing.worker_profile_id);
      if (!worker) throw new Error("Worker not found");

      const { error: txError } = await supabase
        .from("finance_transactions")
        .update({
          category: editingTransaction.category,
          transaction_type: editingTransaction.transaction_type,
          amount: Number(editingTransaction.amount),
          created_at: new Date(editingTransaction.created_at).toISOString(),
          notes: editingTransaction.notes || null,
        })
        .eq("id", editingTransaction.id);
      if (txError) throw txError;

      const workerAssignments = assignmentsByWorker[worker.id] || [];
      const workerTransactions = transactions
        .filter((transaction) => transaction.worker_profile_id === worker.id)
        .map((transaction) =>
          transaction.id === editingTransaction.id
            ? {
                ...transaction,
                category: editingTransaction.category,
                transaction_type: editingTransaction.transaction_type,
                amount: Number(editingTransaction.amount),
                created_at: new Date(editingTransaction.created_at).toISOString(),
                notes: editingTransaction.notes || null,
              }
            : transaction,
        );

      const summary = getWorkerFinanceSummary(workerAssignments, workerTransactions);
      const { error: workerError } = await supabase
        .from("profiles")
        .update({ wallet_balance: summary.overallBalance })
        .eq("id", worker.id);
      if (workerError) throw workerError;

      toast.success("Ledger updated");
      setEditingTransaction(null);
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update ledger"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-card-foreground">Workers Finance</h2>
        <p className="text-sm text-muted-foreground">Accurate worker-wise and task-wise earnings, payments, pending amounts, extras, and balance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending Due</p>
          <p className="mt-2 text-2xl font-semibold text-card-foreground">Rs {totalPending.toFixed(2)}</p>
        </div>
        <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Overall Extra Paid</p>
          <p className="mt-2 text-2xl font-semibold text-card-foreground">Rs {totalBonus.toFixed(2)}</p>
        </div>
        <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Paid</p>
          <p className="mt-2 text-2xl font-semibold text-card-foreground">Rs {totalPaid.toFixed(2)}</p>
        </div>
      </div>

      <div className="space-y-4">
        {workers.map((worker) => {
          const workerAssignments = assignmentsByWorker[worker.id] || [];
          const workerTransactions = transactions.filter((transaction) => transaction.worker_profile_id === worker.id);
          const summary = getWorkerFinanceSummary(workerAssignments, workerTransactions);

          return (
            <div key={worker.id} className="rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
              <button className="flex w-full items-center justify-between text-left" onClick={() => setExpandedWorker((prev) => (prev === worker.id ? null : worker.id))}>
                <div>
                  <h3 className="text-lg font-semibold text-card-foreground">{worker.full_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Earned: Rs {summary.totalEarned.toFixed(2)} | Paid: Rs {summary.totalPaid.toFixed(2)} | Pending: Rs {summary.totalPending.toFixed(2)}
                  </p>
                </div>
                <span className="text-sm font-medium text-primary">{expandedWorker === worker.id ? "Hide" : "Open"}</span>
              </button>

              {expandedWorker === worker.id && (
                <div className="mt-4 space-y-5">
                  <div className="grid gap-3 md:grid-cols-5">
                    <div className="rounded-xl border border-border bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Work Value</p>
                      <p className="mt-1 font-semibold text-card-foreground">Rs {summary.totalEarned.toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid by Admin</p>
                      <p className="mt-1 font-semibold text-card-foreground">Rs {summary.totalPaid.toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
                      <p className="mt-1 font-semibold text-card-foreground">Rs {summary.totalPending.toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Extra Money</p>
                      <p className="mt-1 font-semibold text-card-foreground">Rs {summary.totalBonus.toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Overall Balance</p>
                      <p className="mt-1 font-semibold text-card-foreground">Rs {summary.overallBalance.toFixed(2)}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-card-foreground">Task-wise Finance</h4>
                    <div className="mt-3 space-y-3">
                      {workerAssignments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No work yet.</p>
                      ) : (
                        workerAssignments.map((assignment) => {
                          const earned = getAssignmentEarning(workerTransactions, assignment);
                          const bonus = getAssignmentBonus(workerTransactions, assignment.id);
                          const paid = getAssignmentPaid(workerTransactions, assignment.id);
                          const pending = getAssignmentPending(workerTransactions, assignment);
                          const overallBalance = earned + bonus - paid;
                          const form = paymentForms[assignment.id] || {
                            amount: "",
                            created_at: toDateTimeLocal(new Date().toISOString()),
                            notes: "",
                            audio: null,
                          };

                          return (
                            <div key={assignment.id} className="rounded-xl border border-border bg-muted/20 p-4">
                              <div className="space-y-1">
                                <p className="font-medium text-card-foreground">{assignment.task_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Work Value: Rs {earned.toFixed(2)} | Paid: Rs {paid.toFixed(2)} | Pending: Rs {pending.toFixed(2)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Extra: Rs {bonus.toFixed(2)} | Balance: Rs {overallBalance.toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Assigned: {formatDateTime(assignment.created_at)}
                                  {assignment.completed_at ? ` | Completed: ${formatDateTime(assignment.completed_at)}` : ""}
                                  {assignment.paid_at ? ` | Last Paid: ${formatDateTime(assignment.paid_at)}` : ""}
                                </p>
                              </div>

                              <div className="mt-4 grid gap-3 md:grid-cols-4">
                                <div className="space-y-2">
                                  <Label>Amount Paid</Label>
                                  <Input type="number" step="0.01" value={form.amount} onChange={(event) => handlePaymentInputChange(assignment.id, { amount: event.target.value })} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Date and Time</Label>
                                  <Input type="datetime-local" value={form.created_at} onChange={(event) => handlePaymentInputChange(assignment.id, { created_at: event.target.value })} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Notes</Label>
                                  <Input value={form.notes} onChange={(event) => handlePaymentInputChange(assignment.id, { notes: event.target.value })} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Voice Note</Label>
                                  <Input type="file" accept="audio/*" capture onChange={(event) => handlePaymentInputChange(assignment.id, { audio: event.target.files?.[0] || null })} />
                                </div>
                              </div>

                              <div className="mt-3">
                                <Button size="sm" disabled={saving} onClick={() => void handleRecordPayment(worker, assignment, pending)}>
                                  Record Payment
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-card-foreground">Ledger</h4>
                    <div className="mt-3 space-y-3">
                      {workerTransactions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No ledger entries yet.</p>
                      ) : (
                        workerTransactions.map((transaction) => (
                          <div key={transaction.id} className="rounded-xl border border-border px-4 py-3">
                            {editingTransaction?.id === transaction.id ? (
                              <div className="grid gap-3 md:grid-cols-5">
                                <div className="space-y-2">
                                  <Label>Category</Label>
                                  <Input value={editingTransaction.category} onChange={(event) => setEditingTransaction((prev) => (prev ? { ...prev, category: event.target.value } : prev))} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Type</Label>
                                  <Input value={editingTransaction.transaction_type} onChange={(event) => setEditingTransaction((prev) => (prev ? { ...prev, transaction_type: event.target.value } : prev))} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Amount</Label>
                                  <Input type="number" step="0.01" value={editingTransaction.amount} onChange={(event) => setEditingTransaction((prev) => (prev ? { ...prev, amount: event.target.value } : prev))} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Date and Time</Label>
                                  <Input type="datetime-local" value={editingTransaction.created_at} onChange={(event) => setEditingTransaction((prev) => (prev ? { ...prev, created_at: event.target.value } : prev))} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Notes</Label>
                                  <Input value={editingTransaction.notes} onChange={(event) => setEditingTransaction((prev) => (prev ? { ...prev, notes: event.target.value } : prev))} />
                                </div>
                                <div className="md:col-span-5 flex gap-2">
                                  <Button size="sm" disabled={saving} onClick={() => void handleSaveTransactionEdit()}>
                                    Save Ledger
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingTransaction(null)}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium text-card-foreground">
                                    {transaction.category}: Rs {Number(transaction.amount).toFixed(2)}
                                  </p>
                                  <p className="text-sm text-muted-foreground">{transaction.notes || "No notes"}</p>
                                  <p className="text-xs text-muted-foreground">{formatDateTime(transaction.created_at)}</p>
                                  {transaction.audio_note_url && (
                                    <audio controls className="mt-2 h-10">
                                      <source src={transaction.audio_note_url} />
                                    </audio>
                                  )}
                                </div>
                                <Button size="sm" variant="outline" onClick={() => startEditTransaction(transaction)}>
                                  Edit
                                </Button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default FinancePanel;
