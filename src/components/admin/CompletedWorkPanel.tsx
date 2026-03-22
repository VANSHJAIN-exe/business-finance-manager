import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type WorkAssignment = Tables<"work_assignments">;

const CompletedWorkPanel = () => {
  const [workers, setWorkers] = useState<Record<string, Profile>>({});
  const [employeesByUserId, setEmployeesByUserId] = useState<Record<string, Profile>>({});
  const [assignments, setAssignments] = useState<WorkAssignment[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const [{ data: workerRows }, { data: employeeRows }, { data: assignmentRows }] = await Promise.all([
        supabase.from("profiles").select("*").eq("role", "worker"),
        supabase.from("profiles").select("*").eq("role", "employee"),
        supabase.from("work_assignments").select("*").eq("status", "completed").order("completed_at", { ascending: false }),
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

    void loadData();
  }, []);

  const totalPaid = useMemo(
    () => assignments.reduce((sum, assignment) => sum + Number(assignment.payout_amount || assignment.total_amount), 0),
    [assignments],
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-card-foreground">Work Done</h2>
          <p className="text-sm text-muted-foreground">Completed assignments and paid work.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-3 text-right shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Paid</p>
          <p className="text-xl font-semibold text-card-foreground">Rs {totalPaid.toFixed(2)}</p>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="rounded-[1.5rem] border border-border bg-card p-8 text-center text-muted-foreground shadow-sm">
          No completed work yet.
        </div>
      ) : (
        assignments.map((assignment) => {
          const worker = workers[assignment.worker_id];
          const reviewer = assignment.reviewed_by ? employeesByUserId[assignment.reviewed_by] : null;
          return (
            <div key={assignment.id} className="rounded-[1.5rem] border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  {assignment.image_url && <img src={assignment.image_url} alt={assignment.task_name} className="h-16 w-16 rounded-xl border border-border object-cover" />}
                  <div>
                    <h3 className="text-lg font-semibold text-card-foreground">{assignment.task_name}</h3>
                    <p className="text-sm text-muted-foreground">{worker?.full_name || "Unknown worker"}</p>
                    <p className="text-sm text-card-foreground">Paid: Rs {Number(assignment.payout_amount || assignment.total_amount).toFixed(2)}</p>
                    {reviewer && <p className="text-xs text-muted-foreground">Employee approved by: {reviewer.full_name}</p>}
                    <p className="text-xs text-muted-foreground">
                      Assigned: {new Date(assignment.created_at).toLocaleString()}
                      {assignment.submitted_at ? ` | Submitted: ${new Date(assignment.submitted_at).toLocaleString()}` : ""}
                      {assignment.reviewed_at ? ` | Employee checked: ${new Date(assignment.reviewed_at).toLocaleString()}` : ""}
                      {assignment.completed_at ? ` | Completed: ${new Date(assignment.completed_at).toLocaleString()}` : ""}
                      {assignment.paid_at ? ` | Paid: ${new Date(assignment.paid_at).toLocaleString()}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {assignment.completed_at ? new Date(assignment.completed_at).toLocaleString() : "Completed"}
                </div>
              </div>
            </div>
          );
        })
      )}
    </section>
  );
};

export default CompletedWorkPanel;
