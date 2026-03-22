import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/auth";
import { uploadPublicFile } from "@/lib/storage";
import {
  Trash2,
  Eye,
  EyeOff,
  Plus,
  Upload,
  ChevronDown,
  ChevronUp,
  Pencil,
  Users,
  Droplets,
} from "lucide-react";

type Profile = Tables<"profiles">;
type WorkAssignment = Tables<"work_assignments">;

const WorkersPanel = () => {
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Record<string, WorkAssignment[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [assigningTo, setAssigningTo] = useState<string | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<string | null>(null);

  const [assignTaskName, setAssignTaskName] = useState("");
  const [assignImage, setAssignImage] = useState<File | null>(null);
  const [assignPieces, setAssignPieces] = useState("");
  const [assignPrice, setAssignPrice] = useState("");
  const [assignMeters, setAssignMeters] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [assignVoiceNote, setAssignVoiceNote] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editPieces, setEditPieces] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editMeters, setEditMeters] = useState("");
  const [editTaskName, setEditTaskName] = useState("");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    void fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "worker")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setWorkers(data);
    }

    setLoading(false);
  };

  const fetchAssignments = async (workerId: string) => {
    const { data, error } = await supabase
      .from("work_assignments")
      .select("*")
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false });

    if (!error && data) {
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

  const handleDelete = async (worker: Profile) => {
    if (!confirm(`Delete ${worker.full_name}? This cannot be undone.`)) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { user_id: worker.user_id },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("Account deleted");
      await fetchWorkers();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete"));
    }
  };

  const handleAvatarUpload = async (workerId: string, file: File) => {
    try {
      const ext = file.name.split(".").pop();
      const path = `${workerId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", workerId);

      if (profileError) {
        throw profileError;
      }

      toast.success("Avatar updated");
      await fetchWorkers();
    } catch (error) {
      toast.error(getErrorMessage(error, "Upload failed"));
    }
  };

  const handleAssignWork = async (worker: Profile) => {
    if (!assignTaskName.trim()) {
      toast.error("Please enter a task name");
      return;
    }

    setSubmitting(true);

    try {
      let imageUrl: string | null = null;
      let voiceNoteUrl: string | null = null;

      if (assignImage) {
        const ext = assignImage.name.split(".").pop();
        const path = `${worker.id}/${Date.now()}.${ext}`;
        imageUrl = await uploadPublicFile("work-images", path, assignImage);
      }

      if (assignVoiceNote) {
        const ext = assignVoiceNote.name.split(".").pop();
        const path = `${worker.id}/assignment-${Date.now()}.${ext}`;
        voiceNoteUrl = await uploadPublicFile("voice-notes", path, assignVoiceNote);
      }

      const pieces = parseInt(assignPieces, 10) || 0;
      const price = parseFloat(assignPrice) || 0;
      const meters = assignMeters ? parseFloat(assignMeters) : null;
      const total = pieces * price;

      const { error: assignmentError } = await supabase.from("work_assignments").insert({
        worker_id: worker.id,
        task_name: assignTaskName.trim(),
        image_url: imageUrl,
        num_pieces: pieces,
        price_per_piece: price,
        total_amount: total,
        num_meters: meters,
        notes: assignNotes || null,
        assignment_note_audio_url: voiceNoteUrl,
        status: "assigned",
      });

      if (assignmentError) {
        throw assignmentError;
      }

      const { error: notificationError } = await supabase.from("notifications").insert({
        user_id: worker.user_id,
        title: "New Work Assigned",
        message: `You have been assigned "${assignTaskName.trim()}" - ${pieces} pieces at Rs ${price}/piece`,
      });

      if (notificationError) {
        throw notificationError;
      }

      const { data: employees } = await supabase.from("profiles").select("user_id").eq("role", "employee");
      if (employees) {
        await Promise.all(
          employees.map((employee) =>
            supabase.from("notifications").insert({
              user_id: employee.user_id,
              title: "Work Assigned",
              message: `${worker.full_name} received "${assignTaskName.trim()}".`,
            }),
          ),
        );
      }

      toast.success("Work assigned and worker notified");
      setAssigningTo(null);
      resetAssignForm();
      await fetchAssignments(worker.id);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to assign"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAssignment = async (assignment: WorkAssignment) => {
    setSubmitting(true);

    try {
      const pieces = parseInt(editPieces, 10) || assignment.num_pieces;
      const price = parseFloat(editPrice) || assignment.price_per_piece;
      const meters = editMeters ? parseFloat(editMeters) : assignment.num_meters;
      const total = pieces * price;

      const { error } = await supabase
        .from("work_assignments")
        .update({
          task_name: editTaskName || assignment.task_name,
          notes: editNotes || null,
          num_pieces: pieces,
          price_per_piece: price,
          total_amount: total,
          num_meters: meters,
        })
        .eq("id", assignment.id);

      if (error) {
        throw error;
      }

      toast.success("Assignment updated");
      setEditingAssignment(null);
      await fetchAssignments(assignment.worker_id);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update"));
    } finally {
      setSubmitting(false);
    }
  };

  const resetAssignForm = () => {
    setAssignTaskName("");
    setAssignImage(null);
    setAssignPieces("");
    setAssignPrice("");
    setAssignMeters("");
    setAssignNotes("");
    setAssignVoiceNote(null);
  };

  const statusBadge = (status: string, reviewStatus: string | null) => {
    if (status === "completed") return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Completed</span>;
    if (status === "needs_revision") return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Needs Revision</span>;
    if (status === "reviewed") return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Employee Checked</span>;
    if (reviewStatus === "approved") return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Approved</span>;
    if (reviewStatus === "rejected") return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Rejected</span>;
    if (status === "submitted") return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Submitted</span>;
    return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Assigned</span>;
  };

  const dyers = workers.filter((worker) => worker.worker_type === "dyer");
  const normalWorkers = workers.filter((worker) => worker.worker_type !== "dyer");

  if (loading) {
    return <p className="text-muted-foreground">Loading workers...</p>;
  }

  const renderWorkerCard = (worker: Profile) => (
    <div key={worker.id} className="overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="group relative">
            {worker.avatar_url ? (
              <img src={worker.avatar_url} alt={worker.full_name} className="h-10 w-10 rounded-full border border-border object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {worker.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <Upload className="h-3.5 w-3.5 text-white" />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleAvatarUpload(worker.id, file);
                  }
                }}
              />
            </label>
          </div>
          <div>
            <p className="text-sm font-medium text-card-foreground">{worker.full_name}</p>
            <p className="text-xs text-muted-foreground">Login name: {worker.login_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs font-mono text-muted-foreground">
            {showPassword[worker.id] ? worker.password_plain || "N/A" : "******"}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPassword((prev) => ({ ...prev, [worker.id]: !prev[worker.id] }))}>
            {showPassword[worker.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => void handleDelete(worker)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleExpand(worker.id)}>
            {expandedWorker === worker.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {expandedWorker === worker.id && (
        <div className="space-y-4 border-t border-border bg-muted/20 p-4">
          {assigningTo !== worker.id ? (
            <Button size="sm" onClick={() => setAssigningTo(worker.id)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Assign Work
            </Button>
          ) : (
            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <h4 className="text-sm font-semibold">Assign new work</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Task Name</Label>
                  <Input value={assignTaskName} onChange={(event) => setAssignTaskName(event.target.value)} placeholder="Order or task name" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reference Image</Label>
                  <Input type="file" accept="image/*" capture="environment" onChange={(event) => setAssignImage(event.target.files?.[0] || null)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Voice Note</Label>
                  <Input type="file" accept="audio/*" capture onChange={(event) => setAssignVoiceNote(event.target.files?.[0] || null)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Number of Pieces</Label>
                  <Input type="number" value={assignPieces} onChange={(event) => setAssignPieces(event.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price per Piece (Rs)</Label>
                  <Input type="number" step="0.01" value={assignPrice} onChange={(event) => setAssignPrice(event.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Total Amount (Rs)</Label>
                  <Input readOnly value={(parseFloat(assignPieces || "0") * parseFloat(assignPrice || "0")).toFixed(2)} className="bg-muted" />
                </div>
                {worker.worker_type === "dyer" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Meters to Colour</Label>
                    <Input type="number" step="0.01" value={assignMeters} onChange={(event) => setAssignMeters(event.target.value)} placeholder="0.00" />
                  </div>
                )}
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Notes</Label>
                  <Textarea value={assignNotes} onChange={(event) => setAssignNotes(event.target.value)} placeholder="Optional production notes" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void handleAssignWork(worker)} disabled={submitting}>
                  {submitting ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setAssigningTo(null); resetAssignForm(); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Wallet</p>
                <p className="mt-1 font-semibold text-card-foreground">Rs {Number(worker.wallet_balance || 0).toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">In Progress</p>
                <p className="mt-1 font-semibold text-card-foreground">
                  {assignments[worker.id]?.filter((assignment) => ["assigned", "submitted", "reviewed", "needs_revision"].includes(assignment.status)).length || 0}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed</p>
                <p className="mt-1 font-semibold text-card-foreground">
                  {assignments[worker.id]?.filter((assignment) => assignment.status === "completed").length || 0}
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Submitted</p>
                <p className="mt-1 font-semibold text-card-foreground">
                  {assignments[worker.id]?.filter((assignment) => assignment.status === "submitted").length || 0}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Employee Checked</p>
                <p className="mt-1 font-semibold text-card-foreground">
                  {assignments[worker.id]?.filter((assignment) => assignment.review_status === "approved").length || 0}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total History</p>
                <p className="mt-1 font-semibold text-card-foreground">{assignments[worker.id]?.length || 0} tasks</p>
              </div>
            </div>
            <h4 className="text-sm font-semibold text-muted-foreground">Assignments ({assignments[worker.id]?.length || 0})</h4>
            {!assignments[worker.id] || assignments[worker.id].length === 0 ? (
              <p className="text-xs text-muted-foreground">No assignments yet.</p>
            ) : (
              assignments[worker.id].map((assignment) => (
                <div key={assignment.id} className="space-y-2 rounded-xl border border-border bg-card p-3 text-sm">
                  {editingAssignment === assignment.id ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Task Name</Label>
                        <Input value={editTaskName} onChange={(event) => setEditTaskName(event.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Pieces</Label>
                        <Input type="number" value={editPieces} onChange={(event) => setEditPieces(event.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Price/Piece (Rs)</Label>
                        <Input type="number" step="0.01" value={editPrice} onChange={(event) => setEditPrice(event.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Total (Rs)</Label>
                        <Input readOnly value={(parseFloat(editPieces || "0") * parseFloat(editPrice || "0")).toFixed(2)} className="bg-muted" />
                      </div>
                      {worker.worker_type === "dyer" && (
                        <div>
                          <Label className="text-xs">Meters</Label>
                          <Input type="number" step="0.01" value={editMeters} onChange={(event) => setEditMeters(event.target.value)} />
                        </div>
                      )}
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Notes</Label>
                        <Input value={editNotes} onChange={(event) => setEditNotes(event.target.value)} />
                      </div>
                      <div className="flex gap-2 sm:col-span-2">
                        <Button size="sm" onClick={() => void handleEditAssignment(assignment)} disabled={submitting}>
                          {submitting ? "Saving..." : "Save"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingAssignment(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3">
                        {assignment.image_url && <img src={assignment.image_url} alt="work" className="h-12 w-12 rounded object-cover border border-border" />}
                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            <p className="font-semibold text-card-foreground">{assignment.task_name}</p>
                            {statusBadge(assignment.status, assignment.review_status)}
                          </div>
                          <p className="text-card-foreground">
                            Pieces: <strong>{assignment.num_pieces}</strong> x Rs {Number(assignment.price_per_piece).toFixed(2)} ={" "}
                            <strong>Rs {Number(assignment.total_amount).toFixed(2)}</strong>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Assigned: {new Date(assignment.created_at).toLocaleString()}
                            {assignment.submitted_at ? ` | Submitted: ${new Date(assignment.submitted_at).toLocaleString()}` : ""}
                            {assignment.completed_at ? ` | Completed: ${new Date(assignment.completed_at).toLocaleString()}` : ""}
                          </p>
                          {assignment.num_meters != null && <p className="text-muted-foreground">Meters: <strong>{Number(assignment.num_meters).toFixed(2)}</strong></p>}
                          {assignment.notes && <p className="text-xs text-muted-foreground">{assignment.notes}</p>}
                          {assignment.assignment_note_audio_url && (
                            <audio controls className="mt-2 h-10">
                              <source src={assignment.assignment_note_audio_url} />
                            </audio>
                          )}
                          {assignment.status === "submitted" && assignment.submission_image_url && (
                            <div className="mt-2">
                              <p className="mb-1 text-xs text-muted-foreground">Submission:</p>
                              <img src={assignment.submission_image_url} alt="submission" className="h-16 w-16 rounded object-cover border border-border" />
                              {assignment.submission_notes && <p className="mt-1 text-xs text-muted-foreground">{assignment.submission_notes}</p>}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingAssignment(assignment.id);
                          setEditTaskName(assignment.task_name);
                          setEditPieces(String(assignment.num_pieces));
                          setEditPrice(String(assignment.price_per_piece));
                          setEditMeters(assignment.num_meters != null ? String(assignment.num_meters) : "");
                          setEditNotes(assignment.notes || "");
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Droplets className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-card-foreground">
            Dyers <span className="text-sm font-normal text-muted-foreground">({dyers.length})</span>
          </h3>
        </div>
        {dyers.length === 0 ? <p className="text-sm text-muted-foreground">No dyers yet.</p> : <div className="space-y-3">{dyers.map(renderWorkerCard)}</div>}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-card-foreground">
            Normal Workers <span className="text-sm font-normal text-muted-foreground">({normalWorkers.length})</span>
          </h3>
        </div>
        {normalWorkers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No normal workers yet.</p>
        ) : (
          <div className="space-y-3">{normalWorkers.map(renderWorkerCard)}</div>
        )}
      </section>
    </div>
  );
};

export default WorkersPanel;
