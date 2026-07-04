"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit, Trash2, X, Loader2, Save } from "lucide-react";

type Table = {
  _id: string;
  name: string;
  capacity: number;
  qrCode: string;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "INACTIVE";
};

const statusOptions = ["AVAILABLE", "OCCUPIED", "RESERVED", "INACTIVE"] as const;

export default function TableActions({ table }: { table: Table }) {
  const router = useRouter();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: table.name,
    capacity: table.capacity,
    status: table.status,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function openEdit() {
    setEditForm({
      name: table.name,
      capacity: table.capacity,
      status: table.status,
    });
    setError("");
    setShowEditModal(true);
  }

  function closeEdit() {
    setShowEditModal(false);
    setError("");
  }

  function openDelete() {
    setError("");
    setShowDeleteModal(true);
  }

  function closeDelete() {
    setShowDeleteModal(false);
    setError("");
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/tables/${table._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        setError(result.message || "Failed to update table");
        return;
      }

      closeEdit();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/tables/${table._id}`, {
        method: "DELETE",
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        setError(result.message || "Failed to delete table");
        return;
      }

      closeDelete();
      router.refresh();
    } catch {
      setError("Something went wrong while deleting.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Action Buttons */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={openEdit}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-neutral-200 transition hover:bg-white/10 hover:text-white"
        >
          <Edit size={16} />
          Edit
        </button>
        <button
          onClick={openDelete}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
        >
          <Trash2 size={16} />
          Delete
        </button>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0a0a0a] p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-300">Table Management</p>
                <h3 className="mt-1 text-2xl font-semibold">Edit Table</h3>
              </div>
              <button onClick={closeEdit} className="text-neutral-400 hover:text-white">
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm text-neutral-400">Table name</span>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-emerald-400/50"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-neutral-400">Capacity</span>
                <input
                  type="number"
                  min="1"
                  value={editForm.capacity}
                  onChange={(e) => setEditForm({ ...editForm, capacity: Number(e.target.value) })}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-emerald-400/50"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-neutral-400">Status</span>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      status: e.target.value as Table["status"],
                    })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-emerald-400/50"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={loading}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] py-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/10 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-[28px] border border-white/10 bg-[#0a0a0a] p-6">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-red-300">Delete Table?</h3>
              <p className="mt-2 text-sm text-neutral-400">
                Are you sure you want to permanently delete <span className="font-semibold text-white">"{table.name}"</span>?
                This action cannot be undone.
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={closeDelete}
                disabled={loading}
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] py-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/10 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                {loading ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}