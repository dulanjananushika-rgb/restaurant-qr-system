"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Loader2, Pencil, Trash2 } from "lucide-react";
import CategoryForm from "@/components/admin/CategoryForm";

type Category = {
  _id: string;
  name: string;
  description?: string;
  createdAt?: string;
};

export default function CategoryManager({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingId, setDeletingId] = useState("");

  function refreshPage() {
    setEditingCategory(null);
    router.refresh();
  }

  async function deleteCategory(category: Category) {
    const confirmed = confirm(
      `Are you sure you want to delete "${category.name}" category?`
    );

    if (!confirmed) return;

    setDeletingId(category._id);

    try {
      const response = await fetch(`/api/admin/categories/${category._id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to delete category");
        return;
      }

      if (editingCategory?._id === category._id) {
        setEditingCategory(null);
      }

      router.refresh();
    } catch {
      alert("Something went wrong while deleting category.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
      <CategoryForm
        editingCategory={editingCategory}
        onSuccess={refreshPage}
        onCancel={() => setEditingCategory(null)}
      />

      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Category List</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Manage menu groupings used across ordering screens.
          </p>
        </div>

        <div className="space-y-3">
          {categories.map((category) => {
            const isDeleting = deletingId === category._id;

            return (
              <div
                key={category._id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                    <FolderOpen size={20} />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {category.name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                      {category.description || "No description added"}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCategory(category)}
                    disabled={isDeleting}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Pencil size={15} />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteCategory(category)}
                    disabled={isDeleting}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}

          {categories.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-sm text-neutral-500">
              No categories found.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}