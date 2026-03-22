import type { Tables } from "@/integrations/supabase/types";

type WorkAssignment = Tables<"work_assignments">;
type Transaction = Tables<"finance_transactions">;

export const getAssignmentBaseAmount = (assignment: WorkAssignment) =>
  Number(assignment.payout_amount || assignment.total_amount || 0);

export const getAssignmentTransactions = (transactions: Transaction[], assignmentId: string) =>
  transactions.filter((transaction) => transaction.assignment_id === assignmentId);

export const getAssignmentEarning = (transactions: Transaction[], assignment: WorkAssignment) => {
  const earningTransactions = getAssignmentTransactions(transactions, assignment.id).filter(
    (transaction) => transaction.category === "earning",
  );

  if (earningTransactions.length === 0) {
    return assignment.admin_review_status === "approved" || assignment.status === "completed"
      ? getAssignmentBaseAmount(assignment)
      : 0;
  }

  return earningTransactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
};

export const getAssignmentBonus = (transactions: Transaction[], assignmentId: string) =>
  getAssignmentTransactions(transactions, assignmentId)
    .filter((transaction) => transaction.category === "bonus")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

export const getAssignmentPaid = (transactions: Transaction[], assignmentId: string) =>
  getAssignmentTransactions(transactions, assignmentId)
    .filter((transaction) => transaction.category === "payment")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

export const getAssignmentPending = (transactions: Transaction[], assignment: WorkAssignment) => {
  const totalDue = getAssignmentEarning(transactions, assignment) + getAssignmentBonus(transactions, assignment.id);
  const paid = getAssignmentPaid(transactions, assignment.id);
  return Math.max(totalDue - paid, 0);
};

export const getWorkerFinanceSummary = (assignments: WorkAssignment[], transactions: Transaction[]) => {
  const totalEarned = assignments.reduce((sum, assignment) => sum + getAssignmentEarning(transactions, assignment), 0);
  const totalBonus = assignments.reduce((sum, assignment) => sum + getAssignmentBonus(transactions, assignment.id), 0);
  const totalPaid = assignments.reduce((sum, assignment) => sum + getAssignmentPaid(transactions, assignment.id), 0);
  const totalPending = assignments.reduce((sum, assignment) => sum + getAssignmentPending(transactions, assignment), 0);

  return {
    totalEarned,
    totalBonus,
    totalPaid,
    totalPending,
    overallBalance: totalEarned + totalBonus - totalPaid,
  };
};
