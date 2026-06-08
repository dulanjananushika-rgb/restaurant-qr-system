"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Boxes,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  Save,
  X,
} from "lucide-react";

type InventoryItem = {
  _id: string;
  name: string;
  unit: "kg" | "g" | "pcs" | "L" | "ml";
  quantity: number;
  minQuantity: number;
};

const units = ["kg", "g", "pcs", "L", "ml"] as const;

export default function InventoryManager({
  items,
}: {
  items: InventoryItem[];
}) {
  const router = useRouter();

  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [name, setName] = useState("");
  const [unit, setUnit] = useState<InventoryItem["unit"]>("kg");
  const [quantity, setQuantity] = useState("");
  const [minQuantity, setMinQuantity] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isEditing = Boolean(editingItem);

  function startEdit(item: InventoryItem) {
    setEditingItem(item);
    setName(item.name);
    setUnit(item.unit);
    setQuantity(item.quantity.toString());
    setMinQuantity(item.minQuantity.toString());
    setError("");
  }

  function resetForm() {
    setEditingItem(null);
    setName("");
    setUnit("kg");
    setQuantity("");
    setMinQuantity("");
    setError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = isEditing
        ? `/api/admin/inventory/${editingItem?._id}`
        : "/api/admin/inventory";

      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          unit,
          quantity,
          minQuantity,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Failed to save inventory item");
        return;
      }

      resetForm();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.5fr]">
      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5">
          <p className="text-sm font-medium text-emerald-300">
            {isEditing ? "Edit Stock Item" : "Add Stock Item"}
          </p>

          <h2 className="mt-2 text-xl font-semibold">
            {isEditing ? "Update inventory item" : "Create inventory item"}
          </h2>

          <p className="mt-1 text-sm leading-6 text-neutral-500">
            Track ingredients such as chicken, rice, cheese, oil and drinks.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm text-neutral-400">
              Item name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Chicken"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-neutral-400">Unit</span>
            <select
              value={unit}
              onChange={(event) =>
                setUnit(event.target.value as InventoryItem["unit"])
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-emerald-400/50"
            >
              {units.map((item) => (
                <option key={item} value={item} className="bg-[#0B0F14]">
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-neutral-400">
              Current quantity
            </span>
            <input
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="10"
              type="number"
              min="0"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-neutral-400">
              Minimum quantity
            </span>
            <input
              value={minQuantity}
              onChange={(event) => setMinQuantity(event.target.value)}
              placeholder="5"
              type="number"
              min="0"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
            />
          </label>

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/10"
              >
                <X size={17} />
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : isEditing ? (
                <Save size={17} />
              ) : (
                <Plus size={17} />
              )}
              {loading ? "Saving..." : isEditing ? "Update Item" : "Add Item"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Inventory Stock List</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Low stock items are highlighted automatically.
          </p>
        </div>

        <div className="space-y-3">
          {items.map((item) => {
            const isLowStock = item.quantity <= item.minQuantity;

            return (
              <div
                key={item._id}
                className={`rounded-2xl border p-4 ${
                  isLowStock
                    ? "border-amber-500/20 bg-amber-500/10"
                    : "border-white/10 bg-black/20"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                        isLowStock
                          ? "bg-amber-500/10 text-amber-300"
                          : "bg-emerald-500/10 text-emerald-300"
                      }`}
                    >
                      {isLowStock ? (
                        <AlertTriangle size={20} />
                      ) : (
                        <PackageCheck size={20} />
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Minimum stock: {item.minQuantity} {item.unit}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-300 transition hover:bg-white/10"
                  >
                    <Pencil size={15} />
                    Edit
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                  <div>
                    <p className="text-xs text-neutral-500">Current Stock</p>
                    <p className="mt-1 text-xl font-semibold">
                      {item.quantity} {item.unit}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      isLowStock
                        ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                        : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                    }`}
                  >
                    {isLowStock ? "Low Stock" : "In Stock"}
                  </span>
                </div>
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
              <Boxes className="mx-auto mb-3 text-neutral-600" size={36} />
              <p className="text-sm text-neutral-500">
                No inventory items found.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}