"use client";

import { useState } from "react";
import { Loader2, Plus, Save } from "lucide-react";

type Category = {
  _id: string;
  name: string;
  description?: string;
};

export default function CategoryForm({
  editingCategory,
  onSuccess,
  onCancel,
}: {
  editingCategory?: Category | null;
  onSuccess: () => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(editingCategory?.name || "");
  const [description, setDescription] = useState(
    editingCategory?.description || ""
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isEditing = Boolean(editingCategory?._id);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = isEditing
        ? `/api/admin/categories/${editingCategory?._id}`
        : "/api/admin/categories";

      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Failed to save category");
        return;
      }

      setName("");
      setDescription("");
      onSuccess();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5"
    >
      <div className="mb-5">
        <p className="text-sm font-medium text-emerald-300">
          {isEditing ? "Edit Category" : "Add Category"}
        </p>
        <h2 className="mt-2 text-xl font-semibold">
          {isEditing ? "Update food category" : "Create a new food category"}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Categories help organize menu items for staff and customers.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm text-neutral-400">
            Category name
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Rice"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-neutral-400">
            Description
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Short description for this category"
            rows={4}
            className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
          />
        </label>

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          {isEditing && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-neutral-300 hover:bg-white/10"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : isEditing ? (
              <Save size={18} />
            ) : (
              <Plus size={18} />
            )}
            {loading
              ? "Saving..."
              : isEditing
              ? "Update Category"
              : "Add Category"}
          </button>
        </div>
      </div>
    </form>
  );
}